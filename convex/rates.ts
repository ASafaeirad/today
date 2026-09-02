import { v } from "convex/values";

import { RATE_DOCUMENT_LIMIT } from "#domain/constants";
import { addDays, maxDate, minDate, type LocalDate } from "#domain/date";
import { clipComparison, completionRate } from "#domain/rate";
import { coversDate } from "#domain/schedule";

import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

import {
  countStates,
  instancesByOwner,
  instancesByRoutine,
  routineNamespace,
} from "./lib/aggregates";
import { lastClosedDate } from "./lib/days";
import { ownedQuery } from "./lib/functions";
import { instancesBetween } from "./lib/instances";

export interface RateCounts {
  done: number;
  skipped: number;
  missed: number;
  open: number;
  awaitingReview: number;
}

interface Scope {
  ownerId: Id<"owners">;
  routineId?: Id<"routines">;
  from: LocalDate;
  to: LocalDate;
  today: LocalDate;
}

const ZERO: RateCounts = {
  done: 0,
  skipped: 0,
  missed: 0,
  open: 0,
  awaitingReview: 0,
};

/**
 * Every rate window - week, rolling month, month, year, year over year and
 * arbitrary per-routine spans - is one range over the maintained B-tree.
 */
async function componentCounts(
  ctx: QueryCtx,
  scope: Scope,
): Promise<{ counts: RateCounts; documentsRead: number; namespace: string }> {
  const aggregate = scope.routineId === undefined ? instancesByOwner : instancesByRoutine;
  const namespace =
    scope.routineId === undefined
      ? scope.ownerId
      : routineNamespace(scope.ownerId, scope.routineId);

  const before = await ctx.meta.getTransactionMetrics();

  const yesterday = addDays(scope.today, -1);
  const [done, skipped, missed, awaitingReview, open] = await countStates(
    ctx,
    { aggregate, namespace },
    [
      { state: "done", from: scope.from, to: scope.to },
      { state: "skipped", from: scope.from, to: scope.to },
      { state: "missed", from: scope.from, to: scope.to },
      // A day whose date has passed but which was never closed is pending, not
      // missed, so opening today cannot lower a rate.
      { state: "pending", from: scope.from, to: minDate(scope.to, yesterday) },
      { state: "pending", from: maxDate(scope.from, scope.today), to: scope.to },
    ],
  );

  const after = await ctx.meta.getTransactionMetrics();

  return {
    counts: {
      done: done!,
      skipped: skipped!,
      missed: missed!,
      awaitingReview: awaitingReview!,
      open: open!,
    },
    namespace,
    documentsRead: after.documentsRead.used - before.documentsRead.used,
  };
}

/**
 * The verifier, and the fallback. Folds the Instances the bounds name. Because
 * this exists, dropping the counting component costs no migration.
 */
async function recountCounts(ctx: QueryCtx, scope: Scope): Promise<RateCounts> {
  const rows = scope.routineId
    ? await ctx.db
        .query("instances")
        .withIndex("by_owner_routine_date", (q) =>
          q
            .eq("ownerId", scope.ownerId)
            .eq("routineId", scope.routineId!)
            .gte("date", scope.from)
            .lte("date", scope.to),
        )
        .collect()
    : await instancesBetween(ctx, scope.ownerId, scope.from, scope.to);

  const counts = { ...ZERO };
  for (const instance of rows) {
    if (instance.closedAt === null) {
      if (instance.date >= scope.today) counts.open += 1;
      else counts.awaitingReview += 1;
    } else if (instance.outcome === "done") counts.done += 1;
    else if (instance.outcome === "skipped") counts.skipped += 1;
    else counts.missed += 1;
  }
  return counts;
}

/** Routines that were paused for any part of the window. */
async function pausedCount(ctx: QueryCtx, scope: Scope): Promise<number> {
  const versions = await ctx.db
    .query("scheduleVersions")
    .withIndex("by_owner", (q) => q.eq("ownerId", scope.ownerId))
    .collect();

  const paused = new Set<string>();
  for (const version of versions) {
    if (version.dowMask !== 0) continue;
    if (scope.routineId && version.routineId !== scope.routineId) continue;
    if (coversDate(version, scope.from) || coversDate(version, scope.to)) {
      paused.add(version.routineId);
    } else if (version.activeFrom >= scope.from && version.activeFrom <= scope.to) {
      paused.add(version.routineId);
    }
  }
  return paused.size;
}

