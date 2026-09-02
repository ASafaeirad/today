import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";

import { internal } from "./_generated/api";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { ensureOwner, findOwner, requireOwner, todayFor } from "./lib/owner";
import { sweepTo } from "./lib/sweep";

/**
 * Creates the owner row on first use and freezes its timezone. This is the one
 * write path that cannot use `ownedMutation`, because the wrapper requires the
 * row this mutation creates. It writes no Instances, so it owes no sweep.
 */
export const ensure = mutation({
  args: { timezone: v.string() },
  handler: async (ctx, args) => {
    const owner = await ensureOwner(ctx, args.timezone);
    return { ownerId: owner._id, timezone: owner.timezone };
  },
});

export const current = query({
  args: {},
  handler: async (ctx) => {
    const owner = await findOwner(ctx);
    if (!owner) return null;
    return {
      ownerId: owner._id,
      timezone: owner.timezone,
      today: todayFor(owner),
      pinsThroughDate: owner.pinsThroughDate,
    };
  },
});

/**
 * Runs the sweep and nothing else, for a client opening the app after a gap.
 *
 * The one write path allowed to leave the watermark behind today, and therefore
 * the only way out of a backlog no single transaction can pin. Each call pins a
 * bounded chunk, commits it and schedules the next, so a long absence converges
 * in steps instead of failing forever. `caughtUp` lets a client that would
 * rather not wait for the continuation drive the same loop itself; either way a
 * re-run past the watermark writes nothing.
 */
export const sweep = mutation({
  args: {},
  handler: async (ctx) => {
    const owner = await requireOwner(ctx);
    return catchUp(ctx, owner);
  },
});

/** The continuation of the above. Carries an owner id instead of an identity. */
export const continueSweep = internalMutation({
  args: { ownerId: v.id("owners") },
  handler: async (ctx, args) => {
    const owner = await ctx.db.get(args.ownerId);
    if (!owner) return;
    await catchUp(ctx, owner);
  },
});

async function catchUp(ctx: MutationCtx, owner: Doc<"owners">) {
  const today = todayFor(owner);
  const swept = await sweepTo(ctx, owner, today);
  if (!swept.caughtUp) {
    await ctx.scheduler.runAfter(0, internal.owners.continueSweep, { ownerId: owner._id });
  }
  return {
    today,
    pinsThroughDate: swept.owner.pinsThroughDate,
    caughtUp: swept.caughtUp,
  };
}
