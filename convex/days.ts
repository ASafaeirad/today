import { v } from "convex/values";

import type { LocalDate } from "#domain/date";

import { MAX_EAGER_DAYS, MAX_EAGER_FOLDS } from "#domain/constants";
import { shouldSuggestRetirement } from "#domain/retirement";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

import { requireSkips } from "./lib/balance";
import { bumpRev, ensureDay, findDay } from "./lib/days";
import { ownedMutation, ownedQuery, type OwnerContext } from "./lib/functions";
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

    return {
      date: args.date,
      state: stateOf(day, args.date, ctx.today),
      rev: day?.rev ?? 0,
      closedAt: day?.closedAt ?? null,
      sealed: day?.sealed ?? false,
      closingNote: day?.closingNote ?? "",
      roster: await Promise.all(
        instances.map(async (instance) => ({
          instanceId: instance._id,
          routineId: instance.routineId,
          name: routines.get(instance.routineId) ?? "(unknown)",
          outcome: instance.outcome,
          /** No citation means nobody has marked this cell yet. */
          marked: await hasOutcomeMark(ctx, instance),
          settled: instance.closedAt !== null,
          scheduleVersionId: instance.scheduleVersionId,
        })),
      ),
      stats: await findDayStats(ctx, ctx.owner._id, args.date),
    };
  },
});

/**
 * One line per local date, enough to draw the day strip and count the backlog
 * without opening every day. A cell counts under its outcome once it has an
 * explicit Mark or its day is closed; until then it is open, whatever the
 * resolver says it would settle as.
 *
 * Bounded like every eager read: past `MAX_EAGER_DAYS` dates the caller is
 * asking for a report, not a strip.
 */
export const overview = ownedQuery({
  args: { dates: v.array(v.string()) },
  handler: async (ctx, args) => {
    if (args.dates.length === 0) return [];
    if (args.dates.length > MAX_EAGER_DAYS) {
      throw new Error(
        `Overview of ${args.dates.length} dates is over the limit of ${MAX_EAGER_DAYS}.`,
      );
    }
    const summaries = new Map(
      await Promise.all(
        [...new Set(args.dates)].map(async (date) => {
          const [day, instances] = await Promise.all([
            findDay(ctx, ctx.owner._id, date),
            instancesOn(ctx, ctx.owner._id, date),
          ]);
          const summary = {
            date,
            scheduled: 0,
            open: 0,
            done: 0,
            skipped: 0,
            missed: 0,
            state: stateOf(day, date, ctx.today),
            sealed: day?.sealed ?? false,
            closedAt: day?.closedAt ?? null,
          };

          for (const instance of instances) {
            summary.scheduled += 1;
            const resolved = instance.closedAt !== null || (await hasOutcomeMark(ctx, instance));
            if (resolved) summary[instance.outcome] += 1;
            else summary.open += 1;
          }

          return [date, summary] as const;
        }),
      ),
    );

    return args.dates.map((date) => summaries.get(date)!);
  },
});

/** A day whose date has passed but which has not been closed is awaiting review. */
function stateOf(day: Doc<"days"> | null | undefined, date: LocalDate, today: LocalDate) {
  if (day?.closedAt != null) return "closed" as const;
  return date >= today ? ("open" as const) : ("awaitingReview" as const);
}

/**
 * Whether the owner has said anything about this cell. A null citation and an
 * Unset both mean no: the resolver settles either as missed, but nobody chose
 * that yet.
 */
async function hasOutcomeMark(ctx: QueryCtx, instance: Doc<"instances">): Promise<boolean> {
  if (instance.resolvedFromMarkId === null) return false;
  return (await ctx.db.get(instance.resolvedFromMarkId))?.outcome != null;
}

