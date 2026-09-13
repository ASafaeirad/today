import type { LocalDate } from "#domain/date";

import { cn } from "#lib/cn";
import { Panel, PanelBody, RowHeader, rowGridVariants, Text } from "#ui";

import {
  dayTally,
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
  /** The day the console is parked on, so the log says where returning lands. */
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
        {days
          .slice()
          .reverse()
          .map((summary) => (
            <LogRow
              key={summary.date}
              summary={summary}
              today={today}
              current={summary.date === date}
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
  current: boolean;
  onOpen: (date: LocalDate) => void;
}

function LogRow({ summary, today, current, onOpen }: LogRowProps) {
  const state = logState(summary, today);

  return (
    <button
      type="button"
      aria-current={current || undefined}
      aria-label={`${summary.date} · ${weekday(summary.date)} · ${state}`}
      onClick={() => onOpen(summary.date)}
      className={cn(
        rowGridVariants({ layout: "log" }),
        // The day the console is parked on wears the same block cursor a
        // roster row does, so the log says where leaving it would land.
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
