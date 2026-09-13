import { useHotkeys } from "@tanstack/react-hotkeys";
import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";

import type { MarkOutcome, Outcome } from "#domain/outcome";

import { api } from "#convex/_generated/api";
import { addDays, type LocalDate } from "#domain/date";

import { errorText, rowStatus, type BalanceView, type DaySummary, type Mode } from "./console";
import { useMarkInstance, type DayView, type RosterEntry } from "./ledger";
import { useBacklog } from "./useBacklog";
import { useBalance } from "./useBalance";
import { useHistory, type History } from "./useHistory";
import { useRoutinePlan, type RoutinePlan } from "./useRoutinePlan";
import { useSealCeremony, type SealCeremony } from "./useSealCeremony";

export interface TodayController {
  mode: Mode;
  enterMode: (mode: Mode) => void;
  /** The local date on screen. Today, until the owner steps back. */
  date: LocalDate;
  /** True while that date is a past one: the console is looking back. */
  lookingBack: boolean;
  /** The window the strip draws and the step keys move over. */
  history: History;
  /** Opens a date, if the window covers it. Ignores anything outside it. */
  goToDate: (date: LocalDate) => void;
  stepDay: (delta: number) => void;
  canStepBack: boolean;
  canStepForward: boolean;
  day: DayView | undefined;
  roster: RosterEntry[];
  sealed: boolean;
  /** Track mode on a day that can still take a Mark: the day's hot path. */
  marking: boolean;
  cursor: number;
  setCursor: (index: number) => void;
  mark: (entry: RosterEntry, outcome: MarkOutcome) => void;
  plan: RoutinePlan;
  backlog: DaySummary | undefined;
  /** What a skip costs, and whether there is one to spend. */
  balance: BalanceView | undefined;
  seal: SealCeremony;
  /** The last refusal, while the shell is the surface answering for it. */
  notice: string | null;
  dismissNotice: () => void;
  announcement: string;
}

/**
 * The DOM handles the controller reads to keep the block cursor in view. Owned
 * by the component and threaded in, rather than returned alongside the plain
 * state above: a hook that hands back a ref next to ordinary values makes every
 * property of that return object read as a possible ref access, which is
 * exactly the false positive this split avoids.
 */
export interface TodayRefs {
  rowRefs: React.RefObject<(HTMLDivElement | null)[]>;
}

/** The block cursor follows the keyboard. */
function useFollowCursor(refs: TodayRefs, cursor: number, day: DayView | undefined): void {
  useEffect(() => {
    refs.rowRefs.current[cursor]?.scrollIntoView({ block: "nearest" });
  }, [cursor, day, refs.rowRefs]);
}

/** The next line still owing a verdict, or the one below if there is none. */
function advance(roster: readonly RosterEntry[], from: number): number {
  const next = roster.findIndex((entry, index) => index > from && rowStatus(entry) === "open");
  return next === -1 ? Math.min(from + 1, roster.length - 1) : next;
}

/**
 * Everything the console does, apart from drawing it: the ledger reads, the
 * writes, the two modes, the block cursor, and the one keyboard the whole
 * screen shares.
 */