/**
 * The tracker passes `seal: true` with the reviewed revision and closing note.
 * This requires explicit outcomes and makes later marks impossible. Calls without
 * `seal` retain the legacy close behavior for existing clients.
 *
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
  args: {
    date: v.string(),
    closeKey: v.optional(v.string()),
    seal: v.optional(v.boolean()),
    expectedRev: v.optional(v.number()),
    closingNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.date > ctx.today) throw new Error("Cannot close a future day");

    const day = await ensureDay(ctx, ctx.owner._id, args.date);
    const closed = await handleAlreadyClosedDay(ctx, day, args);
    if (closed) return closed;

    const instances = await instancesOn(ctx, ctx.owner._id, args.date);
    if (instances.length > MAX_EAGER_FOLDS) {
      throw new Error(
        `Close of ${args.date} folds ${instances.length} Instances, over the eager limit of ${MAX_EAGER_FOLDS}. Use the batch path.`,
      );
    }

    if (args.seal) await validateSeal(ctx, day, instances, args);
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

    await ctx.db.patch(day._id, {
      closedAt,
      closeKey: args.closeKey ?? null,
      sealed: Boolean(args.seal),
      closingNote: args.closingNote ?? "",
    });
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

async function handleAlreadyClosedDay(
  ctx: MutationCtx & OwnerContext,
  day: Doc<"days">,
  args: { date: string; seal?: boolean; expectedRev?: number; closingNote?: string },
) {
  if (day.closedAt === null) return null;
  if (args.seal && !day.sealed) {
    const instances = await instancesOn(ctx, ctx.owner._id, args.date);
    await validateSeal(ctx, day, instances, args);
    const rev = await bumpRev(ctx, day);
    await ctx.db.patch(day._id, {
      sealed: true,
      closingNote: args.closingNote ?? "",
    });
    return {
      date: args.date,
      closed: true,
      alreadyClosed: true,
      rev,
      suggestions: [] as { routineId: string; consecutive: number }[],
    };
  }
  return {
    date: args.date,
    closed: true,
    alreadyClosed: true,
    rev: day.rev,
    suggestions: [] as { routineId: string; consecutive: number }[],
  };
}

/**
 * Open history stays available without an expiry date.
 *
 * The sweep pins a Day row for every date it passes, roster or no roster, so a
 * pause or a lapse leaves a run of empty days behind it. An empty day has
 * nothing to resolve and nothing worth sealing — it is history, not a nag — and
 * leaving it here would let a long enough run fill any bounded window the
 * caller takes off the front and hide every day that does owe a verdict.
 */
export const backlog = ownedQuery({
  args: {},
  handler: async (ctx) => {
    const days = await ctx.db
      .query("days")
      .withIndex("by_owner_date", (q) => q.eq("ownerId", ctx.owner._id).lt("date", ctx.today))
      .order("desc")
      .collect();
    const open = days.filter((day) => day.closedAt === null);
    const dates = await Promise.all(
      open.map(async (day) => ((await hasRoster(ctx, ctx.owner._id, day.date)) ? day.date : null)),
    );
    return dates.filter((date) => date !== null);
  },
});

/** One index lookup: whether the sweep placed anything on this date at all. */
async function hasRoster(ctx: QueryCtx, ownerId: Id<"owners">, date: LocalDate): Promise<boolean> {
  const first = await ctx.db
    .query("instances")
    .withIndex("by_owner_date", (q) => q.eq("ownerId", ownerId).eq("date", date))
    .first();
  return first !== null;
}

async function validateSeal(
  ctx: MutationCtx,
  day: Doc<"days">,
  instances: Doc<"instances">[],
  args: { expectedRev?: number; closingNote?: string },
) {
  if (args.expectedRev !== day.rev)
    throw new Error("This day changed. Review it again before sealing.");
  if ((args.closingNote?.length ?? 0) > 2000)
    throw new Error("Closing note must be 2000 characters or fewer.");
  for (const instance of instances) {
    const mark =
      instance.resolvedFromMarkId === null ? null : await ctx.db.get(instance.resolvedFromMarkId);
    if (mark?.outcome == null)
      throw new Error("Choose an outcome for every routine before sealing.");
  }
}
