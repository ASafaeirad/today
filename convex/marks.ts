import { v } from "convex/values";

import { requireUserId } from "./lib/auth";
import { requireSkips } from "./lib/balance";
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
 * Marking skipped is a purchase and is refused when the Balance cannot cover
 * it. A skipped Instance leaves the completion denominator permanently
 * (ADR-0001), and that exclusion is exactly what a banked skip buys, so an
 * unpaid one would be a free exclusion and the bound ADR-0001 relies on would
 * not exist. The Balance is charged as it stands now; the breakdown comes back
 * with the write so the caller can say what the skip was charged against.
 *
 * Re-marking a cell that already resolves to skipped costs nothing: the charge
 * is already standing against it, as a hold while the day is open and as a
 * spend once it is closed.
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
    if (day.sealed) throw new Error("A sealed day is permanent.");

    // Buy the skip before writing the Mark, so a refusal leaves no trace.
    const charged = args.outcome === "skipped" && instance.outcome !== "skipped";
    const balance = charged
      ? await requireSkips(ctx, ctx.owner._id, ctx.today, {
          date: args.date,
          skips: 1,
          subject: "Cannot mark skipped",
        })
      : null;

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
      /**
       * The Balance this skip was charged against, or `null` when the mark cost
       * nothing. It is the reading from just before the charge, which is what
       * says why the write was allowed; the current number is `balance.current`.
       */
      balance,
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
