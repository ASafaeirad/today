import { v } from "convex/values";

import { datesBetween, minDate, monthChunks, type LocalDate } from "#domain/date";
import { dayDigest, foldDay } from "#domain/dayStats";
import { rosterFor } from "#domain/schedule";

import type { Doc, Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import {
  action,
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "./_generated/server";
import { findDay } from "./lib/days";
import { ownedQuery } from "./lib/functions";
import { instancesOn, resolveCell } from "./lib/instances";
import { todayFor } from "./lib/owner";
import { findDayStats } from "./lib/projections";

interface Finding {
  check: string;
  date: LocalDate;
  detail: string;
  repair: string;
}

const finding = v.object({
  check: v.string(),
  date: v.string(),
  detail: v.string(),
  repair: v.string(),
});

function repairCommand(date: LocalDate, runId: string): string {
  return `repair.range({ from: "${date}", to: "${date}", reason: "verify:${runId}" })`;
}

/**
 * Check 1. Instance <- Marks. Replay `resolveOutcome` for a cell and compare
 * the whole tuple, so a finding names one audit event to inspect rather than
 * just saying this cell is wrong.
 */
async function checkInstancesAgainstMarks(
  ctx: QueryCtx,
  date: LocalDate,
  instances: readonly Doc<"instances">[],
  runId: string,
): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (const instance of instances) {
    const expected = await resolveCell(
      ctx,
      { ownerId: instance.ownerId, date, routineId: instance.routineId },
      instance.outcomeRev,
    );
    if (
      expected.outcome === instance.outcome &&
      expected.resolvedFromMarkId === instance.resolvedFromMarkId
    ) {
      continue;
    }
    findings.push({
      check: "instance-from-marks",
      date,
      detail: `routine ${instance.routineId}: expected {${expected.outcome}, ${expected.resolvedFromMarkId ?? "no mark"}}, found {${instance.outcome}, ${instance.resolvedFromMarkId ?? "no mark"}}`,
      repair: repairCommand(date, runId),
    });
  }
  return findings;
}

/**
 * Check 2. `dayStats` <- Instances, through a digest that commits to the inputs
 * of the fold and never to its counts: committing to the output would let a
 * wrong fold agree with itself.
 */
async function checkStatsAgainstInstances(
  ctx: QueryCtx,
  date: LocalDate,
  instances: readonly Doc<"instances">[],
  context: { ownerId: Id<"owners">; day: Doc<"days"> | null; runId: string },
): Promise<Finding[]> {
  const { day, runId } = context;
  const stats = await findDayStats(ctx, context.ownerId, date);
  const closed = day?.closedAt != null;
  const repair = repairCommand(date, runId);

  if (closed && !stats) {
    return [
      { check: "dayStats-from-instances", date, detail: "closed day has no dayStats row", repair },
    ];
  }
  if (!closed && stats) {
    return [
      { check: "dayStats-from-instances", date, detail: "open day has a dayStats row", repair },
    ];
  }
  if (!closed || !stats) return [];

  const findings: Finding[] = [];
  const fold = foldDay(date, instances, true);
  const digest = dayDigest(date, instances);
  const counted = ["scheduled", "done", "skipped", "missed"] as const;
  const agrees = stats.digest === digest && counted.every((field) => stats[field] === fold[field]);

  if (!agrees) {
    findings.push({
      check: "dayStats-from-instances",
      date,
      detail: `expected {scheduled ${fold.scheduled}, done ${fold.done}, skipped ${fold.skipped}, missed ${fold.missed}, ${digest}}, found {scheduled ${stats.scheduled}, done ${stats.done}, skipped ${stats.skipped}, missed ${stats.missed}, ${stats.digest}}`,
      repair,
    });
  }
  if (day && stats.sourceRev !== day.rev) {
    findings.push({
      check: "dayStats-from-instances",
      date,
      detail: `sourceRev ${stats.sourceRev} does not name the day revision ${day.rev}`,
      repair,
    });
  }
  return findings;
}

/**
 * Check 3. Instances <- schedule versions. Recompute the closed-day roster from
 * the interval log and compare it to what was pinned, naming the row that moved.
 */
function checkInstancesAgainstSchedule(
  date: LocalDate,
  instances: readonly Doc<"instances">[],
  context: { versions: readonly Doc<"scheduleVersions">[]; runId: string },
): Finding[] {
  const { versions, runId } = context;
  const repair = repairCommand(date, runId);
  const findings: Finding[] = [];

  const expected = rosterFor(date, versions);
  const placed = new Map(instances.map((instance) => [instance.routineId as string, instance]));

  for (const entry of expected) {
    const instance = placed.get(entry.routineId);
    if (!instance) {
      findings.push({
        check: "instances-from-schedule",
        date,
        detail: `schedule version ${entry.scheduleVersionId} places routine ${entry.routineId} here, but no Instance is pinned`,
        repair,
      });
    } else if (instance.scheduleVersionId !== entry.scheduleVersionId) {
      findings.push({
        check: "instances-from-schedule",
        date,
        detail: `routine ${entry.routineId}: pinned cites ${instance.scheduleVersionId}, the log now says ${entry.scheduleVersionId}`,
        repair,
      });
    }
  }

  const expectedRoutines = new Set(expected.map((entry) => entry.routineId as string));
  for (const instance of instances) {
    if (expectedRoutines.has(instance.routineId)) continue;
    findings.push({
      check: "instances-from-schedule",
      date,
      detail: `routine ${instance.routineId} is pinned here but no schedule version places it`,
      repair,
    });
  }

  return findings;
}

/**
 * Three checks at three boundaries, composing rather than subsuming. Read-only:
 * verification never repairs, because repairing on detection would destroy the
 * only evidence that a write path is faulty.
 *
 * One month per call, because a verify pass reads hundreds of days across years
 * and no single Convex query can do that.
 */
export const checkChunk = internalQuery({
  args: {
    ownerId: v.id("owners"),
    from: v.string(),
    to: v.string(),
    runId: v.string(),
  },
  handler: async (ctx, args): Promise<Finding[]> => {
    const owner = await ctx.db.get(args.ownerId);
    if (!owner) throw new Error("Owner not found");

    const versions = await ctx.db
      .query("scheduleVersions")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .collect();

    const findings: Finding[] = [];

    // Beyond the watermark there are legitimately no Instances yet, so a date
    // the sweep has not reached is not a hole. A watermark behind today is the
    // one thing that *is* reported: it is how a skipped sweep is detected.
    const today = todayFor(owner);
    if (owner.pinsThroughDate < today && args.to >= owner.pinsThroughDate) {
      findings.push({
        check: "sweep-watermark",
        date: owner.pinsThroughDate,
        detail: `Instances are pinned through ${owner.pinsThroughDate} but today is ${today}`,
        repair: "owners.sweep()",
      });
    }

    for (const date of datesBetween(args.from, minDate(args.to, owner.pinsThroughDate))) {
      const day = await findDay(ctx, args.ownerId, date);
      const instances = await instancesOn(ctx, args.ownerId, date);

      findings.push(
        ...(await checkInstancesAgainstMarks(ctx, date, instances, args.runId)),
        ...(await checkStatsAgainstInstances(ctx, date, instances, {
          ownerId: args.ownerId,
          day,
          runId: args.runId,
        })),
        ...checkInstancesAgainstSchedule(date, instances, { versions, runId: args.runId }),
      );
    }

    return findings;
  },
  returns: v.array(finding),
});

export const begin = internalMutation({
  args: {
    ownerId: v.id("owners"),
    runId: v.string(),
    from: v.string(),
    to: v.string(),
    chunkCount: v.number(),
  },
  handler: async (ctx, args): Promise<{ lastFullVerify: number | null }> => {
    const previous = await ctx.db
      .query("batchRuns")
      .withIndex("by_owner_scope_state", (q) =>
        q.eq("ownerId", args.ownerId).eq("scope", "verify").eq("state", "done"),
      )
      .order("desc")
      .take(1);

    await ctx.db.insert("batchRuns", {
      ownerId: args.ownerId,
      runId: args.runId,
      scope: "verify",
      from: args.from,
      to: args.to,
      reason: "owner-started verify",
      cursor: args.from,
      chunksDone: 0,
      chunkCount: args.chunkCount,
      appliedChunks: [],
      state: "running",
      startedAt: Date.now(),
      endedAt: null,
      findings: [],
    });

    /** A rebuild that never runs is a rebuild that does not work. */
    return { lastFullVerify: previous[0]?.endedAt ?? null };
  },
});

export const finish = internalMutation({
  args: {
    ownerId: v.id("owners"),
    runId: v.string(),
    findings: v.array(v.string()),
    chunksDone: v.number(),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db
      .query("batchRuns")
      .withIndex("by_owner_runId", (q) => q.eq("ownerId", args.ownerId).eq("runId", args.runId))
      .unique();
    if (!run) return;
    await ctx.db.patch(run._id, {
      state: "done",
      endedAt: Date.now(),
      cursor: null,
      chunksDone: args.chunksDone,
      findings: args.findings,
    });
  },
});

/**
 * Owner-started, read-only and chunked: an action driving paginated read-only
 * queries. For each finding it prints the repair command that fixes it, tagged
 * with this run id, so a repair points back at the report that caused it.
 */
export const run = action({
  args: { from: v.string(), to: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{
    runId: string;
    from: string;
    to: string;
    findings: string[];
    lastFullVerify: number | null;
  }> => {
    const owner = await ctx.runQuery(api.owners.current, {});
    if (!owner) throw new Error("No owner");

    const runId = crypto.randomUUID();
    const chunks = monthChunks(args.from, args.to);
    const ownerId = owner.ownerId as Id<"owners">;

    const { lastFullVerify } = await ctx.runMutation(internal.verify.begin, {
      ownerId,
      runId,
      from: args.from,
      to: args.to,
      chunkCount: chunks.length,
    });

    const findings: string[] = [];
    for (const chunk of chunks) {
      const chunkFindings = await ctx.runQuery(internal.verify.checkChunk, {
        ownerId,
        from: chunk.from,
        to: chunk.to,
        runId,
      });
      for (const item of chunkFindings) {
        findings.push(`${item.check} ${item.date}: ${item.detail} -> ${item.repair}`);
      }
    }

    await ctx.runMutation(internal.verify.finish, {
      ownerId,
      runId,
      findings,
      chunksDone: chunks.length,
    });

    return { runId, from: args.from, to: args.to, findings, lastFullVerify };
  },
});

/** The findings of a past run, and when the last full verify happened. */
export const lastRun = ownedQuery({
  args: {},
  handler: async (ctx) => {
    const runs = await ctx.db
      .query("batchRuns")
      .withIndex("by_owner_scope_state", (q) =>
        q.eq("ownerId", ctx.owner._id).eq("scope", "verify").eq("state", "done"),
      )
      .order("desc")
      .take(1);
    return runs[0] ?? null;
  },
});
