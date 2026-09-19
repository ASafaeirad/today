import { useEffect, useRef } from "react";

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
import { logExperience } from "./experience";

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
  selectedDate: LocalDate;
  onCursor: (date: LocalDate) => void;
  onOpen: (date: LocalDate) => void;
}

/**
 * Log mode: every day in the window, newest first, each written as one line.
 *
 * This is the record and nothing else — no line here marks or seals anything.
 * Opening a day is the only thing it does, which is what makes it safe to be
 * the mode you leave the console sitting in.
 */
export function LogScreen({ days, today, selectedDate, onCursor, onOpen }: LogScreenProps) {
  const orderedDays = days?.slice().reverse() ?? [];
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const foundCursor = orderedDays.findIndex((summary) => summary.date === selectedDate);
  const cursor = Math.max(0, foundCursor);

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
        <span>xp</span>
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
            onFocus={() => onCursor(summary.date)}
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
      {/* A held day is marked rather than footnoted: the number is banked, it
          is simply not the last word until the older day is reviewed. */}
      <Text
        size="xs"
        tone={summary.award === null ? "subtle" : undefined}
        className={cn("tabular-nums", { "tone-skipped tone-fg": summary.award?.held })}
      >
        {logExperience(summary.award, summary.sealed)}
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
