import { v } from "convex/values";

import { MAX_EAGER_DAYS, MAX_EAGER_FOLDS } from "#domain/constants";
import { monthChunks, rangeLength } from "#domain/date";

import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { ownedMutation, ownedQuery, ownerById } from "./lib/functions";
import { instancesBetween } from "./lib/instances";
import { repairRange } from "./lib/repair";

/**
 * The eager path has a document and time limit, so an edit larger than one
 * transaction opens the batch path. The rule is a rule, not an estimate: beyond
 * one month of scope or `MAX_EAGER_FOLDS` Instance folds the caller must use
 * the batch path, and an oversized mutation fails rather than silently doing
 * part of the work. A close and a single amendment never use it.
 */
export const range = ownedMutation({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, args) => {
    const days = rangeLength(args.from, args.to);
    if (days > MAX_EAGER_DAYS) {
      throw new Error(
        `Scope of ${days} days is over the eager limit of ${MAX_EAGER_DAYS}. Use repair.start.`,
      );
    }
    const folds = (await instancesBetween(ctx, ctx.owner._id, args.from, args.to)).length;
    if (folds > MAX_EAGER_FOLDS) {
      throw new Error(
        `Scope of ${folds} Instance folds is over the eager limit of ${MAX_EAGER_FOLDS}. Use repair.start.`,
      );
    }
    return repairRange(ctx, ctx.owner, args.from, args.to);
  },
});

/**
 * One chunk is one month and one mutation. Continuation is a scheduled
 * one-shot, not a client loop: a closed tab would otherwise leave history mixed
 * across two revisions.
 */
export const start = ownedMutation({
  args: { from: v.string(), to: v.string(), reason: v.string() },
  handler: async (ctx, args) => {
    const runId = crypto.randomUUID();
    const chunks = monthChunks(args.from, args.to);

    await ctx.db.insert("batchRuns", {
      ownerId: ctx.owner._id,
      runId,
      scope: "repair",
      from: args.from,
      to: args.to,
      reason: args.reason,
      cursor: args.from,
      chunksDone: 0,
      chunkCount: chunks.length,
      appliedChunks: [],
      state: "running",
      startedAt: Date.now(),
      endedAt: null,
    });

    await ctx.scheduler.runAfter(0, internal.repair.runChunk, {
      ownerId: ctx.owner._id,
      runId,
    });

    return { runId, chunkCount: chunks.length };
  },
});

/**
 * The cursor moves inside the chunk's transaction, which is the detail the
 * whole design rests on: no chunk applied but uncounted, none counted but
 * unapplied, and a retry of (runId, chunk) does nothing.
 */
export const runChunk = internalMutation({
  args: { ownerId: v.id("owners"), runId: v.string() },
  handler: async (ctx, args) => {
    const run = await ctx.db
      .query("batchRuns")
      .withIndex("by_owner_runId", (q) => q.eq("ownerId", args.ownerId).eq("runId", args.runId))
      .unique();
    if (!run || run.state !== "running") return;

    const chunks = monthChunks(run.from, run.to);
    const index = chunks.findIndex((_, position) => !run.appliedChunks.includes(position));
    if (index === -1) {
      await ctx.db.patch(run._id, {
        state: "done",
        endedAt: Date.now(),
        cursor: null,
      });
      return;
    }

    const chunk = chunks[index]!;
    const owned = await ownerById(ctx, args.ownerId);
    await repairRange(owned, owned.owner, chunk.from, chunk.to);

    await ctx.db.patch(run._id, {
      appliedChunks: [...run.appliedChunks, index],
      chunksDone: run.chunksDone + 1,
      cursor: chunk.to,
    });

    if (run.appliedChunks.length + 1 < chunks.length) {
      await ctx.scheduler.runAfter(0, internal.repair.runChunk, args);
    } else {
      await ctx.db.patch(run._id, {
        state: "done",
        endedAt: Date.now(),
        cursor: null,
      });
    }
  },
});

/**
 * While a run is in flight the data is mixed but not wrong: every row names the
 * revision it folded. A window crossing the cursor shows a banner naming the
 * run, its reason and its position.
 */
export const inFlight = ownedQuery({
  args: {},
  handler: async (ctx) => {
    const runs = await ctx.db
      .query("batchRuns")
      .withIndex("by_owner_scope_state", (q) =>
        q.eq("ownerId", ctx.owner._id).eq("scope", "repair").eq("state", "running"),
      )
      .collect();

    return runs.map((run) => ({
      runId: run.runId,
      reason: run.reason,
      from: run.from,
      to: run.to,
      cursor: run.cursor,
      chunksDone: run.chunksDone,
      chunkCount: run.chunkCount,
    }));
  },
});
