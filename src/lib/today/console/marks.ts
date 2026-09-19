import { useMutation } from "convex/react";

import type { LocalDate } from "#domain/date";
import type { MarkOutcome } from "#domain/outcome";

import { api } from "#convex/_generated/api";

import type { RosterEntry } from "./types";

export interface MarkArgs {
  date: LocalDate;
  routineId: RosterEntry["routineId"];
  outcome: MarkOutcome;
}

export function applyRosterMark(
  roster: RosterEntry[],
  routineId: RosterEntry["routineId"],
  outcome: MarkOutcome,
): RosterEntry[] {
  return roster.map((entry) =>
    entry.routineId === routineId
      ? { ...entry, outcome: outcome ?? "missed", marked: outcome !== null }
      : entry,
  );
}

/** One optimistic Mark implementation shared by Track and the Close workflow. */
export function useMarkMutation(): (args: MarkArgs) => Promise<unknown> {
  return useMutation(api.marks.append).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(api.days.get, { date: args.date });
    if (!current) return;
    store.setQuery(
      api.days.get,
      { date: args.date },
      {
        ...current,
        roster: applyRosterMark(current.roster, args.routineId, args.outcome),
      },
    );
  });
}
