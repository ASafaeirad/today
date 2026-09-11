import type { FunctionReturnType } from "convex/server";

import type { api } from "#convex/_generated/api";
import type { Outcome } from "#domain/outcome";

import { Bar, BarItem, RowHeader, Text } from "#ui";

import { clockIn, dayLabel, rowStatus } from "./console";
import { RosterRow } from "./RosterRow";

export type DayView = FunctionReturnType<typeof api.days.get>;
export type RosterEntry = DayView["roster"][number];

interface Props {
  day: DayView | undefined;
  date: string;
  timezone: string;
  cursor: number;
  rowRefs: React.RefObject<(HTMLDivElement | null)[]>;
  onCursor: (index: number) => void;
  onMark: (entry: RosterEntry, outcome: Outcome | null) => void;
}

const STATE_TEXT = {
  open: "OPEN",
  awaitingReview: "AWAITING REVIEW",
  closed: "CLOSED",
} as const;

function count(day: DayView, outcome: Outcome): number {
  return day.roster.filter((entry) => rowStatus(entry) === outcome).length;
}

export function DayScreen({ day, date, timezone, cursor, rowRefs, onCursor, onMark }: Props) {
  if (day === undefined) return <Boot date={date} />;

  const stateText =
    day.sealed && day.closedAt !== null
      ? `SEALED ${clockIn(day.closedAt, timezone)}`
      : STATE_TEXT[day.state];

  return (
    <>
      <Bar className="sticky top-0 z-2 gap-3.5 px-2.5">
        <BarItem label="day" divided={false} className="px-0">
          {dayLabel(day.date)}
        </BarItem>
        <BarItem label="done" tone="done" divided={false} className="px-0">
          {count(day, "done")}
        </BarItem>
        <BarItem label="missed" tone="missed" divided={false} className="px-0">
          {count(day, "missed")}
        </BarItem>
        <BarItem label="skipped" tone="skipped" divided={false} className="px-0">
          {count(day, "skipped")}
        </BarItem>
        <BarItem label="state" tone={day.sealed ? "seal" : "ink"} divided={false} className="px-0">
          {stateText}
        </BarItem>
      </Bar>
      {day.sealed && day.closingNote ? (
        <Bar variant="note">
          <Text tone="record" className="px-2.5 py-1">
            note: {day.closingNote}
          </Text>
        </Bar>
      ) : null}
      {day.roster.length === 0 ? (
        <Text
          as="p"
          tone="subtle"
          tracking="widest"
          className="animate-cut px-2.5 py-8.5 text-center"
        >
          — NO ROUTINES ON RECORD —
        </Text>
      ) : (
        <>
          <RowHeader className="top-6.5">
            <span>#</span>
            <span>routine</span>
            <span className="hidden sm:block">state</span>
            <span className="hidden justify-self-end sm:block">set</span>
          </RowHeader>
          <div data-sealed={day.sealed || undefined}>
            {day.roster.map((entry, index) => (
              <RosterRow
                key={entry.instanceId}
                ref={(node) => {
                  rowRefs.current[index] = node;
                }}
                index={index}
                name={entry.name}
                status={rowStatus(entry)}
                current={index === cursor}
                sealed={day.sealed}
                onFocus={() => onCursor(index)}
                onMark={(outcome) => onMark(entry, outcome)}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

/** The screen while the roster loads: a listing that types itself. */
function Boot({ date }: { date: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-2.5 py-3.5" aria-busy="true">
      <Text as="p" tone="muted" className="w-fit animate-type overflow-hidden whitespace-nowrap">
        vigil · routine day ledger
      </Text>
      <Text as="p" tone="muted" className="w-fit animate-type overflow-hidden whitespace-nowrap">
        loading roster for {date} ...
      </Text>
    </div>
  );
}
