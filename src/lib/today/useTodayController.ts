import { useHotkeys } from "@tanstack/react-hotkeys";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";

import type { LocalDate } from "#domain/date";
import type { Outcome } from "#domain/outcome";

import { api } from "#convex/_generated/api";

import type { DayView, RosterEntry } from "./DayScreen";
import type { SealStage } from "./SealDialog";

import { errorText, rowStatus } from "./console";
import { useDayStrip, type DayStrip } from "./useDayStrip";

export interface TodayController {
  selected: LocalDate;
  strip: DayStrip;
  day: DayView | undefined;
  sealed: boolean;
  roster: RosterEntry[];
  cursor: number;
  notice: string | null;
  announcement: string;
  seal: SealStage | null;
  selectDate: (date: LocalDate) => void;
  setCursor: (index: number) => void;
  mark: (entry: RosterEntry, outcome: Outcome | null) => void;
  jump: () => void;
  beginSeal: () => void;
  setSeal: (stage: SealStage) => void;
  lock: (note: string) => Promise<void>;
  endSeal: () => void;
}

/**
 * The DOM handles the controller reads to keep the block cursor and the day
 * strip in view. Owned by the component and threaded in, rather than
 * returned alongside the plain state above: a hook that hands back a ref
 * next to ordinary values makes every property of that return object read
 * as a possible ref access, which is exactly the false positive this split
 * avoids.
 */
export interface TodayRefs {
  rowRefs: React.RefObject<(HTMLDivElement | null)[]>;
  listRef: React.RefObject<HTMLDivElement | null>;
}

/** The next day, newest first, whose roster still owes the owner something. */
function nextOpenDate(dates: readonly LocalDate[], strip: DayStrip): LocalDate | undefined {
  return dates.find((date) => {
    const summary = strip.summaries.get(date);
    return summary !== undefined && !summary.sealed && summary.open > 0;
  });
}

interface FollowCursorState {
  refs: TodayRefs;
  cursor: number;
  selected: LocalDate;
  day: DayView | undefined;
}

/**
 * The block cursor follows the keyboard; a jump also lands focus on the row.
 * Returns a function that arms that landing for the next cursor move, so a
 * caller never has to reach into the ref this owns.
 */
function useFollowCursor({ refs, cursor, selected, day }: FollowCursorState): () => void {
  const focusPending = useRef(false);

  useEffect(() => {
    const row = refs.rowRefs.current[cursor];
    if (!row) return;
    row.scrollIntoView({ block: "nearest" });
    if (focusPending.current) {
      focusPending.current = false;
      row.querySelector("button")?.focus();
    }
  }, [cursor, selected, day, refs.rowRefs]);

  useEffect(() => {
    refs.listRef.current
      ?.querySelector("[data-selected]")
      ?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [selected, refs.listRef]);

  return () => {
    focusPending.current = true;
  };
}

/**
 * Everything the console does, apart from drawing it: the ledger reads, the
 * writes, the block cursor, and the one keyboard the whole screen shares.
 */
export function useTodayController(today: LocalDate, refs: TodayRefs): TodayController {
  const [selected, setSelected] = useState(today);
  const [cursorState, setCursorState] = useState<number | null>(null);
  const [seal, setSeal] = useState<SealStage | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const strip = useDayStrip(today, selected);
  const day = useQuery(api.days.get, { date: selected });
  const appendMark = useMutation(api.marks.append).withOptimisticUpdate((store, args) => {
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
  const closeDay = useMutation(api.days.close);

  const roster = day?.roster ?? [];
  const sealed = day?.sealed ?? false;
  const firstOpen = Math.max(
    0,
    roster.findIndex((entry) => rowStatus(entry) === "open"),
  );
  const cursor = Math.min(cursorState ?? firstOpen, Math.max(0, roster.length - 1));
  const requestFocus = useFollowCursor({ refs, cursor, selected, day });

  const selectDate = (date: LocalDate) => {
    setSelected(date);
    setCursorState(null);
  };

  const mark = (entry: RosterEntry, outcome: Outcome | null) => {
    if (!day || day.sealed) return;
    setNotice(null);
    appendMark({ date: day.date, routineId: entry.routineId, outcome })
      .then(() => setAnnouncement(`${entry.name} ${outcome ?? "open"}`))
      .catch((error: unknown) => {
        const text = errorText(error);
        setNotice(text);
        setAnnouncement(text);
      });
  };

  const jump = () => {
    const date = nextOpenDate(strip.dates, strip);
    if (date === undefined) {
      setAnnouncement("no open routines");
      return;
    }
    selectDate(date);
    requestFocus();
    setAnnouncement(`jump ${date}`);
  };

  const beginSeal = () => {
    if (!day || day.sealed || day.roster.length === 0) return;
    setSeal(day.roster.some((entry) => rowStatus(entry) === "open") ? "resolve" : "recap");
  };

  const lock = async (note: string) => {
    if (!day) return;
    await closeDay({ date: day.date, seal: true, expectedRev: day.rev, closingNote: note });
    setSeal("sealed");
    setAnnouncement("day sealed");
  };

  const endSeal = () => {
    const returning = seal === "sealed";
    setSeal(null);
    if (!returning) return;
    const next = strip.dates.find((date) => {
      const summary = strip.summaries.get(date);
      return summary !== undefined && !summary.sealed && summary.scheduled > 0;
    });
    selectDate(next ?? today);
  };

  const dayIndex = strip.dates.indexOf(selected);
  const stepDay = (delta: number) => {
    const date = strip.dates[dayIndex + delta];
    if (date !== undefined) selectDate(date);
  };
  const stepRow = (delta: number) => {
    if (sealed || roster.length === 0) return;
    setCursorState(Math.min(Math.max(0, cursor + delta), roster.length - 1));
  };
  const markCurrent = (outcome: Outcome) => {
    const entry = roster[cursor];
    if (sealed || entry === undefined) return;
    mark(entry, rowStatus(entry) === outcome ? null : outcome);
    stepRow(1);
  };

  // The console's one keyboard. `enabled` gates every row on the ceremony
  // dialog, which has its own bindings while it is open; callbacks and the
  // `enabled` flag both resync every render, so this is safe to close over
  // this render's state directly.
  useHotkeys(
    [
      { hotkey: "H", callback: () => stepDay(-1) },
      { hotkey: "L", callback: () => stepDay(1) },
      { hotkey: "J", callback: () => stepRow(1) },
      { hotkey: "K", callback: () => stepRow(-1) },
      { hotkey: "D", callback: () => markCurrent("done") },
      { hotkey: "M", callback: () => markCurrent("missed") },
      { hotkey: "S", callback: () => markCurrent("skipped") },
      { hotkey: "Z", callback: () => beginSeal() },
    ],
    { enabled: seal === null },
  );

  return {
    selected,
    strip,
    day,
    sealed,
    roster,
    cursor,
    notice,
    announcement,
    seal,
    selectDate,
    setCursor: setCursorState,
    mark,
    jump,
    beginSeal,
    setSeal,
    lock,
    endSeal,
  };
}
