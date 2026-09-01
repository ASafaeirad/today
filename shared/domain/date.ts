/**
 * Local dates are calendar-date strings in the owner's frozen timezone,
 * assigned once and never recomputed. All arithmetic here is on the string.
 */

export type LocalDate = string;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const MS_PER_DAY = 86_400_000;

export function isLocalDate(value: string): boolean {
  return DATE_PATTERN.test(value);
}

export function assertLocalDate(value: string): LocalDate {
  if (!isLocalDate(value)) throw new Error(`Not a local date: ${value}`);
  return value;
}

function toUtcMs(date: LocalDate): number {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return Date.UTC(year, month - 1, day);
}

function fromUtcMs(ms: number): LocalDate {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Which local date an instant falls on, in the given timezone. */
export function localDateOf(instant: number, timezone: string): LocalDate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instant));
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromUtcMs(toUtcMs(date) + days * MS_PER_DAY);
}

/** Whole days from `from` to `to`; negative when `to` precedes `from`. */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

/** Inclusive length of a date range, or 0 when the range is empty. */
export function rangeLength(from: LocalDate, to: LocalDate): number {
  return Math.max(0, daysBetween(from, to) + 1);
}

/** 0 is Sunday, matching the day-of-week mask. */
export function dayOfWeek(date: LocalDate): number {
  return new Date(toUtcMs(date)).getUTCDay();
}

/** Every date from `from` to `to` inclusive, ascending. */
export function datesBetween(from: LocalDate, to: LocalDate): LocalDate[] {
  const dates: LocalDate[] = [];
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
    dates.push(cursor);
  }
  return dates;
}

export function minDate(a: LocalDate, b: LocalDate): LocalDate {
  return a <= b ? a : b;
}

export function maxDate(a: LocalDate, b: LocalDate): LocalDate {
  return a >= b ? a : b;
}

/** The first date of the month `date` falls in. */
export function startOfMonth(date: LocalDate): LocalDate {
  return `${date.slice(0, 7)}-01`;
}

/** The last date of the month `date` falls in. */
export function endOfMonth(date: LocalDate): LocalDate {
  const [year, month] = date.split("-").map(Number) as [number, number];
  return fromUtcMs(Date.UTC(year, month, 1) - MS_PER_DAY);
}

/** One entry per calendar month the range touches, clipped to the range. */
export function monthChunks(from: LocalDate, to: LocalDate): { from: LocalDate; to: LocalDate }[] {
  const chunks: { from: LocalDate; to: LocalDate }[] = [];
  let cursor = from;
  while (cursor <= to) {
    const chunkEnd = minDate(endOfMonth(cursor), to);
    chunks.push({ from: cursor, to: chunkEnd });
    cursor = addDays(chunkEnd, 1);
  }
  return chunks;
}
