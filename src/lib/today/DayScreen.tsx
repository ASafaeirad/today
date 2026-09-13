import type { MarkOutcome } from "#domain/outcome";

import { Heading, Panel, PanelBody, RowHeader, Text } from "#ui";

import type { DayView, RosterEntry } from "./ledger";

import { rowStatus } from "./console";
import { RosterRow } from "./RosterRow";

interface Props {
  day: DayView | undefined;
  date: string;
  /** A past day with an empty roster is a lapse, not a slate to fill in. */
  isToday: boolean;
  cursor: number;
  rowRefs: React.RefObject<(HTMLDivElement | null)[]>;
  onCursor: (index: number) => void;
  onMark: (entry: RosterEntry, outcome: MarkOutcome) => void;
}

/** Track mode: the day's roster, and the three keys that resolve each line. */
export function DayScreen({ day, date, isToday, cursor, rowRefs, onCursor, onMark }: Props) {
  if (day === undefined) return <Boot date={date} />;

  if (day.roster.length === 0) {
    return (
      <Panel className="min-h-0 flex-1">
        <PanelBody>
          <Heading as="h2" size="base" prompt>
            {isToday ? "today --empty" : `${date} --empty`}
          </Heading>
          <Text tone="muted">
            {isToday
              ? "no routines yet. switch to plan and name one — it runs every day. no schedule, no setup."
              : "nothing was scheduled on this day. there is nothing here to resolve or to seal."}
          </Text>
        </PanelBody>
      </Panel>
    );
  }

  return (
    <Panel className="min-h-0 flex-1">
      <RowHeader>
        <span>#</span>
        <span>routine</span>
        <span className="hidden sm:block">state</span>
        <span className="hidden justify-self-end sm:block">set</span>
      </RowHeader>
      <div data-sealed={day.sealed || undefined} className="min-h-0 flex-1 overflow-auto">
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
    </Panel>
  );
}

/** The screen while the roster loads: a listing that types itself. */
function Boot({ date }: { date: string }) {
  return (
    <Panel className="min-h-0 flex-1">
      <PanelBody aria-busy="true" className="gap-0.5">
        <Text as="p" tone="muted" className="w-fit animate-type overflow-hidden whitespace-nowrap">
          today · routine day ledger
        </Text>
        <Text as="p" tone="muted" className="w-fit animate-type overflow-hidden whitespace-nowrap">
          loading roster for {date} ...
        </Text>
      </PanelBody>
    </Panel>
  );
}
