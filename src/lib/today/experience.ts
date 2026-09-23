/**
 * The view model of progression: pure functions from banked facts to the words
 * the console prints. The arithmetic itself lives in `#domain/experience` and
 * is the server's; nothing here computes a reward.
 */

import type { LocalDate } from "#domain/date";

import {
  bandEnds,
  closingExperience,
  levelProgress,
  streakMultiplier,
  titleFor,
  type LevelProgress,
} from "#domain/experience";

/** What one closed day banked, as the console reads it back. */
export interface AwardView {
  total: number;
  doneExperience: number;
  baseExperience: number;
  streakExperience: number;
  /** An older awaiting-review day is still gating the streak part. */
  held: boolean;
  streak: number | null;
  multiplier: number | null;
}

/** The banked side of progression, as the server keeps it. */
export interface ProgressionView {
  experience: number;
  streak: number;
  multiplier: number;
  heldDays: number;
  caughtUp: boolean;
  backfill: { days: number; experience: number } | null;
}

/** Everything the bar under the chrome prints, in one shape. */
export interface LevelView extends LevelProgress {
  /** `06` — the level as a plate, two digits wide the way a listing pads. */
  plate: string;
  /** `6/120 to lv 7` */
  span: number;
  spanLine: string;
  /** `1284 XP` */
  lifetimeLine: string;
}

export function levelView(experience: number): LevelView {
  const progress = levelProgress(experience);
  return {
    ...progress,
    plate: String(progress.level).padStart(2, "0"),
    spanLine: `${progress.into}/${progress.span} to lv ${progress.level + 1}`,
    lifetimeLine: `${experience} XP`,
  };
}

/** `NO-MISS 3D ×1.50` — the run and what it is worth, in one reading. */
export function streakLine(streak: number, multiplier: number): string {
  return `NO-MISS ${streak}D ×${multiplier.toFixed(2)}`;
}

/** `BONUS HELD · 2D` — closed days whose streak part is waiting on an older one. */
export function heldLine(heldDays: number): string {
  return `BONUS HELD · ${heldDays}D`;
}

/** `+3 XP PENDING` — shown for done marks, banked by nothing until the close. */
export function pendingLine(pending: number): string {
  return `+${pending} XP PENDING`;
}

/**
 * What the close would bank, projected from the day as it stands: the done
 * marks plus the closing reward at the streak this day would produce.
 *
 * A miss on the day takes the multiplier with it, which is the point of showing
 * this before the seal rather than after it. An empty day says so instead of
 * projecting a reward it cannot pay.
 */
export function closeProjection(
  counts: { scheduled: number; done: number; missed: number },
  streak: number,
): string {
  if (counts.scheduled === 0) return "empty day · no xp";
  const projected = counts.missed > 0 ? 0 : streak + 1;
  return `close banks +${counts.done + closingExperience(projected)} xp (×${streakMultiplier(projected).toFixed(2)})`;
}

/**
 * The XP column of the log. A held day is flagged rather than footnoted: the
 * number is real and already banked, it is simply not the last word.
 *
 * A closed day with no award had nothing scheduled; an open one has banked
 * nothing yet. The two are different facts and read as different marks.
 */
export function logExperience(award: AwardView | null, sealed: boolean): string {
  if (award === null) return sealed ? "—" : "·";
  return `+${award.total}${award.held ? " •" : ""}`;
}

/** The one-time summary of history already counted in the owner's total. */
export function backfillLine(days: number, experience: number): string {
  return `We counted ${days.toLocaleString()} closed ${days === 1 ? "day" : "days"} and added ${experience.toLocaleString()} XP to your total.`;
}

/** What a receipt says about crossing into a new title band. */
export function bandNote(level: number): string {
  const ends = bandEnds(level);
  return ends === null
    ? `${titleFor(level)} is the last title — it holds from here on`
    : `title band holds through lv ${ends}`;
}

export interface ReceiptView {
  date: LocalDate;
  eligible: boolean;
  doneExperience: number;
  baseExperience: number;
  streakExperience: number;
  held: boolean;
  streak: number | null;
  multiplier: number | null;
  reset: boolean;
  released: number;
  total: number;
  experienceBefore: number;
  experienceAfter: number;
  levelBefore: number;
  levelAfter: number;
}

/** One line of the receipt: what it was for, and what it was worth. */
export interface ReceiptLine {
  id: string;
  label: string;
  value: string;
  tone: "done" | "seal" | "skipped" | "muted";
}

/**
 * The receipt, line by line, in the order a receipt is read: what the marks
 * earned, what closing earned, what the run multiplied it by, and what settling
 * the backlog released.
 */
export function receiptLines(receipt: ReceiptView): ReceiptLine[] {
  const lines: ReceiptLine[] = [];

  if (!receipt.eligible) {
    lines.push({
      id: "empty",
      label: "empty roster",
      value: "no experience",
      tone: "muted",
    });
  } else {
    lines.push({
      id: "done",
      label: `done marks × ${receipt.doneExperience}`,
      value: `+${receipt.doneExperience} xp`,
      tone: "done",
    });
    lines.push({
      id: "base",
      label: "closing the day",
      value: `+${receipt.baseExperience} xp`,
      tone: "muted",
    });
    lines.push(
      receipt.held
        ? { id: "streak", label: "no-miss streak bonus", value: "held", tone: "skipped" }
        : {
            id: "streak",
            label: `no-miss streak ${receipt.streak ?? 0}d ×${(receipt.multiplier ?? 1).toFixed(2)}`,
            value: `${receipt.streakExperience > 0 ? "+" : ""}${receipt.streakExperience} xp`,
            tone: receipt.streakExperience > 0 ? "seal" : "muted",
          },
    );
  }

  if (receipt.released > 0) {
    lines.push({
      id: "released",
      label: "released from settled backlog",
      value: `+${receipt.released} xp`,
      tone: "seal",
    });
  }

  return lines;
}

/** `+21 XP` — everything this close banked, on this day and the ones it freed. */
export function bankedTotal(receipt: ReceiptView): string {
  return `+${receipt.total} XP`;
}

export function leveledUp(receipt: ReceiptView): boolean {
  return receipt.levelAfter > receipt.levelBefore;
}

/** `level up · 5 → 6` */
export function levelUpLine(receipt: ReceiptView): string {
  return `level up · ${receipt.levelBefore} → ${receipt.levelAfter}`;
}

export const RESET_NOTE =
  "no-miss streak reset to 0. the 10 xp for closing is still yours — a clean day starts the run again.";

export const HELD_NOTE =
  "an older day is still awaiting review. base reward banked now; the streak bonus follows once that day is settled.";

/** What a mark says about its pending experience, to whoever is listening. */
export function markAnnouncement(outcome: string | null, wasDone: boolean): string {
  if (outcome === "done") {
    return "marked done. plus one experience pending — it banks when you close the day.";
  }
  if (wasDone) return "done mark removed. its pending experience was removed too.";
  return `marked ${outcome ?? "open"}. no experience for this outcome.`;
}

/** What a close says once it has banked. */
export function bankedAnnouncement(receipt: ReceiptView): string {
  const level = leveledUp(receipt)
    ? ` level ${receipt.levelAfter}, ${titleFor(receipt.levelAfter)}.`
    : "";
  return `day closed. banked ${receipt.total} experience.${level}`;
}
