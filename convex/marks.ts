import { v } from "convex/values";

import { requireUserId } from "./lib/auth";
import { bumpRev, findDay } from "./lib/days";
import { ownedMutation, ownedQuery } from "./lib/functions";
import { applyResolution, findInstance, resolveCell } from "./lib/instances";
import { rewriteDayStats } from "./lib/projections";
import { markOutcomeValidator } from "./schema";

/**
 * One tap. Marks are append-only and ordered by the time the server accepted
 * them, never by the device clock; the latest one is authoritative.
 *
 * An `outcome` of `null` is an Unset: it clears the previous mark without
 * deleting anything, and the cell resolves to `missed` again, this time citing
 * the Unset rather than citing nothing.
 *
 * Amending a closed day happens in place, with no reopening and no expiry. A
 * mark on an open day writes no projection row at all, because only settled
 * Instances count; a mark on a closed day rewrites that one row eagerly.
 *
 * Marking skipped is not refused when the Balance is empty. The Balance is
 * floored at zero rather than guarded at write time, and a backlog day spends
 * the balance as it stands now; the breakdown comes back with the write so the
 * caller can say what the skip cost before it was spent.
 */
export const append = ownedMutation({
  args: {
    date: v.string(),
    routineId: v.id("routines"),
    outcome: markOutcomeValidator,
  },
  handler: async (ctx, args) => {
    const cell = {
      ownerId: ctx.owner._id,
      date: args.date,
      routineId: args.routineId,
    };

    const instance = await findInstance(ctx, cell);
    if (!instance) {
      throw new Error(`No Instance on ${args.date} for that routine: it was not scheduled then.`);
    }

    const day = await findDay(ctx, ctx.owner._id, args.date);
    if (!day) throw new Error(`No day row for ${args.date}`);

    const markId = await ctx.db.insert("marks", {
      ...cell,
      outcome: args.outcome,
      actorId: await requireUserId(ctx),
      serverAt: Date.now(),
    });

    // Every path that appends a Mark re-resolves that cell in the same mutation.
    const rev = await bumpRev(ctx, day);
    const resolution = await resolveCell(ctx, cell, rev);
    const updated = await applyResolution(ctx, instance, resolution);

    if (day.closedAt !== null) {
      await rewriteDayStats(ctx, ctx.owner._id, args.date);
    }

    return {
      markId,
      outcome: updated.outcome,
      resolvedFromMarkId: updated.resolvedFromMarkId,
      outcomeRev: updated.outcomeRev,
      settled: updated.closedAt !== null,
    };
  },
});

/** The audit log for one cell, newest last. Nothing counts these. */
export const forCell = ownedQuery({
  args: { date: v.string(), routineId: v.id("routines") },
  handler: (ctx, args) =>
    ctx.db
      .query("marks")
      .withIndex("by_owner_date_routine_serverAt", (q) =>
        q.eq("ownerId", ctx.owner._id).eq("date", args.date).eq("routineId", args.routineId),
      )
      .collect(),
});
