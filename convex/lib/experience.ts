import { MAX_PROGRESSION_DAYS } from "#domain/constants";
import { addDays, datesBetween, minDate, type LocalDate } from "#domain/date";
import {
  awardFor,
  heldAwardFor,
  isEligible,
  levelOf,
  type DayAward,
  type DayCounts,
} from "#domain/experience";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

import { findDay } from "./days";
import { instancesOn } from "./instances";

/**
 * Banking, in two phases that answer to two watermarks.
 *
 * Phase one writes the award for the day that just closed: the done marks and
 * the base reward, which nothing else in the ledger can change. Phase two walks
 * the calendar forward from the last date whose place in the run is final and
 * settles the streak part of every award it passes, stopping at the first
 * eligible day nobody has closed.
 *
 * The split is what makes review order irrelevant. A day closed over an older
 * awaiting-review day banks immediately and holds only the part that depends on
 * where the run stands; settling the older day releases the rest in date order,
 * so the same settled history always comes to the same total.
 *
 * Awards are frozen once written. An Amendment to a closed day changes the
 * record and not the progression: the counts the award cites are the ones that
 * stood at close, and they stay in the row as evidence. ADR-0005.
 */

export type ProgressionRow = Doc<"progression">;

export function findProgression(
  ctx: QueryCtx | MutationCtx,
  ownerId: Id<"owners">,
): Promise<ProgressionRow | null> {
  return ctx.db
    .query("progression")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .unique();
}

export async function ensureProgression(
  ctx: MutationCtx,
  ownerId: Id<"owners">,
): Promise<ProgressionRow> {
  const existing = await findProgression(ctx, ownerId);
  if (existing) return existing;
  const id = await ctx.db.insert("progression", {
    ownerId,
    experience: 0,
    settledThrough: null,
    bankedThrough: null,
    streak: 0,
    backfilledDays: 0,
    backfilledExperience: 0,
    backfilledAt: null,
    acknowledgedAt: null,
  });
  return (await ctx.db.get(id))!;
}

export function findAward(
  ctx: QueryCtx | MutationCtx,
  ownerId: Id<"owners">,
  date: LocalDate,
): Promise<Doc<"dayAwards"> | null> {
  return ctx.db
    .query("dayAwards")
    .withIndex("by_owner_date", (q) => q.eq("ownerId", ownerId).eq("date", date))
    .unique();
}

/** Awards whose streak part is still held, oldest first. */
export function heldAwards(
  ctx: QueryCtx | MutationCtx,
  ownerId: Id<"owners">,
  settledThrough: LocalDate | null,
): Promise<Doc<"dayAwards">[]> {
  return ctx.db
    .query("dayAwards")
    .withIndex("by_owner_date", (q) =>
      settledThrough === null
        ? q.eq("ownerId", ownerId)
        : q.eq("ownerId", ownerId).gt("date", settledThrough),
    )
    .take(MAX_PROGRESSION_DAYS);
}

/**
 * The counts an award is computed from. Read off the Instances rather than off
 * `dayStats`, because the award is written inside the same close that settled
 * them and the projection is rewritten in the same transaction.
 */
export async function countsOn(
  ctx: QueryCtx | MutationCtx,
  ownerId: Id<"owners">,
  date: LocalDate,
): Promise<DayCounts> {
  const instances = await instancesOn(ctx, ownerId, date);
  const counts: DayCounts = { scheduled: instances.length, done: 0, skipped: 0, missed: 0 };
  for (const instance of instances) counts[instance.outcome] += 1;
  return counts;
}

/** One index lookup: whether the sweep placed anything on this date at all. */
async function hasRoster(
  ctx: QueryCtx | MutationCtx,
  ownerId: Id<"owners">,
  date: LocalDate,
): Promise<boolean> {
  const first = await ctx.db
    .query("instances")
    .withIndex("by_owner_date", (q) => q.eq("ownerId", ownerId).eq("date", date))
    .first();
  return first !== null;
}

/**
 * Phase one. Writes what this day banks that nothing else determines, and adds
 * it to the lifetime total right away.
 *
 * Idempotent per owner and local date: a second close, a retried request or a
 * reused close key finds the award already written and banks nothing. An empty
 * roster writes no row at all — there was nothing to do, which is not the same
 * fact as nothing done.
 */
export async function bankDay(
  ctx: MutationCtx,
  ownerId: Id<"owners">,
  date: LocalDate,
): Promise<Doc<"dayAwards"> | null> {
  if (await findAward(ctx, ownerId, date)) return null;

  const counts = await countsOn(ctx, ownerId, date);
  if (!isEligible(counts)) return null;

  const held = heldAwardFor(counts);
  const id = await ctx.db.insert("dayAwards", {
    ownerId,
    date,
    ...counts,
    doneExperience: held.doneExperience,
    baseExperience: held.baseExperience,
    streakExperience: 0,
    settled: false,
    streak: null,
    multiplier: null,
    total: held.total,
    bankedAt: Date.now(),
  });

  const progression = await ensureProgression(ctx, ownerId);
  await ctx.db.patch(progression._id, { experience: progression.experience + held.total });
  return (await ctx.db.get(id))!;
}

