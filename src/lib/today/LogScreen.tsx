import { useHotkeys } from "@tanstack/react-hotkeys";
import { useEffect, useRef, useState } from "react";

import type { LocalDate } from "#domain/date";

import { cn } from "#lib/cn";
import { Panel, PanelBody, RowHeader, rowGridVariants, Text } from "#ui";

import {
  dayTally,
  logLineLabel,
  logState,
  recordSegments,
  weekday,
  type DaySummary,
  type RecordSegment,
} from "./console";

/** How each outcome paints its share of the bar, in the record's own language. */
const SEGMENT_FILL = {
  done: "tone-done tone-rail",
  missed: "tone-missed tone-rail",
  /* Skipped is deliberate absence: hatched, never filled — as in every row. */
  skipped: "tone-skipped tone-hatch",
  open: "",
} as const;

interface LogScreenProps {
  /** The window, oldest first. Undefined while the overview is still reading. */
  days: DaySummary[] | undefined;
  today: LocalDate;
  /** The day the console is parked on, which seeds the log cursor. */
  date: LocalDate;
  onOpen: (date: LocalDate) => void;
}

/**
 * Log mode: every day in the window, newest first, each written as one line.
 *
 * This is the record and nothing else — no line here marks or seals anything.
 * Opening a day is the only thing it does, which is what makes it safe to be
 * the mode you leave the console sitting in.
 */
export function LogScreen({ days, today, date, onOpen }: LogScreenProps) {
  const orderedDays = days?.slice().reverse() ?? [];
  const [cursorDate, setCursorDate] = useState<LocalDate>(date);
  const [parkedOn, setParkedOn] = useState<LocalDate>(date);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);

  if (parkedOn !== date) {
    setParkedOn(date);
    setCursorDate(date);
  }

  const foundCursor = orderedDays.findIndex((summary) => summary.date === cursorDate);
  const cursor = Math.max(0, foundCursor);
  const selected = orderedDays[cursor];

  const stepCursor = (delta: number) => {
    if (orderedDays.length === 0) return;
    const next = Math.min(Math.max(0, cursor + delta), orderedDays.length - 1);
    setCursorDate(orderedDays[next]!.date);
  };

  useHotkeys(
    [
      { hotkey: "J", callback: () => stepCursor(1) },
      { hotkey: "K", callback: () => stepCursor(-1) },
      { hotkey: "Enter", callback: () => selected && onOpen(selected.date) },
    ],
    { enabled: selected !== undefined, preventDefault: true },
  );

  useEffect(() => {
    rowRefs.current[cursor]?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (days === undefined) {
    return (
      <Panel className="min-h-0 flex-1">
        <PanelBody aria-busy="true">
          <Text
            as="p"
            tone="muted"
            className="w-fit animate-type overflow-hidden whitespace-nowrap"
          >
            reading the record ...
          </Text>
        </PanelBody>
      </Panel>
    );
  }

  return (
    <Panel className="min-h-0 flex-1">
      <RowHeader layout="log" className="gap-x-2.5">
        <span>date</span>
        <span className="hidden sm:block">dow</span>
        <span>record</span>
        <span className="hidden sm:block">tally</span>
        <span className="justify-self-end">state</span>
      </RowHeader>
      <div className="min-h-0 flex-1 overflow-auto">
        {orderedDays.map((summary, index) => (
          <LogRow
            key={summary.date}
            ref={(node) => {
              rowRefs.current[index] = node;
            }}
            summary={summary}
            today={today}
            selected={index === cursor}
            onFocus={() => setCursorDate(summary.date)}
            onOpen={onOpen}
          />
        ))}
      </div>
    </Panel>
  );
}

interface LogRowProps {
  summary: DaySummary;
  today: LocalDate;
  selected: boolean;
  onFocus: () => void;
  onOpen: (date: LocalDate) => void;
}

function LogRow({
  ref,
  summary,
  today,
  selected,
  onFocus,
  onOpen,
}: LogRowProps & { ref?: React.Ref<HTMLButtonElement> }) {
  const state = logState(summary, today);

  return (
    <button
      ref={ref}
      type="button"
      aria-current={selected || undefined}
      data-current={selected || undefined}
      // The label replaces everything under it, and the bar is the one thing
      // here with no words of its own, so the counts it draws go in by hand.
      aria-label={logLineLabel(summary, today)}
      onFocus={onFocus}
      onClick={() => onOpen(summary.date)}
      className={cn(
        rowGridVariants({ layout: "log" }),
        // The selected day wears the same block cursor as a roster row.
        "w-full animate-cut gap-x-2.5 border-b border-border py-1.5 text-left transition-colors hover:bg-panel data-current:bg-panel data-current:outline-2 data-current:-outline-offset-2 data-current:outline-ring",
      )}
    >
      <Text size="xs" className="tabular-nums">
        {summary.date}
      </Text>
      <Text size="xs" tone="muted" className="hidden sm:block">
        {weekday(summary.date)}
      </Text>
      <RecordBar segments={recordSegments(summary)} />
      <Text size="xs" tone="muted" className="hidden tabular-nums sm:block">
        {dayTally(summary)}
      </Text>
      <Text size="xs" tone="muted" tracking="wider" caps className="justify-self-end">
        {state}
      </Text>
    </button>
  );
}

/**
 * One day's outcomes as widths of a single bar. An unresolved share is left
 * empty rather than given a colour: the point of the bar is that an open day
 * reads as unfinished at a glance.
 */
function RecordBar({ segments }: { segments: RecordSegment[] }) {
  return (
    <span className="flex h-2 min-w-0 self-center border border-border">
      {segments.map((segment) => (
        <span
          key={segment.outcome}
          className={SEGMENT_FILL[segment.outcome]}
          // Data-driven proportions: the share each outcome took of the day.
          style={{ flex: `${segment.count} 1 0` }}
        />
      ))}
    </span>
  );
}
