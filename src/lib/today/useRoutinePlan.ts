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

/** Two names are the same name if only spacing and case separate them. */
function sameName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

type RoutinePlanning = Pick<RoutineView, "state"> & Partial<Pick<RoutineView, "planned">>;

/** Older deployments only report today's state, which is still enough to show active routines. */
export function isRoutinePlanned(routine: RoutinePlanning): boolean {
  return (routine.planned ?? routine.state) === "active";
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
  const set = useMutation(api.schedules.set);
  const retire = useMutation(api.schedules.retire);

  return {
    // Newer responses use the schedule frontier so retirement takes effect at
    // once. The state fallback keeps older responses visible.
    routines: routines?.filter(isRoutinePlanned),
    add: async (name) => {
      // "A retired routine can return later as a new active range under the
      // same identity." This field is the only way back, so a name that names
      // something retired resumes it rather than forking its rates and
      // instances across a second routine that merely looks the same.
      const resting = routines?.findLast(
        (routine) => !isRoutinePlanned(routine) && sameName(routine.name, name),
      );
      if (resting) {
        await set({ routineId: resting._id, dowMask: EVERY_DAY });
        return;
      }
      await create({ name, dowMask: EVERY_DAY });
    },
    remove: async (routine) => {
      await retire({ routineId: routine._id });
    },
  };
}
