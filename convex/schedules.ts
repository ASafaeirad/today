import { v } from "convex/values";

import { daysFromMask } from "#domain/schedule";

import { ownedMutation, ownedQuery } from "./lib/functions";
import { closePlusOpen, versionsFor } from "./lib/schedules";
import { requireRoutine } from "./routines";

/**
 * Edit, pause, resume and un-retire are one operation: close the frontier row
 * at today and open the next at tomorrow. A mask of 0 is a pause, which is why
 * a paused routine cannot be missed, cannot block a mint and cannot advance the
 * retirement counter: it places no Instance at all.
 */
export const set = ownedMutation({
  args: { routineId: v.id("routines"), dowMask: v.number() },
  handler: async (ctx, args) => {
    await requireRoutine(ctx, ctx.owner._id, args.routineId);
    if (args.dowMask < 0 || args.dowMask > 0b111_1111) {
      throw new Error(`Not a day-of-week mask: ${args.dowMask}`);
    }
    return closePlusOpen(ctx, {
      owner: ctx.owner,
      today: ctx.today,
      routineId: args.routineId,
      nextMask: args.dowMask,
    });
  },
});

/** Close the frontier row and open nothing. Offered, never imposed. */
export const retire = ownedMutation({
  args: { routineId: v.id("routines") },
  handler: async (ctx, args) => {
    await requireRoutine(ctx, ctx.owner._id, args.routineId);
    return closePlusOpen(ctx, {
      owner: ctx.owner,
      today: ctx.today,
      routineId: args.routineId,
      nextMask: null,
    });
  },
});

/** The immutable input, shown as the history it is. */
export const history = ownedQuery({
  args: { routineId: v.id("routines") },
  handler: async (ctx, args) => {
    const versions = await versionsFor(ctx, ctx.owner._id, args.routineId);
    return versions.map((version) => ({
      _id: version._id,
      seq: version.seq,
      activeFrom: version.activeFrom,
      activeUntil: version.activeUntil,
      dowMask: version.dowMask,
      days: daysFromMask(version.dowMask),
      paused: version.dowMask === 0,
    }));
  },
});
