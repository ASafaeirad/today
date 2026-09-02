import { v } from "convex/values";

import { MAX_EAGER_FOLDS } from "#domain/constants";
import { shouldSuggestRetirement } from "#domain/retirement";

import { requireSkips } from "./lib/balance";
import { bumpRev, ensureDay, findDay } from "./lib/days";
import { ownedMutation, ownedQuery } from "./lib/functions";
import { applyResolution, instancesOn, resolveCell } from "./lib/instances";
import { findDayStats, rewriteDayStats } from "./lib/projections";
import { countConsecutiveMisses } from "./routines";

/**
 * A day whose date has passed but which has not been closed is awaiting review,
 * forever if the owner never returns. Nothing closes it in the background.
 */
export const get = ownedQuery({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const day = await findDay(ctx, ctx.owner._id, args.date);
    const instances = await instancesOn(ctx, ctx.owner._id, args.date);
    const routines = new Map(
      (
        await ctx.db
          .query("routines")
          .withIndex("by_owner", (q) => q.eq("ownerId", ctx.owner._id))
          .collect()
      ).map((routine) => [routine._id, routine.name]),
    );

    const closed = day?.closedAt != null;
    return {
      date: args.date,
      state: closed
        ? ("closed" as const)
        : args.date >= ctx.today
          ? ("open" as const)
          : ("awaitingReview" as const),
      rev: day?.rev ?? 0,
      closedAt: day?.closedAt ?? null,
      roster: instances.map((instance) => ({
        instanceId: instance._id,
        routineId: instance.routineId,
        name: routines.get(instance.routineId) ?? "(unknown)",
        outcome: instance.outcome,
        /** No citation means nobody has marked this cell yet. */
        marked: instance.resolvedFromMarkId !== null,
        settled: instance.closedAt !== null,
        scheduleVersionId: instance.scheduleVersionId,
      })),
      stats: await findDayStats(ctx, ctx.owner._id, args.date),
    };
  },
});

/**
 * Closing is one-way and idempotent: a second close changes nothing and never
 * mints twice. Every unset Instance becomes missed, which is what the resolver
 * already returns for a cell with no Mark.
 *
 * The repair is eager and atomic: the projection is rewritten inside this same
 * mutation, so the write returns only when its numbers are current.
 *
 * The skips on the roster are charged here, not merely reserved. `marks.append`
 * bought each one when it was marked, but the Balance is a rolling window: the
 * all-done days that funded a hold can age out of it, and so can the held day
 * itself, which would settle a spend the horizon never sums. Either way the
 * close is refused rather than granting a rate exclusion nothing paid for, and
 * the owner clears it by re-marking a skip as done or missed.
 */
export const close = ownedMutation({
  args: { date: v.string(), closeKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.date > ctx.today) throw new Error("Cannot close a future day");

    const day = await ensureDay(ctx, ctx.owner._id, args.date);
    if (day.closedAt !== null) {
      return {
        date: args.date,
        closed: true,
        alreadyClosed: true,
        rev: day.rev,
        suggestions: [] as { routineId: string; consecutive: number }[],
      };
    }

    const instances = await instancesOn(ctx, ctx.owner._id, args.date);
    if (instances.length > MAX_EAGER_FOLDS) {
      throw new Error(
        `Close of ${args.date} folds ${instances.length} Instances, over the eager limit of ${MAX_EAGER_FOLDS}. Use the batch path.`,
      );
    }

    const rev = await bumpRev(ctx, day);
    const closedAt = Date.now();

    // Resolve the whole roster before sealing any of it: the skips it turns out
    // to contain have to be paid for as one purchase, and a close that cannot
    // afford them must not have settled half the day first.
    const resolutions = [];
    for (const instance of instances) {
      resolutions.push({
        instance,
        resolution: await resolveCell(
          ctx,
          {
            ownerId: instance.ownerId,
            date: instance.date,
            routineId: instance.routineId,
          },
          rev,
        ),
      });
    }

    const skips = resolutions.filter(({ resolution }) => resolution.outcome === "skipped").length;
    if (skips > 0) {
      await requireSkips(ctx, ctx.owner._id, ctx.today, {
        date: args.date,
        skips,
        // This day's own holds are what the close is spending, not competition
        // for it. Everything held on other open days still stands in the way.
        ignoreHold: (held) => held.date === args.date,
        subject: `Cannot close ${args.date}`,
      });
    }

    for (const { instance, resolution } of resolutions) {
      await applyResolution(ctx, instance, resolution, { seal: closedAt });
    }

    await ctx.db.patch(day._id, { closedAt, closeKey: args.closeKey ?? null });
    await rewriteDayStats(ctx, ctx.owner._id, args.date);

    // Retirement is offered at close, never imposed, and never stored.
    const suggestions = [];
    for (const instance of instances) {
      const settled = await ctx.db.get(instance._id);
      if (settled?.outcome !== "missed") continue;
      const consecutive = await countConsecutiveMisses(ctx, ctx.owner._id, instance.routineId);
      if (shouldSuggestRetirement(consecutive)) {
        suggestions.push({ routineId: instance.routineId, consecutive });
      }
    }

    return { date: args.date, closed: true, alreadyClosed: false, rev, suggestions };
  },
});
