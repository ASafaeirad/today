import { useState } from "react";

import type { LocalDate } from "#domain/date";
import type { MarkOutcome, Outcome } from "#domain/outcome";

import type { ReceiptView } from "../experience";
import type {
  ConsoleModel,
  DayView,
  PlanModel,
  RosterEntry,
  RoutineView,
  SealModel,
} from "./types";

import { useConsoleKeys } from "./keys";
import { applyRosterMark } from "./marks";
import { deriveRosterState, nextRosterRoutine, stepLogDate } from "./navigation";
import { rowStatus, type DaySummary, type Mode } from "./presentation";

const TODAY = "2026-09-11";

const routines: RoutineView[] = [
  {
    _id: "routine-read" as RoutineView["_id"],
    name: "Read",
    state: "active",
    planned: "active",
    days: [0, 1, 2, 3, 4, 5, 6],
    scheduleVersionId: "schedule-read" as RoutineView["scheduleVersionId"],
  },
  {
    _id: "routine-walk" as RoutineView["_id"],
    name: "Walk",
    state: "active",
    planned: "active",
    days: [0, 1, 2, 3, 4, 5, 6],
    scheduleVersionId: "schedule-walk" as RoutineView["scheduleVersionId"],
  },
];

function entry(routine: RoutineView, index: number, outcome: "open" | "done"): RosterEntry {
  return {
    instanceId: `instance-${index}` as RosterEntry["instanceId"],
    routineId: routine._id,
    scheduleVersionId: routine.scheduleVersionId!,
    name: routine.name,
    outcome: outcome === "done" ? "done" : "missed",
    marked: outcome === "done",
    settled: false,
  };
}

function day(date: LocalDate, roster: RosterEntry[], sealed = false): DayView {
  return {
    date,
    state: sealed ? "closed" : "open",
    rev: 1,
    closedAt: sealed ? Date.now() : null,
    sealed,
    closingNote: "",
    roster,
    stats: null,
    award: null,
  };
}

function summary(date: LocalDate, done: number, open: number, sealed: boolean): DaySummary {
  return {
    date,
    scheduled: done + open,
    done,
    open,
    skipped: 0,
    missed: 0,
    state: sealed ? "closed" : date === TODAY ? "open" : "awaitingReview",
    sealed,
    award: null,
  };
}

const receipt: ReceiptView = {
  date: TODAY,
  eligible: true,
  doneExperience: 2,
  baseExperience: 10,
  streakExperience: 1,
  held: false,
  streak: 1,
  multiplier: 1.1,
  reset: false,
  released: 0,
  total: 13,
  experienceBefore: 0,
  experienceAfter: 13,
  levelBefore: 1,
  levelAfter: 1,
};

function useStoryPlanModel(): PlanModel {
  const [workflow, setWorkflow] = useState<PlanModel["workflow"]>({ state: "idle" });
  return {
    routines: { status: "ready", value: routines },
    workflow,
    add: () => Promise.resolve({ ok: true }),
    requestRetirement: (routine) => setWorkflow({ state: "confirming", routine }),
    cancelRetirement: () => setWorkflow({ state: "idle" }),
    confirmRetirement: () => {
      setWorkflow({ state: "idle" });
      return Promise.resolve({ ok: true });
    },
  };
}

function storySealWorkflow(
  date: LocalDate | null,
  roster: RosterEntry[],
  banked: ReceiptView | null,
  locking: boolean,
): SealModel["workflow"] {
  if (date === null) return { state: "idle" };
  const current = day(date, roster);
  if (banked) return { state: "receipt", date, day: current, receipt: banked };
  const pending = roster.filter((item) => rowStatus(item) === "open");
  if (pending.length > 0) return { state: "resolving", date, day: current, pending };
  return locking
    ? { state: "locking", date, day: current }
    : { state: "ready", date, day: current };
}

function useStorySealModel(
  roster: RosterEntry[],
  mark: (routineId: RosterEntry["routineId"], outcome: MarkOutcome) => void,
): SealModel {
  const [date, setDate] = useState<LocalDate | null>(null);
  const [banked, setBanked] = useState<ReceiptView | null>(null);
  const [locking, setLocking] = useState(false);
  const workflow = storySealWorkflow(date, roster, banked, locking);
  return {
    workflow,
    begin: setDate,
    resolve: (outcome) => {
      if (workflow.state !== "resolving") return;
      const next = workflow.pending[0];
      if (next) mark(next.routineId, outcome);
    },
    lock: () => {
      if (date === null) return Promise.resolve({ ok: false, reason: "No Day is ready." });
      setLocking(true);
      setBanked({ ...receipt, date });
      setLocking(false);
      return Promise.resolve({ ok: true });
    },
    cancel: () => {
      setDate(null);
      setBanked(null);
    },
  };
}

