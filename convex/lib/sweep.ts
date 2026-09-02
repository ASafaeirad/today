import { MAX_SWEEP_DAYS, MAX_SWEEP_PLACEMENTS } from "#domain/constants";
import { addDays, datesBetween, minDate, type LocalDate } from "#domain/date";
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
 *
 * The sweep is bounded, because a backlog is not: an owner returning after two
 * years with a dozen routines is thousands of Instances and their aggregate
 * writes, which is more than one Convex transaction holds. Past either bound
 * this pins what it can and reports `caughtUp: false`, and the watermark it
 * commits is where the next chunk resumes. The bounds are checked at a date
 * boundary only: half a date's roster is a hole, not progress.
 */
export interface SweepResult {
  owner: Doc<"owners">;
  caughtUp: boolean;
}

export async function sweepTo(
  ctx: MutationCtx,
  owner: Doc<"owners">,
  today: LocalDate,
): Promise<SweepResult> {
  if (owner.pinsThroughDate >= today) return { owner, caughtUp: true };

  const versions = await ctx.db
    .query("scheduleVersions")
    .withIndex("by_owner", (q) => q.eq("ownerId", owner._id))
    .collect();

  let pinnedThrough = owner.pinsThroughDate;
  let placed = 0;

  for (const date of datesBetween(
    // The watermark is the last pinned date, so start the day after it.
    addDays(owner.pinsThroughDate, 1),
    minDate(today, addDays(owner.pinsThroughDate, MAX_SWEEP_DAYS)),
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
      placed += 1;
    }
    pinnedThrough = date;
    if (placed >= MAX_SWEEP_PLACEMENTS) break;
  }

  await ctx.db.patch(owner._id, { pinsThroughDate: pinnedThrough });
  return {
    owner: (await ctx.db.get(owner._id))!,
    caughtUp: pinnedThrough >= today,
  };
}

/**
 * The sweep as a write path owes it. A backlog too large to pin in one
 * transaction is not pinned *partly* here: the mutation is refused, because
 * writing against a watermark still behind today is exactly the retroactive
 * reshaping the obligation exists to prevent. `owners.sweep` is the path that
 * advances the watermark in committed chunks, and every other mutation works
 * again once it has caught up.
 */
export async function sweepBeforeWrite(
  ctx: MutationCtx,
  owner: Doc<"owners">,
  today: LocalDate,
): Promise<Doc<"owners">> {
  const swept = await sweepTo(ctx, owner, today);
  if (!swept.caughtUp) {
    throw new Error(
      `Instances are pinned through ${swept.owner.pinsThroughDate} but today is ${today}, ` +
        `over the sweep limit of ${MAX_SWEEP_DAYS} days or ${MAX_SWEEP_PLACEMENTS} Instances. ` +
        `Call owners.sweep until it reports caughtUp.`,
    );
  }
  return swept.owner;
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