export interface SettleResult {
  /** Experience banked by settling awards, keyed by the day it belonged to. */
  released: Map<LocalDate, number>;
  /** Where the run stands now, and how far the walk got. */
  streak: number;
  settledThrough: LocalDate | null;
  /** False when the walk ran out of budget and owes a continuation. */
  complete: boolean;
}

/**
 * Phase two. Walks the calendar forward from the watermark and settles every
 * award it passes, in date order.
 *
 * It stops at the first eligible day that has no award, which is the one shape
 * the run cannot be read through: a past day awaiting review, or today, still
 * open. Everything beyond it keeps its base and waits. Empty dates and lapses
 * are stepped over — neither advances nor breaks the run.
 *
 * Bounded like every other walk over the calendar here, and resumable from the
 * watermark it commits, so a long absence converges in chunks instead of
 * failing in one transaction.
 */
export async function settle(
  ctx: MutationCtx,
  ownerId: Id<"owners">,
  today: LocalDate,
): Promise<SettleResult> {
  const progression = await ensureProgression(ctx, ownerId);
  const released = new Map<LocalDate, number>();
  const from = await walkStart(ctx, ownerId, progression.settledThrough);

  if (from === null || from > today) {
    return {
      released,
      streak: progression.streak,
      settledThrough: progression.settledThrough,
      complete: true,
    };
  }

  const last = minDate(today, addDays(from, MAX_PROGRESSION_DAYS - 1));
  let { streak } = progression;
  let watermark = progression.settledThrough;
  let banked = 0;
  // The walk owes a continuation only if it ran out of calendar before it ran
  // out of budget. Stopping at a gap is finished work: nothing past that day is
  // knowable until somebody reviews it.
  let complete = last >= today;

  for (const date of datesBetween(from, last)) {
    const award = await findAward(ctx, ownerId, date);

    if (award === null) {
      if (await hasRoster(ctx, ownerId, date)) {
        complete = true;
        break;
      }
      watermark = date;
      continue;
    }

    if (award.settled) {
      streak = award.streak ?? 0;
    } else {
      const final = awardFor(countsOf(award), streak);
      const delta = final.total - award.total;
      banked += delta;
      released.set(date, delta);
      await ctx.db.patch(award._id, {
        streakExperience: final.streakExperience,
        settled: true,
        streak: final.streak,
        multiplier: final.multiplier,
        total: final.total,
      });
      ({ streak } = final);
    }
    watermark = date;
  }

  await ctx.db.patch(progression._id, {
    streak,
    settledThrough: watermark,
    experience: progression.experience + banked,
    // A walk that ran out of budget owes a continuation, and the client drives
    // those off `bankedThrough`. Rolling it back to where this walk stopped is
    // what puts the rest of the calendar back in front of it; the creation walk
    // it re-covers is idempotent, so the second pass writes nothing new.
    ...(complete ? {} : { bankedThrough: watermark }),
  });

  return { released, streak, settledThrough: watermark, complete };
}

function countsOf(award: Doc<"dayAwards">): DayCounts {
  return {
    scheduled: award.scheduled,
    done: award.done,
    skipped: award.skipped,
    missed: award.missed,
  };
}

/**
 * Where the walk picks up: the day after the watermark, or the owner's very
 * first dated day when there is no watermark yet.
 */
async function walkStart(
  ctx: QueryCtx | MutationCtx,
  ownerId: Id<"owners">,
  watermark: LocalDate | null,
): Promise<LocalDate | null> {
  if (watermark !== null) return addDays(watermark, 1);
  const first = await ctx.db
    .query("days")
    .withIndex("by_owner_date", (q) => q.eq("ownerId", ownerId))
    .order("asc")
    .take(1);
  return first[0]?.date ?? null;
}

export interface CatchUpResult {
  /** Awards this pass wrote, and what the whole pass added to the lifetime. */
  created: number;
  banked: number;
  /** False while the walk still owes a continuation. */
  complete: boolean;
}

/**
 * The walk over history that writes the awards a close never got to write:
 * everything an owner had already closed before progression existed.
 *
 * It answers to its own watermark, because it must not stop where the settle
 * walk stops. A day awaiting review holds the *streak* part of everything after
 * it; it does not hold the base, so the creation walk steps over the gap and
 * lets the settle walk decide what is knowable.
 *
 * Idempotent and resumable: an award already written is left alone, and the
 * watermark it commits is where the next chunk picks up.
 */
