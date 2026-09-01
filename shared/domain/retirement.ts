/**
 * The retirement counter is derived, never stored: consecutive scheduled
 * misses, stepping over paused and unscheduled days rather than resetting on
 * them. Instances exist only for scheduled dates, so a descending range over
 * one routine's settled Instances *is* the sequence of scheduled occurrences.
 */

import type { Outcome } from "./outcome";

import { RETIREMENT_THRESHOLD } from "./constants";

/** Counts leading `missed` outcomes and stops. Newest first. */
export function consecutiveMisses(settledOutcomesNewestFirst: readonly Outcome[]): number {
  let count = 0;
  for (const outcome of settledOutcomesNewestFirst) {
    if (outcome !== "missed") break;
    count += 1;
  }
  return count;
}

/** Retirement is offered, never imposed. */
export function shouldSuggestRetirement(consecutive: number): boolean {
  return consecutive >= RETIREMENT_THRESHOLD;
}
