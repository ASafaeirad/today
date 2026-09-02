import { datesBetween, type LocalDate } from "#domain/date";
import { rosterFor } from "#domain/schedule";

import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

import { bumpRev, ensureDay } from "./days";
import {
  applyResolution,
  instancesOn,
  placeInstance,
  removeInstance,
  resolveCell,
} from "./instances";
import { rewriteDayStats } from "./projections";

export interface RepairReport {
  date: LocalDate;
  placed: number;
  removed: number;
  resolved: number;
}

/**
 * Rebuild one date from immutable inputs: the roster from the interval log, the
 * outcomes from the Marks, the projection from the Instances. Instances are a
 * pure function of the schedule versions and the calendar, so a hole left by a
 * missed sweep is always repairable.
 *
 * A closed day's roster is pinned, so an extra Instance there is reported by
 * the verify pass and never deleted here. The interval log is load-bearing for
 * open and awaiting-review rosters only.
 *
 * What repair does restore into a closed day it seals with that day's own
 * `closedAt`, so the day stays what a close means: every Instance on it
 * settled, and the projection and the aggregates counting the same cells.
 */
export async function repairDate(
  ctx: MutationCtx,
  owner: Doc<"owners">,
  date: LocalDate,
  versions: readonly Doc<"scheduleVersions">[],
): Promise<RepairReport> {
  const day = await ensureDay(ctx, owner._id, date);
  const existing = await instancesOn(ctx, owner._id, date);
  const expected = rosterFor(date, versions);
  const report: RepairReport = { date, placed: 0, removed: 0, resolved: 0 };

  // The revision is bumped at most once, and only if this date actually
  // changes. A repair that finds nothing wrong writes no new revision, so
  // running it twice leaves the same digest.
  let { rev } = day;
  let bumped = false;
  const nextRev = async () => {
    if (!bumped) {
      rev = await bumpRev(ctx, day);
      bumped = true;
    }
    return rev;
  };

  const pinned = new Map(existing.map((i) => [i.routineId as string, i]));
  const expectedRoutines = new Set(expected.map((entry) => entry.routineId as string));

  // Null on an open or awaiting-review day, which is the sweep's own case.
  const seal = day.closedAt;

  for (const entry of expected) {
    if (pinned.has(entry.routineId)) continue;
    await placeInstance(ctx, {
      ownerId: owner._id,
      date,
      routineId: entry.routineId,
      scheduleVersionId: entry.scheduleVersionId,
      dayRev: await nextRev(),
      seal,
      tolerateDrift: true,
    });
    report.placed += 1;
  }

  for (const instance of existing) {
    if (!expectedRoutines.has(instance.routineId) && instance.closedAt === null) {
      await removeInstance(ctx, instance, true);
      report.removed += 1;
      continue;
    }

    const cell = { ownerId: owner._id, date, routineId: instance.routineId };
    const current = await resolveCell(ctx, cell, instance.outcomeRev);
    // An Instance that survived a close unsealed is drift too, even when its
    // outcome agrees: the seal is what decides which side of a rate it lands on.
    const unsealed = seal !== null && instance.closedAt === null;
    if (
      !unsealed &&
      current.outcome === instance.outcome &&
      current.resolvedFromMarkId === instance.resolvedFromMarkId
    ) {
      continue;
    }

    await applyResolution(ctx, instance, await resolveCell(ctx, cell, await nextRev()), {
      seal: seal ?? undefined,
      tolerateDrift: true,
    });
    report.resolved += 1;
  }

  await rewriteDayStats(ctx, owner._id, date);
  return report;
}

export async function repairRange(
  ctx: MutationCtx,
  owner: Doc<"owners">,
  from: LocalDate,
  to: LocalDate,
): Promise<RepairReport[]> {
  const versions = await ctx.db
    .query("scheduleVersions")
    .withIndex("by_owner", (q) => q.eq("ownerId", owner._id))
    .collect();

  const reports: RepairReport[] = [];
  for (const date of datesBetween(from, to)) {
    reports.push(await repairDate(ctx, owner, date, versions));
  }
  return reports;
}
