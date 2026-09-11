import { useRef } from "react";

import type { LocalDate } from "#domain/date";

import { TabPanel, Tabs } from "#ui";

import { ConsoleFooter, DayStrip, Notice, ProgressLine, TopBar } from "./ConsoleChrome";
import { DayScreen } from "./DayScreen";
import { SealDialog } from "./SealDialog";
import { useTodayController } from "./useTodayController";

interface Props {
  today: LocalDate;
  timezone: string;
}

export function TodayConsole({ today, timezone }: Props) {
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const c = useTodayController(today, { rowRefs, listRef });

  return (
    <Tabs
      value={c.selected}
      onValueChange={(value) => c.selectDate(value as LocalDate)}
      className="grid h-dvh grid-terminal overflow-hidden"
    >
      <div>
        <TopBar
          selected={c.selected}
          today={c.strip.today}
          backlog={c.strip.backlog}
          readOnly={c.sealed}
        />
        <ProgressLine today={c.strip.today} backlog={c.strip.backlog} onJump={() => c.jump()} />
        {c.notice ? <Notice text={c.notice} /> : null}
        <DayStrip ref={listRef} dates={c.strip.dates} summaries={c.strip.summaries} today={today} />
      </div>
      <TabPanel value={c.selected} className="relative min-h-0 overflow-auto">
        <DayScreen
          day={c.day}
          date={c.selected}
          timezone={timezone}
          cursor={c.cursor}
          rowRefs={rowRefs}
          onCursor={(index) => c.setCursor(index)}
          onMark={(entry, outcome) => c.mark(entry, outcome)}
        />
      </TabPanel>
      <ConsoleFooter
        sealed={c.sealed}
        empty={c.roster.length === 0}
        ready={c.day !== undefined}
        onSeal={() => c.beginSeal()}
      />
      <output aria-live="polite" className="sr-only">
        {c.announcement}
      </output>
      {c.day && c.seal ? (
        <SealDialog
          day={c.day}
          stage={c.seal}
          open
          onStage={(stage) => c.setSeal(stage)}
          onMark={(entry, outcome) => c.mark(entry, outcome)}
          onLock={(note) => c.lock(note)}
          onClose={() => c.endSeal()}
        />
      ) : null}
    </Tabs>
  );
}
