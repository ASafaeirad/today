import { v } from "convex/values";

import { MAX_EAGER_FOLDS } from "#domain/constants";
import { shouldSuggestRetirement } from "#domain/retirement";

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

    for (const instance of instances) {
      const resolution = await resolveCell(
        ctx,
        {
          ownerId: instance.ownerId,
          date: instance.date,
          routineId: instance.routineId,
        },
        rev,
      );
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
