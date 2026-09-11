/**
 * The view model of the console: pure functions from ledger facts to the words
 * and tones the terminal prints. Nothing here reads the network or the DOM.
 */

import type { Outcome } from "#domain/outcome";

import { MAX_EAGER_DAYS } from "#domain/constants";
import { addDays, dayOfWeek, type LocalDate } from "#domain/date";

export type RowStatus = Outcome | "open";

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

export interface SlotStatus {
  text: string;
  tone: "inherit" | "done" | "seal";
}

/** The three keys, in the order the footer legend prints them. */
export const OPS = [
  { value: "done", key: "D" },
  { value: "missed", key: "M" },
  { value: "skipped", key: "S" },
] as const satisfies readonly { value: Outcome; key: string }[];

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

/** How many recent dates the strip always shows, today included. */
export const STRIP_LENGTH = 7;

/** `2026-08-28 FRI` */
export function dayLabel(date: LocalDate): string {
  return `${date} ${WEEKDAYS[dayOfWeek(date)]}`;
}

/** `TODAY`, or `27 THU` for any other date. */
export function slotLabel(date: LocalDate, today: LocalDate): string {
  if (date === today) return "TODAY";
  return `${date.slice(8)} ${WEEKDAYS[dayOfWeek(date)]}`;
}

/** Today and the dates before it, newest first. */
export function recentDates(today: LocalDate, length = STRIP_LENGTH): LocalDate[] {
  return Array.from({ length }, (_, offset) => addDays(today, -offset));
}

/**
 * The dates worth asking about: the recent window plus every open past date,
 * newest first, capped at what one eager read may cover.
 */
export function stripDates(
  today: LocalDate,
  backlog: readonly LocalDate[],
  limit = MAX_EAGER_DAYS,
): LocalDate[] {
  const dates = new Set(recentDates(today));
  for (const date of backlog) if (date < today) dates.add(date);
  return [...dates].sort((a, b) => (a > b ? -1 : a < b ? 1 : 0)).slice(0, limit);
}

/**
 * Which of those dates earn a slot. The recent window always does; an older
 * date only while something on it still needs the owner.
 */
export function visibleDates(
  dates: readonly LocalDate[],
  summaries: ReadonlyMap<LocalDate, DaySummary>,
  today: LocalDate,
): LocalDate[] {
  const recent = new Set(recentDates(today));
  return dates.filter((date) => {
    if (recent.has(date)) return true;
    const summary = summaries.get(date);
    return summary !== undefined && summary.scheduled > 0 && !summary.sealed;
  });
}

export function slotStatus(summary: DaySummary | undefined): SlotStatus {
  if (summary === undefined) return { text: "...", tone: "inherit" };
  if (summary.sealed) return { text: "SEALED", tone: "seal" };
  if (summary.scheduled === 0) return { text: "NO DATA", tone: "inherit" };
  if (summary.open > 0) return { text: `${pad(summary.open)} OPEN`, tone: "inherit" };
  return { text: "READY", tone: "done" };
}

/**
 * What the row prints. A settled cell shows its outcome whether or not anyone
 * chose it; an unsettled one is open until a Mark says otherwise.
 */
export function rowStatus(row: { outcome: Outcome; marked: boolean; settled: boolean }): RowStatus {
  return row.marked || row.settled ? row.outcome : "open";
}

/** Earlier days that are neither sealed nor fully marked. */
export function countBacklog(summaries: Iterable<DaySummary>, today: LocalDate): number {
  let count = 0;
  for (const summary of summaries) {
    if (summary.date < today && !summary.sealed && summary.open > 0) count += 1;
  }
  return count;
}

/** The instant a day was closed, as a wall clock in the owner's zone. */
export function clockIn(instant: number, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(instant));
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
