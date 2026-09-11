import type { LocalDate } from "#domain/date";

import {
  Bar,
  BarBrand,
  BarItem,
  BarSpacer,
  Button,
  CommandLine,
  CommandLineValue,
  Kbd,
  Tab,
  TabList,
  TabStatus,
  Text,
} from "#ui";

import { slotLabel, slotStatus, type DaySummary } from "./console";

interface TopBarProps {
  selected: LocalDate;
  today: DaySummary | undefined;
  backlog: number;
  readOnly: boolean;
}

export function TopBar({ selected, today, backlog, readOnly }: TopBarProps) {
  const resolved = today ? today.scheduled - today.open : 0;
  return (
    <Bar>
      <BarBrand>TODAY</BarBrand>
      <BarItem label="day">{selected}</BarItem>
      <BarItem label="res" tone="done">
        {resolved}/{today?.scheduled ?? 0}
      </BarItem>
      <BarItem label="backlog" tone="seal">
        {backlog}
      </BarItem>
      <BarSpacer />
      <BarItem label="mode" divided={false}>
        {readOnly ? "RO" : "RW"}
      </BarItem>
    </Bar>
  );
}

interface ProgressLineProps {
  today: DaySummary | undefined;
  backlog: number;
  onJump: () => void;
}

/** The progress line, written as a command you can run. */
export function ProgressLine({ today, backlog, onJump }: ProgressLineProps) {
  const resolved = today ? today.scheduled - today.open : 0;
  const openAnywhere = backlog > 0 || (today?.open ?? 0) > 0;
  return (
    <CommandLine action={openAnywhere ? "jump --next-open" : undefined} onClick={onJump}>
      <CommandLineValue>
        {resolved}/{today?.scheduled ?? 0}
      </CommandLineValue>{" "}
      resolved today · <CommandLineValue>{backlog}</CommandLineValue> earlier{" "}
      {backlog === 1 ? "day" : "days"} open{openAnywhere ? "" : " · [clear]"}
    </CommandLine>
  );
}

/** A refusal from the ledger, printed under the prompt until the next tap. */
export function Notice({ text }: { text: string }) {
  return (
    <div className="tone-missed tone-tint border-b border-border px-2.5 py-1">
      <Text tone="record" size="sm" role="alert">
        ! {text}
      </Text>
    </div>
  );
}

interface DayStripProps {
  dates: readonly LocalDate[];
  summaries: ReadonlyMap<LocalDate, DaySummary>;
  today: LocalDate;
  ref: React.Ref<HTMLDivElement>;
}

export function DayStrip({ dates, summaries, today, ref }: DayStripProps) {
  return (
    <TabList ref={ref} aria-label="Days">
      {dates.map((date) => {
        const status = slotStatus(summaries.get(date));
        return (
          <Tab key={date} value={date}>
            <span className="tracking-wide">{slotLabel(date, today)}</span>
            <TabStatus tone={status.tone}>{status.text}</TabStatus>
          </Tab>
        );
      })}
    </TabList>
  );
}

const LEGEND = [
  ["h l", "day"],
  ["j k", "routine"],
  ["d", "done"],
  ["m", "missed"],
  ["s", "skipped"],
] as const;

interface FooterProps {
  sealed: boolean;
  empty: boolean;
  ready: boolean;
  onSeal: () => void;
}

export function ConsoleFooter({ sealed, empty, ready, onSeal }: FooterProps) {
  return (
    <Bar placement="bottom">
      {LEGEND.map(([key, action]) => (
        <BarItem key={key} tone="muted" label={<Kbd>{key}</Kbd>}>
          {action}
        </BarItem>
      ))}
      <BarSpacer />
      <Button
        variant="accent"
        size="lg"
        className="border-l border-border"
        disabled={!ready || sealed || empty}
        onClick={onSeal}
      >
        {sealed ? "LOCKED" : empty ? "NO DATA" : "Z · SEAL"}
      </Button>
    </Bar>
  );
}
