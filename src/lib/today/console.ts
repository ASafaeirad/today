import type { Outcome } from "#domain/outcome";
/**
 * The view model of the console: pure functions from ledger facts to the words
 * and tones the terminal prints. Nothing here reads the network or the DOM.
 */

import { MAX_EAGER_DAYS } from "#domain/constants";
import { addDays, datesBetween, dayOfWeek, type LocalDate } from "#domain/date";

export type RowStatus = Outcome | "open";

/** Track marks and seals the day; plan edits the list and does neither. */
export type Mode = "track" | "plan";

export interface DaySummary {
  date: LocalDate;
  scheduled: number;
  open: number;
  done: number;
  skipped: number;
  missed: number;
  state: "open" | "awaitingReview" | "closed";
  sealed: boolean;
}

/** The three keys, in the order the footer legend prints them. */
export const OPS = [
  { value: "done", key: "D" },
  { value: "missed", key: "M" },
  { value: "skipped", key: "S" },
] as const satisfies readonly { value: Outcome; key: string }[];

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** `fri` — the weekday the strip prints under each date. */
export function weekday(date: LocalDate): string {
  return WEEKDAYS[dayOfWeek(date)]!;
}

/** `2026-09-11 · fri` — the date the top bar carries. */
export function dayLabel(date: LocalDate): string {
  return `${date} · ${weekday(date)}`;
}

/** `09-11 fri` — the same date where the bar has no room for the year. */
export function shortDayLabel(date: LocalDate): string {
  return `${date.slice(5)} ${weekday(date)}`;
}

/**
 * How far back the console can look, today included.
 *
 * Looking back is bounded rather than endless because every date in the window
 * is read eagerly to draw the strip: this is the number of cells under the
 * chrome, and it is what `[` and `]` may step over.
 */
export const STRIP_DAYS = 14;

/** How much of the strip a phone has room for, taken off the near end. */
export const PHONE_STRIP_DAYS = 7;

/** The window the console can open, oldest first, ending at today. */
export function lookbackDates(today: LocalDate, span: number = STRIP_DAYS): LocalDate[] {
  return datesBetween(addDays(today, -(span - 1)), today);
}

/**
 * `4/6` — the day's record at a glance, or an em dash where the schedule put
 * nothing. A run of zeroes and a lapse are different facts, and a cell reading
 * `0/0` would print the second as the first.
 */
export function dayTally(summary: DaySummary): string {
  if (summary.scheduled === 0) return "—";
  return `${summary.done}/${summary.scheduled}`;
}

/** Which meaning the tally carries: the verdict the day arrived at, if any. */
export function dayTone(summary: DaySummary): "done" | "missed" | "neutral" | "empty" {
  if (summary.scheduled === 0) return "empty";
  if (summary.open > 0) return "missed";
  return summary.done === summary.scheduled ? "done" : "neutral";
}

/** What a strip cell says when it is pointed at rather than read. */
export function dayTitle(summary: DaySummary): string {
  const head = `${dayLabel(summary.date)} · `;
  if (summary.scheduled === 0) return `${head}nothing scheduled`;
  if (summary.sealed) return `${head}sealed ${summary.done}/${summary.scheduled} done`;
  return `${head}never sealed · ${summary.open} open`;
}

/**
 * What a past day is once it is open: a record that can no longer be touched,
 * or one that is still every bit as markable as today.
 */
export function lookbackNote(sealed: boolean, open: number): string {
  return sealed ? "sealed record · read only" : `never sealed · ${open} open — still editable`;
}

/** The seal says which day it would close, once that is no longer today. */
export function sealCta(date: LocalDate, today: LocalDate): string {
  return date === today ? "SEAL THE DAY" : `SEAL ${date}`;
}

/**
 * What the row prints. A settled cell shows its outcome whether or not anyone
 * chose it; an unsettled one is open until a Mark says otherwise.
 */
export function rowStatus(row: { outcome: Outcome; marked: boolean; settled: boolean }): RowStatus {
  return row.marked || row.settled ? row.outcome : "open";
}

/**
 * The dates worth summarizing for the nudge: the oldest open days, since the
 * oldest is the one the console asks about first. Bounded like every eager
 * read — past this many an owner is asking for a report, not a nudge.
 */
export function nudgeDates(backlog: readonly LocalDate[], limit = MAX_EAGER_DAYS): LocalDate[] {
  return [...backlog].sort().slice(0, limit);
}

/** `2026-09-10 never sealed · 3 of 6 unresolved` */
export function backlogLine(summary: DaySummary): string {
  return `${summary.date} never sealed · ${summary.open} of ${summary.scheduled} unresolved`;
}

/** The stamp a sealed day wears for good. */
export function sealStamp(date: LocalDate, done: number, scheduled: number): string {
  return `sealed ${date} · ${done}/${scheduled} done`;
}

/** Two-digit line numbers, the way a listing prints them. */
export function pad(count: number): string {
  return String(count).padStart(2, "0");
}

/**
 * A Convex error arrives wrapped and with a stack under it. The owner needs the
 * one sentence the mutation refused with.
 */
export function errorText(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const thrown = lines.find((line) => line.startsWith("Uncaught Error:")) ?? lines[0] ?? raw;
  return thrown.replace(/^Uncaught Error:\s*/u, "").replace(/^(?:\[.*?\]\s*)+/u, "");
}

/**
 * What the console prints of the Balance: what is still spendable, out of what
 * the horizon has minted. The rest of the breakdown belongs to a report, not to
 * a status line — a line that is read mid-tap answers one question.
 */
export interface BalanceView {
  available: number;
  minted: number;
}

/**
 * `skip bank 1/2`. Printed wherever a skip can be bought, so the price of the
 * S key is on screen before it is pressed rather than only in the refusal.
 */
export function balanceLine(balance: BalanceView): string {
  return `skip bank ${balance.available}/${balance.minted}`;
}
