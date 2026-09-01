import { addDays, type LocalDate } from "#domain/date";
import { checkScheduleWrite } from "#domain/schedule";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export function versionsFor(
  ctx: QueryCtx | MutationCtx,
  ownerId: Id<"owners">,
  routineId: Id<"routines">,
): Promise<Doc<"scheduleVersions">[]> {
  return ctx.db
    .query("scheduleVersions")
    .withIndex("by_owner_routine_seq", (q) => q.eq("ownerId", ownerId).eq("routineId", routineId))
    .collect();
}

/** The newest row. Everything below it is immutable. */
export function frontierOf(
  versions: readonly Doc<"scheduleVersions">[],
): Doc<"scheduleVersions"> | undefined {
  return versions.at(-1);
}

export async function openVersion(
  ctx: MutationCtx,
  row: {
    ownerId: Id<"owners">;
    routineId: Id<"routines">;
    seq: number;
    dowMask: number;
    activeFrom: LocalDate;
  },
): Promise<Doc<"scheduleVersions">> {
  const id = await ctx.db.insert("scheduleVersions", {
    ...row,
    activeUntil: null,
  });
  return (await ctx.db.get(id))!;
}

/**
 * The one write path to the interval log, and the only place the three
 * invariants are enforced:
 *
 * - a row whose `activeUntil` is before today is immutable;
 * - the frontier row's `activeUntil` may only be set to today or later, so it
 *   can retract future coverage but never past coverage;
 * - a new row's `activeFrom` is today or later.
 *
 * Every schedule operation is close plus open. `nextMask` of `null` opens
 * nothing, which is a retirement; a mask of 0 is a pause; no row at all is a
 * lapse.
 */
export async function closePlusOpen(
  ctx: MutationCtx,
  input: {
    owner: Doc<"owners">;
    today: LocalDate;
    routineId: Id<"routines">;
    nextMask: number | null;
  },
): Promise<{ closed: Id<"scheduleVersions"> | null; opened: Id<"scheduleVersions"> | null }> {
  const { owner, today, routineId, nextMask } = input;
  const tomorrow = addDays(today, 1);
  const versions = await versionsFor(ctx, owner._id, routineId);
  const frontier = frontierOf(versions);

  // A row that starts tomorrow has never taken effect and no Instance cites it,
  // so a second change on the same day rewrites it rather than stacking rows.
  if (frontier !== undefined && frontier.activeFrom > today) {
    if (nextMask === null) {
      await ctx.db.delete(frontier._id);
      return { closed: null, opened: null };
    }
    await ctx.db.patch(frontier._id, { dowMask: nextMask });
    return { closed: null, opened: frontier._id };
  }

  let closed: Id<"scheduleVersions"> | null = null;
  if (frontier !== undefined && (frontier.activeUntil === null || frontier.activeUntil >= today)) {
    const violation = checkScheduleWrite(frontier, today, { closeAt: today });
    if (violation) throw new Error(violation);
    await ctx.db.patch(frontier._id, { activeUntil: today });
    closed = frontier._id;
  }

  if (nextMask === null) return { closed, opened: null };

  const violation = checkScheduleWrite(frontier, today, { openFrom: tomorrow });
  if (violation) throw new Error(violation);

  const opened = await openVersion(ctx, {
    ownerId: owner._id,
    routineId,
    seq: (frontier?.seq ?? -1) + 1,
    dowMask: nextMask,
    activeFrom: tomorrow,
  });

  // The new row starts tomorrow, beyond the watermark, so the next sweep pins
  // it. Nothing lands today, which is the point: an edit is today-forward.
  return { closed, opened: opened._id };
}