/** The write stamp the answer is current as of. */
async function writeStamp(ctx: QueryCtx, scope: Scope) {
  const rows = await ctx.db
    .query("dayStats")
    .withIndex("by_owner_date", (q) =>
      q.eq("ownerId", scope.ownerId).gte("date", scope.from).lte("date", scope.to),
    )
    .order("desc")
    .take(1);
  const row = rows[0];
  return row ? { date: row.date, sourceRev: row.sourceRev } : null;
}

async function answer(ctx: QueryCtx, scope: Scope, source: "component" | "recount") {
  const { counts, documentsRead, namespace } =
    source === "component"
      ? await componentCounts(ctx, scope)
      : {
          counts: await recountCounts(ctx, scope),
          documentsRead: 0,
          namespace:
            scope.routineId === undefined
              ? (scope.ownerId as string)
              : routineNamespace(scope.ownerId, scope.routineId),
        };

  return {
    from: scope.from,
    to: scope.to,
    routineId: scope.routineId ?? null,
    counts,
    /** `null` reads as *not active*, never as 0%. ADR-0001. */
    rate: completionRate(counts),
    /**
     * Attached to every answer, computed from the query itself and therefore
     * free. It is what makes a B-tree the owner cannot point at acceptable:
     * one tap runs `recount` over these exact bounds, and the two must agree.
     */
    receipt: {
      source,
      namespace,
      sortKey: "[state, localDate]",
      bounds: { from: scope.from, to: scope.to, inclusive: true },
      denominator: "closed and scheduled: done + missed",
      excluded: {
        open: counts.open,
        awaitingReview: counts.awaitingReview,
        skipped: counts.skipped,
        paused: await pausedCount(ctx, scope),
      },
      documentsRead,
      documentLimit: RATE_DOCUMENT_LIMIT,
      withinLimit: documentsRead <= RATE_DOCUMENT_LIMIT,
      currentAsOf: await writeStamp(ctx, scope),
    },
  };
}

export const window = ownedQuery({
  args: {
    from: v.string(),
    to: v.string(),
    routineId: v.optional(v.id("routines")),
  },
  handler: (ctx, args) =>
    answer(ctx, { ownerId: ctx.owner._id, today: ctx.today, ...args }, "component"),
});

/**
 * Owner-triggered from the drill-down. It does not run on every read, because
 * then the pin scan is paid anyway and the component saves nothing, and nothing
 * runs it on a timer.
 */
export const recount = ownedQuery({
  args: {
    from: v.string(),
    to: v.string(),
    routineId: v.optional(v.id("routines")),
  },
  handler: async (ctx, args) => {
    const scope = { ownerId: ctx.owner._id, today: ctx.today, ...args };
    const counted = await answer(ctx, scope, "component");
    const folded = await answer(ctx, scope, "recount");

    const disagreements = (Object.keys(ZERO) as (keyof RateCounts)[])
      .filter((key) => counted.counts[key] !== folded.counts[key])
      .map((key) => `${key}: component ${counted.counts[key]}, Instances ${folded.counts[key]}`);

    return {
      ...folded,
      component: counted.counts,
      /** A disagreement is an alarm. It is never a read-path repair. */
      agrees: disagreements.length === 0,
      disagreements,
    };
  },
});

/**
 * A partial period compares against the same elapsed slice of the previous
 * period, both clipped by the last closed date common to them.
 */
export const compare = ownedQuery({
  args: {
    from: v.string(),
    to: v.string(),
    previousFrom: v.string(),
    previousTo: v.string(),
    routineId: v.optional(v.id("routines")),
  },
  handler: async (ctx, args) => {
    const clipped = clipComparison({
      current: { from: args.from, to: args.to },
      previous: { from: args.previousFrom, to: args.previousTo },
      lastClosed: await lastClosedDate(ctx, ctx.owner._id),
    });

    const base = {
      ownerId: ctx.owner._id,
      today: ctx.today,
      routineId: args.routineId,
    };

    return {
      elapsedDays: clipped.elapsedDays,
      current: clipped.current
        ? await answer(ctx, { ...base, ...clipped.current }, "component")
        : null,
      previous: clipped.previous
        ? await answer(ctx, { ...base, ...clipped.previous }, "component")
        : null,
    };
  },
});