export async function catchUp(
  ctx: MutationCtx,
  ownerId: Id<"owners">,
  today: LocalDate,
): Promise<CatchUpResult> {
  const progression = await ensureProgression(ctx, ownerId);
  // Only the first pass over history is a backfill. Once it has reached today,
  // every later close is an ordinary bank and belongs in no summary.
  const summarizing = progression.backfilledAt === null;
  const before = progression.experience;
  const from = await walkStart(ctx, ownerId, progression.bankedThrough);
  const last = from === null ? today : minDate(today, addDays(from, MAX_PROGRESSION_DAYS - 1));
  let created = 0;

  if (from !== null && from <= today) {
    for (const date of datesBetween(from, last)) {
      const day = await findDay(ctx, ownerId, date);
      if (day?.closedAt != null && (await bankDay(ctx, ownerId, date))) created += 1;
    }
  }

  const caughtUp = last >= today;
  await ctx.db.patch(progression._id, {
    bankedThrough: last,
    backfilledAt: caughtUp ? (progression.backfilledAt ?? Date.now()) : null,
  });

  const settled = await settle(ctx, ownerId, today);
  const current = (await findProgression(ctx, ownerId))!;
  const banked = current.experience - before;

  if (summarizing && banked !== 0) {
    await ctx.db.patch(current._id, {
      backfilledDays: current.backfilledDays + created,
      backfilledExperience: current.backfilledExperience + banked,
    });
  }

  return { created, banked, complete: caughtUp && settled.complete };
}

/**
 * The rollup, refolded from the awards that are its evidence.
 *
 * Nothing here recomputes a reward: the awards are frozen facts and this is a
 * sum over them, which is the property the rest of the ledger holds too — any
 * stored aggregate must be rebuildable by the same arithmetic that wrote it.
 *
 * The two watermarks land on the last award rather than on the last date, which
 * is safe in the only direction that matters: a watermark behind where it was
 * makes the next walk re-read a few settled dates and write nothing.
 */
export async function rebuildProgression(
  ctx: MutationCtx,
  ownerId: Id<"owners">,
): Promise<ProgressionRow> {
  const progression = await ensureProgression(ctx, ownerId);
  const awards = await ctx.db
    .query("dayAwards")
    .withIndex("by_owner_date", (q) => q.eq("ownerId", ownerId))
    .collect();

  let experience = 0;
  let streak = 0;
  let settledThrough: LocalDate | null = null;
  let bankedThrough: LocalDate | null = null;

  for (const award of awards) {
    experience += award.total;
    bankedThrough = award.date;
    if (!award.settled) continue;
    streak = award.streak ?? 0;
    settledThrough = award.date;
  }

  await ctx.db.patch(progression._id, { experience, streak, settledThrough, bankedThrough });
  return (await ctx.db.get(progression._id))!;
}

export interface Receipt {
  date: LocalDate;
  /** False on a day the schedule put nothing on, which banks nothing. */
  eligible: boolean;
  doneExperience: number;
  baseExperience: number;
  streakExperience: number;
  /** True while an older awaiting-review day is holding the streak part. */
  held: boolean;
  streak: number | null;
  multiplier: number | null;
  reset: boolean;
  /** Experience this close released on *other* days, by settling the gap. */
  released: number;
  /** Everything this close banked, on this day and on the ones it freed. */
  total: number;
  experienceBefore: number;
  experienceAfter: number;
  levelBefore: number;
  levelAfter: number;
}

/**
 * What one close banked, in the terms the receipt reads them back in. Returned
 * by `days.close` so the dialog can print it without a second read.
 */
export async function bankClose(
  ctx: MutationCtx,
  ownerId: Id<"owners">,
  today: LocalDate,
  date: LocalDate,
): Promise<Receipt> {
  const before = (await ensureProgression(ctx, ownerId)).experience;
  await bankDay(ctx, ownerId, date);
  const result = await settle(ctx, ownerId, today);
  const award = await findAward(ctx, ownerId, date);
  const after = (await findProgression(ctx, ownerId))!.experience;

  let released = 0;
  for (const [day, amount] of result.released) if (day !== date) released += amount;

  return {
    ...receiptLines(award),
    date,
    released,
    total: after - before,
    experienceBefore: before,
    experienceAfter: after,
    levelBefore: levelOf(before),
    levelAfter: levelOf(after),
  };
}

/** The part of a receipt that is about the day itself rather than the ledger. */
function receiptLines(award: Doc<"dayAwards"> | null) {
  if (award === null) {
    return {
      eligible: false,
      doneExperience: 0,
      baseExperience: 0,
      streakExperience: 0,
      held: false,
      streak: null,
      multiplier: null,
      reset: false,
    };
  }
  return {
    eligible: true,
    doneExperience: award.doneExperience,
    baseExperience: award.baseExperience,
    streakExperience: award.streakExperience,
    held: !award.settled,
    streak: award.streak,
    multiplier: award.multiplier,
    reset: award.settled && award.streak === 0 && award.missed > 0,
  };
}

/** The receipt a close that banked nothing still owes the dialog. */
export function emptyReceipt(date: LocalDate, experience: number): Receipt {
  return {
    date,
    eligible: false,
    doneExperience: 0,
    baseExperience: 0,
    streakExperience: 0,
    held: false,
    streak: null,
    multiplier: null,
    reset: false,
    released: 0,
    total: 0,
    experienceBefore: experience,
    experienceAfter: experience,
    levelBefore: levelOf(experience),
    levelAfter: levelOf(experience),
  };
}

export type { DayAward };
