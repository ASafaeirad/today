import { useHotkeys } from "@tanstack/react-hotkeys";
import { useEffect, useRef, useState } from "react";

import type { MarkOutcome, Outcome } from "#domain/outcome";

import { addDays, type LocalDate } from "#domain/date";

import type { ConsoleModel, DayFacts, RosterEntry } from "./types";

import { bankedAnnouncement, markAnnouncement } from "../experience";
import { useMarkMutation } from "./marks";
import { usePlanModel } from "./plan";
import { errorText, rowStatus, type Mode } from "./presentation";
import { useProgressionRead } from "./progression";
import { useConsoleReads } from "./reads";
import { useSealModel } from "./seal";

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

/** Follows midnight only while the console remains on today. */
export function useViewedDate(today: LocalDate): [LocalDate, (date: LocalDate) => void] {
  const [date, setDate] = useState<LocalDate>(today);
  const followsToday = useRef(true);
  useEffect(() => {
    if (followsToday.current) setDate(today);
  }, [today]);
  return [
    date,
    (next) => {
      followsToday.current = next === today;
      setDate(next);
    },
  ];
}

function deriveDay(
  day: ConsoleModel["day"],
  mode: Mode,
  selected: RosterEntry["routineId"] | null,
) {
  const roster = day.status === "ready" ? day.value.roster : [];
  const index = selectedRosterIndex(roster, selected);
  const entry = roster[index];
  const sealed = day.status === "ready" && day.value.sealed;
  const count = (outcome: ReturnType<typeof rowStatus>) =>
    roster.filter((item) => rowStatus(item) === outcome).length;
  const facts: DayFacts = {
    scheduled: roster.length,
    open: count("open"),
    done: count("done"),
    missed: count("missed"),
    canSeal: day.status === "ready" && !sealed && roster.length > 0,
    sealed,
    marking: mode === "track" && !sealed,
  };
  return { roster, index, entry, facts };
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

export interface KeyCommands {
  mode: Mode;
  enabled: boolean;
  enterMode: (mode: Mode) => void;
  stepRoster: (delta: number) => void;
  stepLog: (delta: number) => void;
  openLog: () => void;
  mark: (outcome: Outcome) => void;
  beginClose: () => void;
  stepDay: (delta: number) => void;
  today: () => void;
}

export function useConsoleKeys(c: KeyCommands): void {
  useHotkeys(
    [
      { hotkey: "P", callback: () => c.enterMode("plan") },
      { hotkey: "Escape", callback: () => c.enterMode("track") },
      { hotkey: "J", callback: () => (c.mode === "log" ? c.stepLog(1) : c.stepRoster(1)) },
      { hotkey: "K", callback: () => (c.mode === "log" ? c.stepLog(-1) : c.stepRoster(-1)) },
      { hotkey: "Enter", callback: c.openLog },
      { hotkey: "D", callback: () => c.mark("done") },
      { hotkey: "M", callback: () => c.mark("missed") },
      { hotkey: "S", callback: () => c.mark("skipped") },
      { hotkey: "Z", callback: c.beginClose },
      { hotkey: "L", callback: () => c.mode !== "plan" && c.stepDay(-1) },
      { hotkey: "H", callback: () => c.mode !== "plan" && c.stepDay(1) },
      { hotkey: "T", callback: () => c.mode !== "plan" && c.today() },
      {
        hotkey: "G",
        callback: () => c.mode !== "plan" && c.enterMode(c.mode === "log" ? "track" : "log"),
      },
    ],
    { enabled: c.enabled },
  );
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

  const orderedHistory = reads.history.status === "ready" ? reads.history.value.toReversed() : [];
  const stepLog = (delta: number) => {
    if (orderedHistory.length === 0) return;
    const current = Math.max(
      0,
      orderedHistory.findIndex((item) => item.date === logSelection),
    );
    const next = Math.min(Math.max(0, current + delta), orderedHistory.length - 1);
    setLogSelection(orderedHistory[next]!.date);
  };
  const openLog = () => {
    if (mode === "log" && orderedHistory.some((item) => item.date === logSelection)) {
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
