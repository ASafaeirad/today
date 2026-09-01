import { datesBetween, type LocalDate } from "#domain/date";
import { rosterFor } from "#domain/schedule";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

import { ensureDay } from "./days";
import { findInstance, placeInstance } from "./instances";

/**
 * The sweep obligation, and the one correctness property a reviewer cannot
 * verify by reading the tables. ADR-0002.
 *
 * Every mutation sweeps Instances forward to today *before* it writes anything,
 * so an owner who edits a schedule on the 20th after two weeks away gets the
 * 6th through the 20th pinned against the old version first, and only then does
 * the new version take effect. Sweeping afterwards would retroactively reshape
 * a fortnight.
 *
 * `pinsThroughDate` is the watermark and moves only forward, so a re-run writes
 * nothing and two devices converge.
 */
export async function sweepTo(
  ctx: MutationCtx,
  owner: Doc<"owners">,
  today: LocalDate,
): Promise<Doc<"owners">> {
  if (owner.pinsThroughDate >= today) return owner;

  const versions = await ctx.db
    .query("scheduleVersions")
    .withIndex("by_owner", (q) => q.eq("ownerId", owner._id))
    .collect();

  for (const date of datesBetween(
    // The watermark is the last pinned date, so start the day after it.
    nextDate(owner.pinsThroughDate),
    today,
  )) {
    const day = await ensureDay(ctx, owner._id, date);
    for (const entry of rosterFor(date, versions)) {
      await placeInstance(ctx, {
        ownerId: owner._id,
        date,
        routineId: entry.routineId,
        scheduleVersionId: entry.scheduleVersionId,
        dayRev: day.rev,
      });
    }
  }

  await ctx.db.patch(owner._id, { pinsThroughDate: today });
  return (await ctx.db.get(owner._id))!;
}

function nextDate(date: LocalDate): LocalDate {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

/**
 * A schedule version opened at today lands on a date the sweep has already
 * passed, so its Instance is pinned here instead. Idempotent.
 */
export async function pinRoutineOn(
  ctx: MutationCtx,
  input: {
    owner: Doc<"owners">;
    routineId: Id<"routines">;
    version: Doc<"scheduleVersions">;
    date: LocalDate;
  },
): Promise<void> {
  const { owner, routineId, version, date } = input;
  if (date > owner.pinsThroughDate) return;
  if (rosterFor(date, [version]).length === 0) return;

  const cell = { ownerId: owner._id, date, routineId };
  if (await findInstance(ctx, cell)) return;

  const day = await ensureDay(ctx, owner._id, date);
  await placeInstance(ctx, {
    ...cell,
    scheduleVersionId: version._id,
    dayRev: day.rev,
  });
}
