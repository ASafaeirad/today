import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { ownedMutation } from "./lib/functions";
import { ensureOwner, findOwner, todayFor } from "./lib/owner";

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

/** Runs the sweep and nothing else, for a client opening the app after a gap. */
export const sweep = ownedMutation({
  args: {},
  handler: (ctx) => ({
    today: ctx.today,
    pinsThroughDate: ctx.owner.pinsThroughDate,
  }),
});
