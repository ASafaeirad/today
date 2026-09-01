/**
 * The schedule is an interval log. One row states one routine's day-of-week
 * mask over one dated range, and every schedule operation is the same
 * primitive: close plus open.
 *
 * - Edit: close the frontier row at today, open the next at tomorrow.
 * - Pause: open a row with `dowMask = 0`. A paused routine is not scheduled.
 * - End a pause early: close the mask-0 row, open the next.
 * - Retire: close the frontier row and open nothing. Un-retire: open a new row.
 * - Lapse: no row covers the span. Not a null, not a flag, no rows.
 */

import { dayOfWeek, type LocalDate } from "./date";

export const EVERY_DAY = 0b111_1111;
export const PAUSED = 0;

export interface ScheduleVersionLike<
  Id extends string = string,
  RoutineId extends string = string,
> {
  _id: Id;
  routineId: RoutineId;
  seq: number;
  dowMask: number;
  activeFrom: LocalDate;
  activeUntil: LocalDate | null;
}

export interface RosterEntry<Id extends string = string, RoutineId extends string = string> {
  routineId: RoutineId;
  scheduleVersionId: Id;
}

export function maskFromDays(days: readonly number[]): number {
  return days.reduce((mask, day) => mask | (1 << day), 0);
}

export function daysFromMask(mask: number): number[] {
  return [0, 1, 2, 3, 4, 5, 6].filter((day) => (mask & (1 << day)) !== 0);
}

export function coversDate(version: ScheduleVersionLike, date: LocalDate): boolean {
  return (
    version.activeFrom <= date && (version.activeUntil === null || date <= version.activeUntil)
  );
}

/** A paused or lapsed routine is not scheduled: no Instance, so no miss. */
export function placesOn(version: ScheduleVersionLike, date: LocalDate): boolean {
  return coversDate(version, date) && (version.dowMask & (1 << dayOfWeek(date))) !== 0;
}

/**
 * The complete set of Instances one local date should carry, fixed against the
 * schedule versions in force on that date. Sorted by routine so two runs of the
 * same inputs produce the same roster.
 */
export function rosterFor<Id extends string, RoutineId extends string>(
  date: LocalDate,
  versions: readonly ScheduleVersionLike<Id, RoutineId>[],
): RosterEntry<Id, RoutineId>[] {
  return versions
    .filter((version) => placesOn(version, date))
    .map((version) => ({
      routineId: version.routineId,
      scheduleVersionId: version._id,
    }))
    .sort((a, b) => (a.routineId < b.routineId ? -1 : a.routineId > b.routineId ? 1 : 0));
}

/** The row that covers `date` for one routine, or undefined during a lapse. */
export function versionCovering<Id extends string, RoutineId extends string>(
  date: LocalDate,
  versions: readonly ScheduleVersionLike<Id, RoutineId>[],
): ScheduleVersionLike<Id, RoutineId> | undefined {
  return versions.find((version) => coversDate(version, date));
}

/**
 * The three invariants of the interval log, checked by the one mutation that
 * is allowed to write the table.
 */
export function checkScheduleWrite(
  frontier: ScheduleVersionLike | undefined,
  today: LocalDate,
  change: { closeAt?: LocalDate | null; openFrom?: LocalDate },
): string | null {
  if (frontier !== undefined && change.closeAt !== undefined) {
    if (frontier.activeUntil !== null && frontier.activeUntil < today) {
      return "A schedule version whose activeUntil is before today is immutable";
    }
    if (change.closeAt !== null && change.closeAt < today) {
      return "The frontier row can retract future coverage, never past coverage";
    }
  }
  if (change.openFrom !== undefined && change.openFrom < today) {
    return "A new schedule version's activeFrom is today or later";
  }
  return null;
}
