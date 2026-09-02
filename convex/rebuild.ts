import { v } from "convex/values";

import { datesBetween } from "#domain/date";

import { aggregateInsert, clearOwnerAggregates } from "./lib/aggregates";
import { ownedMutation } from "./lib/functions";
import { findDayStats, rewriteDayStats } from "./lib/projections";

/**
 * `problem.md` demands that any stored aggregate be rebuildable by the same
 * pure function that wrote it. These two mutations are that, and they are what
 * turns the drift alarm from noise into a check: drive a fixture through the
 * normal path, delete every projection, rebuild, and the digests must match
 * byte for byte.
 *
 * Neither touches a fact. The projections have no independent behavior.
 */
export const dayStats = ownedMutation({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, args) => {
    const dates = datesBetween(args.from, args.to);

    for (const date of dates) {
      const existing = await findDayStats(ctx, ctx.owner._id, date);
      if (existing) await ctx.db.delete(existing._id);
    }
    for (const date of dates) {
      await rewriteDayStats(ctx, ctx.owner._id, date);
    }

    return { dates: dates.length };
  },
});

/**
 * The counting component owns no facts, so its whole tree is disposable: clear
 * it and fold the Instances back in. This is also the migration that isn't
 * needed if the adoption gate fails and the component is dropped.
 */
export const aggregates = ownedMutation({
  args: {},
  handler: async (ctx) => {
    const routines = await ctx.db
      .query("routines")
      .withIndex("by_owner", (q) => q.eq("ownerId", ctx.owner._id))
      .collect();

    await clearOwnerAggregates(
      ctx,
      ctx.owner._id,
      routines.map((routine) => routine._id),
    );

    const instances = await ctx.db
      .query("instances")
      .withIndex("by_owner_date", (q) => q.eq("ownerId", ctx.owner._id))
      .collect();
    for (const instance of instances) await aggregateInsert(ctx, instance);

    return { instances: instances.length };
  },
});
