/**
 * The view model of the console: pure functions from ledger facts to the words
 * and tones the terminal prints. Nothing here reads the network or the DOM.
 */

import type { Outcome } from "#domain/outcome";

import { MAX_EAGER_DAYS } from "#domain/constants";
import { dayOfWeek, type LocalDate } from "#domain/date";

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

/** `2026-09-11 · fri` — the date the top bar carries. */
export function dayLabel(date: LocalDate): string {
  return `${date} · ${WEEKDAYS[dayOfWeek(date)]}`;
}

/** `09-11 fri` — the same date where the bar has no room for the year. */
export function shortDayLabel(date: LocalDate): string {
  return `${date.slice(5)} ${WEEKDAYS[dayOfWeek(date)]}`;
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
