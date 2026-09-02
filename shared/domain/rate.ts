/**
 * Rates are `done / (done + missed)`, never `done / scheduled`. A skipped
 * Instance is on neither side; that is what the Balance is for. ADR-0001.
 */

import { addDays, daysBetween, rangeLength, type LocalDate } from "./date";

export interface RateCounts {
  done: number;
  skipped: number;
  missed: number;
}

export interface Window {
  from: LocalDate;
  to: LocalDate;
}

/**
 * `null` when the denominator is zero: a lapsed or wholly-skipped span reads as
 * *not active* rather than as 0%.
 */
export function completionRate(counts: { done: number; missed: number }): number | null {
  const denominator = counts.done + counts.missed;
  if (denominator === 0) return null;
  return counts.done / denominator;
}

/**
 * A partial period compares against the same elapsed slice of the previous
 * period: August 1-28 against July 1-28, never against all of July. Both
 * periods are clipped by the last closed date common to them.
 */
export function clipComparison(input: {
  current: Window;
  previous: Window;
  lastClosed: LocalDate | null;
}): { current: Window | null; previous: Window | null; elapsedDays: number } {
  const { current, previous, lastClosed } = input;

  const settledDays =
    lastClosed === null || lastClosed < current.from
      ? 0
      : daysBetween(current.from, lastClosed) + 1;

  const elapsedDays = Math.max(
    0,
    Math.min(
      settledDays,
      rangeLength(current.from, current.to),
      rangeLength(previous.from, previous.to),
    ),
  );

  if (elapsedDays === 0) {
    return { current: null, previous: null, elapsedDays: 0 };
  }

  return {
    current: { from: current.from, to: addDays(current.from, elapsedDays - 1) },
    previous: { from: previous.from, to: addDays(previous.from, elapsedDays - 1) },
    elapsedDays,
  };
}