export function useTodayController(today: LocalDate, refs: TodayRefs): TodayController {
  const [mode, setMode] = useState<Mode>("track");
  const [date, setDate] = useState<LocalDate>(today);
  const [cursorState, setCursorState] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const announcedFor = useRef<LocalDate | null>(null);

  const history = useHistory(today);
  const day = useQuery(api.days.get, { date });
  const plan = useRoutinePlan();
  const backlog = useBacklog();
  const balance = useBalance();
  const seal = useSealCeremony();
  const append = useMarkInstance();

  const roster = day?.roster ?? [];
  const sealed = day?.sealed ?? false;
  const marking = mode === "track" && !sealed;
  const firstOpen = Math.max(
    0,
    roster.findIndex((entry) => rowStatus(entry) === "open"),
  );
  const cursor = Math.min(cursorState ?? firstOpen, Math.max(0, roster.length - 1));
  useFollowCursor(refs, cursor, day);

  // Plan mode is an editing surface, so it opens with an empty slate: the
  // block cursor means nothing there and means the first open line on return.
  //
  // It also returns to today. A schedule edit is today-forward by definition,
  // so a routine list read against a past date would be a list that date never
  // had — plan mode has no business being open on a day that is already over.
  const enterMode = (next: Mode) => {
    setMode(next);
    setCursorState(null);
    setNotice(null);
    if (next === "plan") setDate(today);
  };

  // Nothing clamps here. A date the window does not reach is one the console
  // cannot draw or summarize, and silently landing on a neighbouring day would
  // be worse than not moving at all.
  const goToDate = (next: LocalDate) => {
    if (!history.covers(next)) return;
    setMode("track");
    setDate(next);
    setCursorState(null);
    setNotice(null);
  };
  const stepDay = (delta: number) => goToDate(addDays(date, delta));

  // Plan mode holds a focused field, and a confirmation over it once a routine
  // is being removed. A day key there would move the ground under both, so the
  // keyboard leaves plan mode alone — the strip still navigates by click, and
  // ESC is one keystroke away from a mode these keys do belong to.
  const dayKey = (move: () => void) => () => {
    if (mode !== "plan") move();
  };

  const mark = (entry: RosterEntry, outcome: MarkOutcome) => {
    if (!day || day.sealed) return;
    setNotice(null);
    append({ date: day.date, routineId: entry.routineId, outcome })
      .then(() => setAnnouncement(`${entry.name} ${outcome ?? "open"}`))
      .catch((error: unknown) => {
        const text = errorText(error);
        setNotice(text);
        setAnnouncement(text);
      });
  };

  // A day that has just sealed says so once, to whoever is listening rather
  // than looking. The stamp itself stays on screen for good.
  //
  // Only a day that sealed under the owner's hands is worth saying: the ref
  // remembers which date was open when it was opened, so stepping onto a day
  // that was already sealed reads as history rather than as an event.
  useEffect(() => {
    if (day === undefined) return;
    if (!day.sealed) {
      announcedFor.current = day.date;
      return;
    }
    if (announcedFor.current !== day.date) return;
    announcedFor.current = null;
    setAnnouncement("day sealed");
  }, [day]);

  const stepRow = (delta: number) => {
    if (!marking || roster.length === 0) return;
    setCursorState(Math.min(Math.max(0, cursor + delta), roster.length - 1));
  };
  const markCurrent = (outcome: Outcome) => {
    const entry = roster[cursor];
    if (!marking || entry === undefined) return;
    mark(entry, rowStatus(entry) === outcome ? null : outcome);
    setCursorState(advance(roster, cursor));
  };

  // The console's one keyboard. `enabled` gates every row on the ceremony,
  // which has its own bindings while it is open; callbacks and the `enabled`
  // flag both resync every render, so this is safe to close over this render's
  // state directly.
  useHotkeys(
    [
      { hotkey: "P", callback: () => enterMode("plan") },
      { hotkey: "Escape", callback: () => enterMode("track") },
      { hotkey: "J", callback: () => stepRow(1) },
      { hotkey: "K", callback: () => stepRow(-1) },
      { hotkey: "D", callback: () => markCurrent("done") },
      { hotkey: "M", callback: () => markCurrent("missed") },
      { hotkey: "S", callback: () => markCurrent("skipped") },
      { hotkey: "Z", callback: () => marking && roster.length > 0 && seal.begin(date) },
      { hotkey: "[", callback: dayKey(() => stepDay(-1)) },
      { hotkey: "]", callback: dayKey(() => stepDay(1)) },
      { hotkey: "T", callback: dayKey(() => goToDate(today)) },
    ],
    { enabled: seal.date === null },
  );

  return {
    mode,
    enterMode,
    date,
    lookingBack: date !== today,
    history,
    goToDate,
    stepDay,
    canStepBack: date > history.earliest,
    canStepForward: date < today,
    day,
    roster,
    sealed,
    marking,
    cursor,
    setCursor: setCursorState,
    mark,
    plan,
    backlog,
    balance,
    seal,
    // The ceremony prints its own refusals, so the shell keeps quiet under it
    // rather than stacking a second copy behind the dialog.
    notice: seal.date === null ? notice : null,
    dismissNotice: () => setNotice(null),
    announcement,
  };
}
