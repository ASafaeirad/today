import { useRef } from "react";

import type { LocalDate } from "#domain/date";

import { rowStatus, sealStamp } from "./console";
import {
  BacklogBar,
  ConsoleFooter,
  Notice,
  PlanBanner,
  PlanLine,
  SealStamp,
  TopBar,
  TrackLine,
} from "./ConsoleChrome";
import { DayScreen } from "./DayScreen";
import { PlanScreen } from "./PlanScreen";
import { SealDialog } from "./SealDialog";
import { useTodayController } from "./useTodayController";

/**
 * Two modes over one day. Track is the hot path — mark and seal, never edit the
 * list. Plan is where routines are created and retired, and it can do neither
 * of the other two.
 */
export function TodayConsole({ today }: { today: LocalDate }) {
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const c = useTodayController(today, { rowRefs });

  const planning = c.mode === "plan";
  const { backlog } = c;
  const scheduled = c.roster.length;
  const open = c.roster.filter((entry) => rowStatus(entry) === "open").length;
  const done = c.roster.filter((entry) => rowStatus(entry) === "done").length;
  // The track line is clickable whatever it says, so the sealed day has to be
  // gated here: `days.close` on a sealed day succeeds as a no-op, which would
  // put an irreversible-looking dialog in front of a record that is already
  // locked.
  const canSeal = c.day !== undefined && !c.sealed && scheduled > 0;
  const beginSeal = () => {
    if (canSeal) c.seal.begin(today);
  };

  return (
    <div className="grid h-full grid-terminal overflow-hidden bg-background text-foreground">
      <div>
        <TopBar date={today} mode={c.mode} sealed={c.sealed} onMode={(next) => c.enterMode(next)} />
        {planning ? <PlanBanner /> : null}
        {!planning && backlog ? (
          <BacklogBar summary={backlog} onResolve={() => c.seal.begin(backlog.date)} />
        ) : null}
        {c.notice ? <Notice text={c.notice} onDismiss={() => c.dismissNotice()} /> : null}
        <div className="px-2.5 pt-2.5">
          {planning ? (
            <PlanLine count={c.plan.routines?.length ?? 0} />
          ) : (
            <TrackLine
              resolved={scheduled - open}
              scheduled={scheduled}
              open={open}
              balance={c.balance}
              canSeal={canSeal}
              onSeal={beginSeal}
            />
          )}
        </div>
      </div>
      <div className="flex min-h-0 flex-col p-2.5">
        {planning ? (
          <PlanScreen plan={c.plan} onDone={() => c.enterMode("track")} />
        ) : (
          <DayScreen
            day={c.day}
            date={today}
            cursor={c.cursor}
            rowRefs={rowRefs}
            onCursor={(index) => c.setCursor(index)}
            onMark={(entry, outcome) => c.mark(entry, outcome)}
          />
        )}
      </div>
      <div>
        {c.sealed && !planning ? <SealStamp text={sealStamp(today, done, scheduled)} /> : null}
        <ConsoleFooter
          mode={c.mode}
          sealed={c.sealed}
          marking={c.marking}
          canSeal={canSeal}
          onSeal={beginSeal}
        />
        <output aria-live="polite" className="sr-only">
          {c.announcement}
        </output>
      </div>
      {c.seal.date !== null ? <SealDialog seal={c.seal} balance={c.balance} /> : null}
    </div>
  );
}
