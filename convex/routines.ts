import { v } from "convex/values";

import { RETIREMENT_THRESHOLD } from "#domain/constants";
import { consecutiveMisses, shouldSuggestRetirement } from "#domain/retirement";
import { coversDate, daysFromMask } from "#domain/schedule";

import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

import { initNamespace, routineNamespace } from "./lib/aggregates";
import { ownedMutation, ownedQuery } from "./lib/functions";
import { openVersion, versionsFor } from "./lib/schedules";
import { pinRoutineOn } from "./lib/sweep";
import { outcomeValidator } from "./schema";

export const list = ownedQuery({
  args: {},
  handler: async (ctx) => {
    const routines = await ctx.db
      .query("routines")
      .withIndex("by_owner", (q) => q.eq("ownerId", ctx.owner._id))
      .collect();

    return Promise.all(
      routines.map(async (routine) => {
        const versions = await versionsFor(ctx, ctx.owner._id, routine._id);
        const current = versions.find((version) => coversDate(version, ctx.today));
        return {
          _id: routine._id,
          name: routine.name,
          /** No covering row is a lapse: the routine did not exist then. */
          state:
            current === undefined
              ? ("lapsed" as const)
              : current.dowMask === 0
                ? ("paused" as const)
                : ("active" as const),
          days: current ? daysFromMask(current.dowMask) : [],
          scheduleVersionId: current?._id ?? null,
        };
      }),
    );
  },
});

/**
 * A routine's first schedule version starts today, so today's Instance is
 * pinned here: the sweep has already passed this date.
 */
export const create = ownedMutation({
  args: { name: v.string(), dowMask: v.number() },
  handler: async (ctx, args) => {
    const routineId = await ctx.db.insert("routines", {
      ownerId: ctx.owner._id,
      name: args.name,
    });
    await initNamespace(ctx, routineNamespace(ctx.owner._id, routineId));

    const version = await openVersion(ctx, {
      ownerId: ctx.owner._id,
      routineId,
      seq: 0,
      dowMask: args.dowMask,
      activeFrom: ctx.today,
    });

    await pinRoutineOn(ctx, {
      owner: ctx.owner,
      routineId,
      version,
      date: ctx.today,
    });

    return { routineId, scheduleVersionId: version._id };
  },
});

/** Latest-wins: renaming renames it everywhere, closed history included. */
export const rename = ownedMutation({
  args: { routineId: v.id("routines"), name: v.string() },
  handler: async (ctx, args) => {
    const routine = await requireRoutine(ctx, ctx.owner._id, args.routineId);
    await ctx.db.patch(routine._id, { name: args.name });
  },
});

/**
 * Consecutive scheduled misses, derived and never stored. Instances exist only
 * for scheduled dates, so a descending range over one routine's settled
 * Instances *is* the sequence of scheduled occurrences in order.
 */
export const retirementCounter = ownedQuery({
  args: { routineId: v.id("routines") },
  handler: async (ctx, args) => {
    const consecutive = await countConsecutiveMisses(ctx, ctx.owner._id, args.routineId);
    return {
      consecutive,
      threshold: RETIREMENT_THRESHOLD,
      suggestRetirement: shouldSuggestRetirement(consecutive),
    };
  },
});

/**
 * Every date one routine got one outcome, over a span. This is the drill-down
 * under a rate: a number the owner can tap to see the days underneath it. It is
 * what the `(ownerId, routineId, outcome, date)` index exists for.
 */
export const datesWithOutcome = ownedQuery({
  args: {
    routineId: v.id("routines"),
    outcome: outcomeValidator,
    from: v.string(),
    to: v.string(),
  },
  handler: async (ctx, args) => {
    const instances = await ctx.db
      .query("instances")
      .withIndex("by_owner_routine_outcome_date", (q) =>
        q
          .eq("ownerId", ctx.owner._id)
          .eq("routineId", args.routineId)
          .eq("outcome", args.outcome)
          .gte("date", args.from)
          .lte("date", args.to),
      )
      .collect();

    // Only settled Instances count, and only settled ones are worth showing
    // under a rate: an open day is pending, not an outcome.
    return instances
      .filter((instance) => instance.closedAt !== null)
      .map((instance) => instance.date);
  },
});

export async function countConsecutiveMisses(
  ctx: QueryCtx,
  ownerId: Id<"owners">,
  routineId: Id<"routines">,
): Promise<number> {
  const settled: Doc<"instances">["outcome"][] = [];
  for await (const instance of ctx.db
    .query("instances")
    .withIndex("by_owner_routine_date", (q) => q.eq("ownerId", ownerId).eq("routineId", routineId))
    .order("desc")) {
    // An open or awaiting-review day is pending, not missed: step over it.
    if (instance.closedAt === null) continue;
    settled.push(instance.outcome);
    if (instance.outcome !== "missed" || settled.length > RETIREMENT_THRESHOLD) break;
  }
  return consecutiveMisses(settled);
}

export async function requireRoutine(
  ctx: QueryCtx,
  ownerId: Id<"owners">,
  routineId: Id<"routines">,
): Promise<Doc<"routines">> {
  const routine = await ctx.db.get(routineId);
  if (!routine || routine.ownerId !== ownerId) throw new Error("Routine not found");
  return routine;
}
