import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

import { api } from "#convex/_generated/api";
import { EVERY_DAY } from "#domain/schedule";

import type { CommandResult, PlanModel, PlanWorkflow, RoutineView } from "./types";

import { errorText } from "./presentation";

function sameName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

type RoutinePlanning = Pick<RoutineView, "state"> & Partial<Pick<RoutineView, "planned">>;

/** Older deployments report only today's state, which still identifies active Routines. */
export function isRoutinePlanned(routine: RoutinePlanning): boolean {
  return (routine.planned ?? routine.state) === "active";
}

export function usePlanModel(): PlanModel {
  const routines = useQuery(api.routines.list);
  const create = useMutation(api.routines.create);
  const setSchedule = useMutation(api.schedules.set);
  const retire = useMutation(api.schedules.retire);
  const [workflow, setWorkflow] = useState<PlanWorkflow>({ state: "idle" });

  const add = async (name: string): Promise<CommandResult> => {
    if (workflow.state === "adding" || workflow.state === "retiring") {
      return { ok: false, reason: "Another plan command is still running." };
    }
    setWorkflow({ state: "adding" });
    try {
      const resting = routines?.findLast(
        (routine) => !isRoutinePlanned(routine) && sameName(routine.name, name),
      );
      if (resting) await setSchedule({ routineId: resting._id, dowMask: EVERY_DAY });
      else await create({ name, dowMask: EVERY_DAY });
      setWorkflow({ state: "idle" });
      return { ok: true };
    } catch (error) {
      const reason = errorText(error);
      setWorkflow({ state: "refused", operation: "add", reason });
      return { ok: false, reason };
    }
  };

  const requestRetirement = (routine: RoutineView) => {
    if (workflow.state === "adding" || workflow.state === "retiring") return;
    setWorkflow({ state: "confirming", routine });
  };

  const cancelRetirement = () => {
    if (workflow.state === "retiring") return;
    setWorkflow({ state: "idle" });
  };

  const confirmRetirement = async (): Promise<CommandResult> => {
    if (workflow.state !== "confirming" && workflow.state !== "refused") {
      return { ok: false, reason: "No Routine is awaiting retirement." };
    }
    if (workflow.state === "refused" && workflow.operation !== "retire") {
      return { ok: false, reason: workflow.reason };
    }
    const { routine } = workflow;
    setWorkflow({ state: "retiring", routine });
    try {
      await retire({ routineId: routine._id });
      setWorkflow({ state: "idle" });
      return { ok: true };
    } catch (error) {
      const reason = errorText(error);
      setWorkflow({ state: "refused", operation: "retire", routine, reason });
      return { ok: false, reason };
    }
  };

  return {
    routines:
      routines === undefined
        ? { status: "loading" }
        : { status: "ready", value: routines.filter(isRoutinePlanned) },
    workflow,
    add,
    requestRetirement,
    cancelRetirement,
    confirmRetirement,
  };
}
