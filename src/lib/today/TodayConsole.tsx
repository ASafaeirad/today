import type { LocalDate } from "#domain/date";

import type { ProgressionView } from "./experience";

import {
  LOG_DAYS,
  logSummary,
  lookbackNote,
  sealCta,
  sealStamp,
  type BalanceView,
  type ConsoleModel,
  type DaySummary,
  type Loadable,
  useConsoleModel,
} from "./console";
import {
  BacklogBar,
  ConsoleFooter,
  LogLine,
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
import { LogScreen } from "./LogScreen";
import { PlanScreen } from "./PlanScreen";
import { BackfillBar, ProgressionBar } from "./ProgressionBar";
import { SealDialog } from "./SealDialog";

/** The route interface. Convex stays behind the console model. */
export function TodayConsole({ today }: { today: LocalDate }) {
  return <TodayConsoleView model={useConsoleModel(today)} />;
}

function readyValue<T>(read: Loadable<T>): T | undefined {
  return read.status === "ready" ? read.value : undefined;
}

/** The renderer shared by the production and Storybook adapters. */
export function TodayConsoleView({ model: c }: { model: ConsoleModel }) {
  const day = readyValue(c.day);
  const history = readyValue(c.history.days);
  const balance = readyValue(c.balance);
  const handleLogCursor = (date: LocalDate) => c.commands.selectLogDate(date);
  const handleOpenDate = (date: LocalDate) => c.commands.openDate(date);
  const beginClose = () => {
    if (c.facts.canSeal) c.seal.begin(c.date);
  };

  return (
    <div className="grid h-full grid-terminal overflow-hidden bg-background text-foreground">
      <ConsoleHead model={c} onClose={beginClose} />
      <div className="flex min-h-0 flex-col p-2.5">
        {c.mode === "plan" ? (
          <PlanScreen plan={c.plan} onDone={() => c.commands.enterMode("track")} />
        ) : c.mode === "log" ? (
          <LogScreen
            days={history}
            today={c.today}
            selectedDate={c.logSelection}
            onCursor={handleLogCursor}
            onOpen={handleOpenDate}
          />
        ) : (
          <DayScreen
            day={day}
            date={c.date}
            isToday={!c.lookingBack}
            cursor={c.rosterSelection.index}
            onCursor={(index) => {
              const entry = c.roster[index];
              if (entry) c.commands.selectRoster(entry.routineId);
            }}
            onMark={(entry, outcome) => c.commands.mark(entry.routineId, outcome)}
          />
        )}
      </div>
      <div>
        {c.facts.sealed && c.mode === "track" ? (
          <SealStamp
            text={sealStamp(c.date, c.facts.done, c.facts.scheduled, day?.award ?? null)}
          />
        ) : null}
        <ConsoleFooter
          mode={c.mode}
          sealed={c.facts.sealed}
          marking={c.facts.marking}
          canSeal={c.facts.canSeal}
          sealLabel={sealCta(c.date, c.today)}
          onSeal={beginClose}
        />
        <output aria-live="polite" className="sr-only">
          {c.announcement}
        </output>
      </div>
      {c.seal.workflow.state !== "idle" ? <SealDialog seal={c.seal} balance={balance} /> : null}
    </div>
  );
}

function ConsoleHead({ model: c, onClose }: { model: ConsoleModel; onClose: () => void }) {
  const history = readyValue(c.history.days);
  const backlog = readyValue(c.backlog) ?? null;
  const progression = readyValue(c.progression);
  const handleMode = (mode: ConsoleModel["mode"]) => c.commands.enterMode(mode);
  const handleDismissBackfill = () => c.commands.dismissBackfill();
  const handlePick = (date: LocalDate) => c.commands.goToDate(date);
  const handleStep = (delta: number) => c.commands.stepDay(delta);
  const handleBacklog = () => c.commands.resolveBacklog();
  const handleDismissNotice = () => c.commands.dismissNotice();
  const nagging = c.mode === "track" && backlog !== null && backlog.date !== c.date;

  return (
    <div>
      <TopBar date={c.date} mode={c.mode} sealed={c.facts.sealed} onMode={handleMode} />
      <ProgressionBar progression={progression} pending={c.pendingExperience} />
      <BackfillBar backfill={progression?.backfill} onDismiss={handleDismissBackfill} />
      <DayStrip
        days={history}
        date={c.date}
        onPick={handlePick}
        onStep={handleStep}
        canStepBack={c.canStepBack}
        canStepForward={c.canStepForward}
      />
      {c.mode === "plan" ? <PlanBanner /> : null}
      {c.mode === "track" && c.lookingBack ? (
        <LookbackBar
          date={c.date}
          note={lookbackNote(c.facts.sealed, c.facts.open)}
          onToday={() => c.commands.goToDate(c.today)}
        />
      ) : null}
      {nagging && backlog ? <BacklogBar summary={backlog} onResolve={handleBacklog} /> : null}
      {c.notice ? <Notice text={c.notice} onDismiss={handleDismissNotice} /> : null}
      <div className="px-2.5 pt-2.5">
        <ConsoleModeLine
          model={c}
          history={history}
          balance={readyValue(c.balance)}
          progression={progression}
          onClose={onClose}
        />
      </div>
    </div>
  );
}

function ConsoleModeLine({
  model: c,
  history,
  balance,
  progression,
  onClose,
}: {
  model: ConsoleModel;
  history: DaySummary[] | undefined;
  balance: BalanceView | undefined;
  progression: ProgressionView | undefined;
  onClose: () => void;
}) {
  if (c.mode === "plan") return <PlanLine count={readyValue(c.plan.routines)?.length ?? 0} />;
  if (c.mode === "log") {
    return (
      <LogLine
        summary={history && logSummary(history, c.today)}
        days={LOG_DAYS}
        progression={progression}
      />
    );
  }
  return (
    <TrackLine
      resolved={c.facts.scheduled - c.facts.open}
      scheduled={c.facts.scheduled}
      open={c.facts.open}
      done={c.facts.done}
      missed={c.facts.missed}
      balance={balance}
      progression={progression}
      canSeal={c.facts.canSeal}
      isToday={!c.lookingBack}
      onSeal={onClose}
    />
  );
}
