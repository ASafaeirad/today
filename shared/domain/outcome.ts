/**
 * The one place in the system that knows the latest Mark wins.
 *
 * `outcome`, `resolvedFromMarkId` and `outcomeRev` are one claim: they are
 * written together or not at all. Four callers differ only in which cells they
 * resolve - close, append-mark, rebuild and verify - and verify resolves
 * without writing and compares the whole tuple. Tie-breaking lives inside the
 * resolver so the hot path and a rebuild cannot pick different winners.
 */

export type Outcome = "done" | "skipped" | "missed";

export const OUTCOMES: readonly Outcome[] = ["done", "skipped", "missed"];

/**
 * What a Mark says happened. `null` is an Unset: an explicit mark that clears a
 * previous one. Nothing is ever deleted to clear a mark.
 */
export type MarkOutcome = Outcome | null;

export interface MarkLike<Id extends string = string> {
  _id: Id;
  outcome: MarkOutcome;
  serverAt: number;
}

export interface Resolution<Id extends string = string> {
  outcome: Outcome;
  resolvedFromMarkId: Id | null;
  outcomeRev: number;
}

/** The winning Mark for a cell: latest `serverAt`, ties broken by `_id`. */
export function latestMark<Id extends string>(
  marksForCell: readonly MarkLike<Id>[],
): MarkLike<Id> | undefined {
  let winner: MarkLike<Id> | undefined;
  for (const mark of marksForCell) {
    if (
      winner === undefined ||
      mark.serverAt > winner.serverAt ||
      (mark.serverAt === winner.serverAt && mark._id > winner._id)
    ) {
      winner = mark;
    }
  }
  return winner;
}

/**
 * A missing mark resolves to `missed` with a null source id, which is explicit
 * and falsifiable the same way a non-null citation is. So does an Unset.
 */
export function resolveOutcome<Id extends string>(
  marksForCell: readonly MarkLike<Id>[],
  nextDayRev: number,
): Resolution<Id> {
  const mark = latestMark(marksForCell);
  return {
    outcome: mark?.outcome ?? "missed",
    resolvedFromMarkId: mark?._id ?? null,
    outcomeRev: nextDayRev,
  };
}

export function sameResolution<Id extends string>(a: Resolution<Id>, b: Resolution<Id>): boolean {
  return (
    a.outcome === b.outcome &&
    a.resolvedFromMarkId === b.resolvedFromMarkId &&
    a.outcomeRev === b.outcomeRev
  );
}
