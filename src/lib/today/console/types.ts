import type { FunctionReturnType } from "convex/server";

import type { api } from "#convex/_generated/api";
import type { LocalDate } from "#domain/date";
import type { MarkOutcome, Outcome } from "#domain/outcome";

import type { ProgressionView, ReceiptView } from "../experience";
import type { BalanceView, DaySummary, Mode } from "./presentation";

export type DayView = FunctionReturnType<typeof api.days.get>;
export type RosterEntry = DayView["roster"][number];
export type RoutineView = FunctionReturnType<typeof api.routines.list>[number];

export type Loadable<T> = { status: "loading" } | { status: "ready"; value: T };

export type CommandResult = { ok: true } | { ok: false; reason: string };

export interface DayFacts {
  scheduled: number;
  open: number;
  done: number;
  missed: number;
  canSeal: boolean;
  sealed: boolean;
  marking: boolean;
}

export interface HistorySnapshot {
  days: Loadable<DaySummary[]>;
  earliest: LocalDate;
}

export type PlanWorkflow =
  | { state: "idle" }
  | { state: "adding" }
  | { state: "confirming"; routine: RoutineView }
  | { state: "retiring"; routine: RoutineView }
  | { state: "refused"; operation: "add"; reason: string }
  | { state: "refused"; operation: "retire"; routine: RoutineView; reason: string };

export interface PlanModel {
  routines: Loadable<RoutineView[]>;
  workflow: PlanWorkflow;
  add: (name: string) => Promise<CommandResult>;
  requestRetirement: (routine: RoutineView) => void;
  cancelRetirement: () => void;
  confirmRetirement: () => Promise<CommandResult>;
}

interface SealWithDay {
  date: LocalDate;
  day: DayView;
}

export type SealWorkflow =
  | { state: "idle" }
  | { state: "loading"; date: LocalDate }
  | (SealWithDay & { state: "resolving"; pending: RosterEntry[] })
  | (SealWithDay & { state: "ready" })
  | (SealWithDay & { state: "locking" })
  | (SealWithDay & {
      state: "refused";
      phase: "resolve" | "lock";
      pending: RosterEntry[];
      reason: string;
    })
  | { state: "receipt"; date: LocalDate; day: DayView; receipt: ReceiptView };

export interface SealModel {
  workflow: SealWorkflow;
  begin: (date: LocalDate) => void;
  resolve: (outcome: Outcome) => void;
  lock: () => Promise<CommandResult>;
  cancel: () => void;
}

export interface ConsoleCommands {
  enterMode: (mode: Mode) => void;
  goToDate: (date: LocalDate) => void;
  openDate: (date: LocalDate) => void;
  stepDay: (delta: number) => void;
  selectRoster: (routineId: RosterEntry["routineId"]) => void;
  mark: (routineId: RosterEntry["routineId"], outcome: MarkOutcome) => void;
  selectLogDate: (date: LocalDate) => void;
  dismissNotice: () => void;
  dismissBackfill: () => void;
  resolveBacklog: () => void;
}

export interface ConsoleModel {
  today: LocalDate;
  mode: Mode;
  date: LocalDate;
  lookingBack: boolean;
  day: Loadable<DayView>;
  roster: RosterEntry[];
  facts: DayFacts;
  history: HistorySnapshot;
  canStepBack: boolean;
  canStepForward: boolean;
  rosterSelection: { routineId: RosterEntry["routineId"] | null; index: number };
  logSelection: LocalDate;
  plan: PlanModel;
  backlog: Loadable<DaySummary | null>;
  balance: Loadable<BalanceView>;
  progression: Loadable<ProgressionView>;
  pendingExperience: number;
  seal: SealModel;
  notice: string | null;
  announcement: string;
  commands: ConsoleCommands;
}