/** A deterministic, browser-only adapter for full-console stories. */
export function useStoryConsoleModel(): ConsoleModel {
  const [mode, setMode] = useState<Mode>("track");
  const [date, setDate] = useState<LocalDate>(TODAY);
  const [roster, setRoster] = useState(() => [
    entry(routines[0]!, 0, "open"),
    entry(routines[1]!, 1, "done"),
  ]);
  const [selectedRoutine, setSelectedRoutine] = useState<RosterEntry["routineId"] | null>(null);
  const [logSelection, setLogSelection] = useState<LocalDate>(TODAY);
  const [notice, setNotice] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [backfill, setBackfill] = useState<{ days: number; experience: number } | null>({
    days: 4,
    experience: 52,
  });
  const { entry: selected, facts, index } = deriveRosterState(roster, false, mode, selectedRoutine);
  const history = [
    summary("2026-09-09", 1, 1, false),
    summary("2026-09-10", 2, 0, true),
    summary(TODAY, facts.done, facts.open, false),
  ];

  const openDate = (next: LocalDate) => {
    setMode("track");
    setDate(next);
    setSelectedRoutine(null);
  };
  const enterMode = (next: Mode) => {
    setMode(next);
    if (next === "log") setLogSelection(date);
    if (next === "plan") setDate(TODAY);
  };
  const mark = (routineId: RosterEntry["routineId"], outcome: MarkOutcome) => {
    setNotice(null);
    setRoster((current) => {
      const optimistic = applyRosterMark(current, routineId, outcome);
      if (outcome === "skipped") {
        setTimeout(() => {
          setRoster(current);
          setNotice("No skip is available.");
        }, 50);
      }
      return optimistic;
    });
    setAnnouncement("Mark submitted");
  };
  const markCurrent = (outcome: Outcome) => {
    if (!selected) return;
    mark(selected.routineId, rowStatus(selected) === outcome ? null : outcome);
    setSelectedRoutine(nextRosterRoutine(roster, index));
  };
  const stepRoster = (delta: number) => {
    const next = Math.min(Math.max(0, index + delta), roster.length - 1);
    setSelectedRoutine(roster[next]?.routineId ?? null);
  };
  const stepLog = (delta: number) => {
    const next = stepLogDate(history, logSelection, delta);
    if (next !== null) setLogSelection(next);
  };

  const stepDay = (delta: number) => {
    const current = history.findIndex((item) => item.date === date);
    const next = Math.min(Math.max(0, current + delta), history.length - 1);
    openDate(history[next]!.date);
  };

  const seal = useStorySealModel(roster, mark);
  const plan = useStoryPlanModel();

  useConsoleKeys({
    mode,
    enabled: seal.workflow.state === "idle",
    enterMode,
    stepRoster,
    stepLog,
    openLog: () => mode === "log" && openDate(logSelection),
    mark: markCurrent,
    beginClose: () => seal.begin(date),
    stepDay,
    today: () => openDate(TODAY),
  });

  return {
    today: TODAY,
    mode,
    date,
    lookingBack: date !== TODAY,
    day: { status: "ready", value: day(date, roster) },
    roster,
    facts,
    history: { days: { status: "ready", value: history }, earliest: history[0]!.date },
    canStepBack: date > history[0]!.date,
    canStepForward: date < TODAY,
    rosterSelection: { routineId: selected?.routineId ?? null, index },
    logSelection,
    plan,
    backlog: { status: "ready", value: history[0]! },
    balance: { status: "ready", value: { available: 0, minted: 0 } },
    progression: {
      status: "ready",
      value: { experience: 52, streak: 2, multiplier: 1.2, heldDays: 0, caughtUp: true, backfill },
    },
    pendingExperience: facts.done,
    seal,
    notice,
    announcement,
    commands: {
      enterMode,
      goToDate: openDate,
      openDate,
      stepDay,
      selectRoster: setSelectedRoutine,
      mark,
      selectLogDate: setLogSelection,
      dismissNotice: () => setNotice(null),
      dismissBackfill: () => setBackfill(null),
      resolveBacklog: () => {
        openDate(history[0]!.date);
        seal.begin(history[0]!.date);
      },
    },
  };
}
