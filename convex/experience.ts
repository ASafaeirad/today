import { streakMultiplier } from "#domain/experience";

import { catchUp, findProgression, heldAwards } from "./lib/experience";
import { ownedMutation, ownedQuery } from "./lib/functions";

/**
 * What the shell prints under the chrome: the lifetime total, where the run
 * stands, and whether an older day is holding anybody's bonus.
 *
 * Banked facts only. Pending Experience is not here because it is not banked:
 * it is one point per done mark on the day the owner is looking at, which the
 * roster already says, and reading it from the roster is what lets the preview
 * move under an optimistic mark instead of after a round trip.
 */
export const progression = ownedQuery({
  args: {},
  handler: async (ctx) => {
    const row = await findProgression(ctx, ctx.owner._id);
    if (row === null) {
      return {
        experience: 0,
        streak: 0,
        multiplier: 1,
        heldDays: 0,
        caughtUp: false,
        backfill: null,
      };
    }

    const held = await heldAwards(ctx, ctx.owner._id, row.settledThrough);

    return {
      experience: row.experience,
      streak: row.streak,
      multiplier: streakMultiplier(row.streak),
      /** Closed days whose streak part an older awaiting-review day still gates. */
      heldDays: held.length,
      caughtUp: row.bankedThrough !== null && row.bankedThrough >= ctx.today,
      /**
       * History summarized once, rather than replayed one reward at a time. Null
       * once the owner has said they read it, and for an owner who had no closed
       * history to carry in.
       */
      backfill:
        row.backfilledAt !== null && row.acknowledgedAt === null && row.backfilledDays > 0
          ? { days: row.backfilledDays, experience: row.backfilledExperience }
          : null,
    };
  },
});

/**
 * Walks existing closed history into awards, a bounded chunk at a time.
 *
 * Queries cannot write, so a client that finds progression behind drives this
 * the way it drives the sweep: call it until it reports `complete`. Every call
 * is idempotent, so two clients racing converge instead of double-banking.
 */
export const sync = ownedMutation({
  args: {},
  handler: (ctx) => catchUp(ctx, ctx.owner._id, ctx.today),
});

/** The owner has read the backfill summary. It does not come back. */
export const acknowledgeBackfill = ownedMutation({
  args: {},
  handler: async (ctx) => {
    const row = await findProgression(ctx, ctx.owner._id);
    if (row === null || row.acknowledgedAt !== null) return null;
    await ctx.db.patch(row._id, { acknowledgedAt: Date.now() });
    return null;
  },
});
