import { useEffect, useRef, useState } from "react";

import type { MarkOutcome, Outcome } from "#domain/outcome";

import { addDays, type LocalDate } from "#domain/date";

import type { ConsoleModel, RosterEntry } from "./types";

import { bankedAnnouncement, markAnnouncement } from "../experience";
import { useConsoleKeys } from "./keys";
import { useMarkMutation } from "./marks";
import { deriveRosterState, nextRosterRoutine, stepLogDate } from "./navigation";
import { usePlanModel } from "./plan";
import { errorText, rowStatus, type Mode } from "./presentation";
import { useProgressionRead } from "./progression";
import { useConsoleReads } from "./reads";
import { useSealModel } from "./seal";
import { useViewedDate } from "./viewedDate";

function deriveDay(
  day: ConsoleModel["day"],
  mode: Mode,
  selected: RosterEntry["routineId"] | null,
) {
  const roster = day.status === "ready" ? day.value.roster : [];
  const sealed = day.status === "ready" && day.value.sealed;
  const state = deriveRosterState(roster, sealed, mode, selected);
  return {
    roster,
    ...state,
    facts: { ...state.facts, canSeal: day.status === "ready" && state.facts.canSeal },
  };
}

function blocksNavigation(plan: ConsoleModel["plan"]): boolean {
  return (
    plan.workflow.state === "confirming" ||
    plan.workflow.state === "retiring" ||
    (plan.workflow.state === "refused" && plan.workflow.operation === "retire")
  );
}

function useSealAnnouncement(
  day: ConsoleModel["day"],
  banked: React.RefObject<LocalDate | null>,
  say: (text: string) => void,
): void {
  const announcedFor = useRef<LocalDate | null>(null);
  useEffect(() => {
    if (day.status === "loading") return;
    if (!day.value.sealed) {
      announcedFor.current = day.value.date;
      return;
    }
    if (announcedFor.current !== day.value.date) return;
    announcedFor.current = null;
    if (banked.current !== day.value.date) say("day sealed");
  }, [banked, day, say]);
}

/** The sole production interface for browser-side console behavior. */
export function useConsoleModel(today: LocalDate): ConsoleModel {
  const [mode, setMode] = useState<Mode>("track");
  const [date, setViewedDate] = useViewedDate(today);
  const [selectedRoutine, setSelectedRoutine] = useState<RosterEntry["routineId"] | null>(null);
  const [logSelection, setLogSelection] = useState<LocalDate>(today);
  const [notice, setNotice] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => setLogSelection((current) => (date === today ? today : current)), [date, today]);

  const reads = useConsoleReads(today, date);
  const plan = usePlanModel();
  const { progression, acknowledgeBackfill } = useProgressionRead();
  const markMutation = useMarkMutation();
  const banked = useRef<LocalDate | null>(null);
  const seal = useSealModel((receipt) => {
    banked.current = receipt.date;
    setAnnouncement(bankedAnnouncement(receipt));
  });
  const { roster, index, entry, facts } = deriveDay(reads.day, mode, selectedRoutine);
  const covers = (next: LocalDate) => next >= reads.earliest && next <= today;

  const enterMode = (next: Mode) => {
    if (blocksNavigation(plan)) return;
    setMode(next);
    setSelectedRoutine(null);
    setNotice(null);
    if (next === "plan") setViewedDate(today);
    if (next === "log") setLogSelection(date);
  };
  const openDate = (next: LocalDate) => {
    if (blocksNavigation(plan)) return;
    setMode("track");
    setViewedDate(next);
    setSelectedRoutine(null);
    setNotice(null);
  };
  const goToDate = (next: LocalDate) => covers(next) && openDate(next);
  const stepDay = (delta: number) => goToDate(addDays(date, delta));
  const selectRoster = (id: RosterEntry["routineId"]) => {
    if (roster.some((item) => item.routineId === id)) setSelectedRoutine(id);
  };
  const stepRoster = (delta: number) => {
    if (!facts.marking || roster.length === 0) return;
    const next = Math.min(Math.max(0, index + delta), roster.length - 1);
    setSelectedRoutine(roster[next]?.routineId ?? null);
  };
  const mark = (id: RosterEntry["routineId"], outcome: MarkOutcome) => {
    if (reads.day.status === "loading" || reads.day.value.sealed) return;
    const item = roster.find((candidate) => candidate.routineId === id);
    if (!item) return;
    const wasDone = rowStatus(item) === "done";
    setNotice(null);
    markMutation({ date: reads.day.value.date, routineId: id, outcome })
      .then(() => setAnnouncement(`${item.name} · ${markAnnouncement(outcome, wasDone)}`))
      .catch((error: unknown) => {
        const text = errorText(error);
        setNotice(text);
        setAnnouncement(text);
      });
  };
  const markCurrent = (outcome: Outcome) => {
    if (!facts.marking || !entry) return;
    mark(entry.routineId, rowStatus(entry) === outcome ? null : outcome);
    setSelectedRoutine(nextRosterRoutine(roster, index));
  };

  const history = reads.history.status === "ready" ? reads.history.value : [];
  const stepLog = (delta: number) => {
    const next = stepLogDate(history, logSelection, delta);
    if (next !== null) setLogSelection(next);
  };
  const openLog = () => {
    if (mode === "log" && history.some((item) => item.date === logSelection)) {
      openDate(logSelection);
    }
  };
  const resolveBacklog = () => {
    if (reads.backlog.status !== "ready" || reads.backlog.value === null) return;
    openDate(reads.backlog.value.date);
    seal.begin(reads.backlog.value.date);
  };

  useSealAnnouncement(reads.day, banked, setAnnouncement);
  useConsoleKeys({
    mode,
    enabled: seal.workflow.state === "idle",
    enterMode,
    stepRoster,
    stepLog,
    openLog,
    mark: markCurrent,
    beginClose: () => facts.canSeal && seal.begin(date),
    stepDay,
    today: () => goToDate(today),
  });

  return {
    today,
    mode,
    date,
    lookingBack: date !== today,
    day: reads.day,
    roster,
    facts,
    history: { days: reads.history, earliest: reads.earliest },
    canStepBack: covers(addDays(date, -1)),
    canStepForward: covers(addDays(date, 1)),
    rosterSelection: { routineId: entry?.routineId ?? null, index },
    logSelection,
    plan,
    backlog: reads.backlog,
    balance: reads.balance,
    progression,
    pendingExperience: facts.sealed ? 0 : facts.done,
    seal,
    notice: seal.workflow.state === "idle" ? notice : null,
    announcement,
    commands: {
      enterMode,
      goToDate,
      openDate,
      stepDay,
      selectRoster,
      mark,
      selectLogDate: setLogSelection,
      dismissNotice: () => setNotice(null),
      dismissBackfill: acknowledgeBackfill,
      resolveBacklog,
    },
  };
}
