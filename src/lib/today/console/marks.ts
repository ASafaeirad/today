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
        roster: current.roster.map((entry) =>
          entry.routineId === args.routineId
            ? { ...entry, outcome: args.outcome ?? "missed", marked: args.outcome !== null }
            : entry,
        ),
      },
    );
  });
}
