import type { FunctionReturnType } from "convex/server";

import { useMutation } from "convex/react";

import type { LocalDate } from "#domain/date";
import type { MarkOutcome } from "#domain/outcome";

import { api } from "#convex/_generated/api";

export type DayView = FunctionReturnType<typeof api.days.get>;
export type RosterEntry = DayView["roster"][number];
export type RoutineView = FunctionReturnType<typeof api.routines.list>[number];

export interface MarkArgs {
  date: LocalDate;
  routineId: RosterEntry["routineId"];
  outcome: MarkOutcome;
}

/**
 * One tap, wherever it is taken from — a row toggle or the seal ceremony. The
 * optimistic update paints the cell before the server has accepted the Mark;
 * a refusal (an unaffordable skip, a sealed day) rolls it back and reaches the
 * caller as a rejection.
 */
export function useMarkInstance(): (args: MarkArgs) => Promise<unknown> {
  const append = useMutation(api.marks.append).withOptimisticUpdate((store, args) => {
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

  return append;
}
