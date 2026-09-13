import { useRef } from "react";

import type { LocalDate } from "#domain/date";

import { lookbackNote, rowStatus, sealCta, sealStamp } from "./console";
import {
  BacklogBar,
  ConsoleFooter,
  LookbackBar,
  Notice,
  PlanBanner,
  PlanLine,
  SealStamp,
  TopBar,
  TrackLine,
} from "./ConsoleChrome";
import { DayScreen } from "./DayScreen";
import { DayStrip } from "./DayStrip";
import { PlanScreen } from "./PlanScreen";
import { SealDialog } from "./SealDialog";
import { useTodayController, type TodayController } from "./useTodayController";

/** What the whole screen agrees on about the day it is looking at. */
interface DayFacts {
  scheduled: number;
  open: number;
  done: number;
  /** False on a day with nothing to seal, and on one already sealed. */
  canSeal: boolean;
  planning: boolean;
}

function factsOf(c: TodayController): DayFacts {
  const scheduled = c.roster.length;
  return {
    scheduled,
    open: c.roster.filter((entry) => rowStatus(entry) === "open").length,
    done: c.roster.filter((entry) => rowStatus(entry) === "done").length,
    // The track line is clickable whatever it says, so the sealed day has to
    // be gated here: `days.close` on a sealed day succeeds as a no-op, which
    // would put an irreversible-looking dialog in front of a record that is
    // already locked.
    canSeal: c.day !== undefined && !c.sealed && scheduled > 0,
    planning: c.mode === "plan",
  };
}

/**
 * Two modes over one day. Track is the hot path — mark and seal, never edit the
 * list. Plan is where routines are created and retired, and it can do neither
 * of the other two.
 *
 * Which day that is need not be today. Looking back opens the same track
 * screen: an unsealed past day is still markable and still sealable, and a
 * sealed one is that same screen behind glass.
 */
export function TodayConsole({ today }: { today: LocalDate }) {
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const c = useTodayController(today, { rowRefs });
  const facts = factsOf(c);

  const beginSeal = () => {
    if (facts.canSeal) c.seal.begin(c.date);
  };

  return (
    <div className="grid h-full grid-terminal overflow-hidden bg-background text-foreground">
      <ConsoleHead c={c} facts={facts} today={today} onSeal={beginSeal} />
      <div className="flex min-h-0 flex-col p-2.5">
        {facts.planning ? (
          <PlanScreen plan={c.plan} onDone={() => c.enterMode("track")} />
        ) : (
          <DayScreen
            day={c.day}
            date={c.date}
            isToday={!c.lookingBack}
            cursor={c.cursor}
            rowRefs={rowRefs}
            onCursor={(index) => c.setCursor(index)}
            onMark={(entry, outcome) => c.mark(entry, outcome)}
          />
        )}
      </div>
      <div>
        {c.sealed && !facts.planning ? (
          <SealStamp text={sealStamp(c.date, facts.done, facts.scheduled)} />
        ) : null}
        <ConsoleFooter
          mode={c.mode}
          sealed={c.sealed}
          marking={c.marking}
          canSeal={facts.canSeal}
          sealLabel={sealCta(c.date, today)}
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

interface HeadProps {
  c: TodayController;
  facts: DayFacts;
  today: LocalDate;
  onSeal: () => void;
}

/**
 * The chrome above the record: which day, how to reach the others, and every
 * banner that qualifies what is underneath.
 */
function ConsoleHead({ c, facts, today, onSeal }: HeadProps) {
  const { backlog } = c;
  // Nothing to nag about on the very day being resolved.
  const nagging = !facts.planning && backlog !== undefined && backlog.date !== c.date;

  return (
    <div>
      <TopBar date={c.date} mode={c.mode} sealed={c.sealed} onMode={(next) => c.enterMode(next)} />
      <DayStrip
        days={c.history.days}
        date={c.date}
        onPick={(next) => c.goToDate(next)}
        onStep={(delta) => c.stepDay(delta)}
        canStepBack={c.canStepBack}
        canStepForward={c.canStepForward}
      />
      {facts.planning ? <PlanBanner /> : null}
      {!facts.planning && c.lookingBack ? (
        <LookbackBar
          date={c.date}
          note={lookbackNote(c.sealed, facts.open)}
          onToday={() => c.goToDate(today)}
        />
      ) : null}
      {nagging ? (
        <BacklogBar
          summary={backlog}
          onResolve={() => {
            // The day the nudge names is opened as well as sealed: escaping the
            // ceremony should leave the owner on the day it was about, rather
            // than back on today wondering where it went.
            c.goToDate(backlog.date);
            c.seal.begin(backlog.date);
          }}
        />
      ) : null}
      {c.notice ? <Notice text={c.notice} onDismiss={() => c.dismissNotice()} /> : null}
      <div className="px-2.5 pt-2.5">
        {facts.planning ? (
          <PlanLine count={c.plan.routines?.length ?? 0} />
        ) : (
          <TrackLine
            resolved={facts.scheduled - facts.open}
            scheduled={facts.scheduled}
            open={facts.open}
            balance={c.balance}
            canSeal={facts.canSeal}
            isToday={!c.lookingBack}
            onSeal={onSeal}
          />
        )}
      </div>
    </div>
  );
}
