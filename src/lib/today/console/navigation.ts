import type { LocalDate } from "#domain/date";

import type { DayFacts, RosterEntry } from "./types";

import { rowStatus, type DaySummary, type Mode } from "./presentation";

function firstOpenIndex(roster: readonly RosterEntry[]): number {
  return Math.max(
    0,
    roster.findIndex((entry) => rowStatus(entry) === "open"),
  );
}

export function selectedRosterIndex(
  roster: readonly RosterEntry[],
  selected: RosterEntry["routineId"] | null,
): number {
  const found = roster.findIndex((entry) => entry.routineId === selected);
  return found === -1 ? Math.min(firstOpenIndex(roster), Math.max(0, roster.length - 1)) : found;
}

export function nextRosterRoutine(
  roster: readonly RosterEntry[],
  from: number,
): RosterEntry["routineId"] | null {
  const next = roster.findIndex((entry, index) => index > from && rowStatus(entry) === "open");
  const index = next === -1 ? Math.min(from + 1, roster.length - 1) : next;
  return roster[index]?.routineId ?? null;
}

export function stepLogDate(
  history: readonly DaySummary[],
  selected: LocalDate,
  delta: number,
): LocalDate | null {
  if (history.length === 0) return null;
  const ordered = history.toReversed();
  const currentDate = selectedLogDate(history, selected);
  const current = ordered.findIndex((item) => item.date === currentDate);
  const next = Math.min(Math.max(0, current + delta), ordered.length - 1);
  return ordered[next]!.date;
}

export function selectedLogDate(
  history: readonly DaySummary[],
  selected: LocalDate,
): LocalDate | null {
  if (history.some((item) => item.date === selected)) return selected;
  return history.at(-1)?.date ?? null;
}

export function deriveRosterState(
  roster: RosterEntry[],
  sealed: boolean,
  mode: Mode,
  selected: RosterEntry["routineId"] | null,
): {
  entry: RosterEntry | undefined;
  facts: DayFacts;
  index: number;
} {
  const index = selectedRosterIndex(roster, selected);
  const count = (outcome: ReturnType<typeof rowStatus>) =>
    roster.filter((item) => rowStatus(item) === outcome).length;
  return {
    entry: roster[index],
    index,
    facts: {
      scheduled: roster.length,
      open: count("open"),
      done: count("done"),
      missed: count("missed"),
      canSeal: !sealed && roster.length > 0,
      sealed,
      marking: mode === "track" && !sealed,
    },
  };
}
