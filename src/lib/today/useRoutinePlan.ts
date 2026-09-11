import { useMutation, useQuery } from "convex/react";

import { api } from "#convex/_generated/api";
import { EVERY_DAY } from "#domain/schedule";

import type { RoutineView } from "./ledger";

export interface RoutinePlan {
  /** The routines that run. A retired one is history, not a line to edit. */
  routines: RoutineView[] | undefined;
  add: (name: string) => Promise<void>;
  remove: (routine: RoutineView) => Promise<void>;
}

/**
 * Plan mode's whole surface. Every routine is daily, so creating one asks no
 * question a schedule would: the mask is every day and there is nothing else to
 * set. Removing one retires it — the past keeps pointing at the versions that
 * produced it, and the name can come back later under the same identity.
 */
export function useRoutinePlan(): RoutinePlan {
  const routines = useQuery(api.routines.list);
  const create = useMutation(api.routines.create);
  const retire = useMutation(api.schedules.retire);

  return {
    routines: routines?.filter((routine) => routine.state === "active"),
    add: async (name) => {
      await create({ name, dowMask: EVERY_DAY });
    },
    remove: async (routine) => {
      await retire({ routineId: routine._id });
    },
  };
}
