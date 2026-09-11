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
  Text,
  Toggle,
  ToggleGroup,
} from "#ui";

import { backlogLine, dayLabel, shortDayLabel, type DaySummary, type Mode } from "./console";

interface TopBarProps {
  date: LocalDate;
  mode: Mode;
  sealed: boolean;
  onMode: (mode: Mode) => void;
}

const DAY_STATE = {
  sealed: "sealed",
  plan: "planning",
  track: "open",
} as const;

export function TopBar({ date, mode, sealed, onMode }: TopBarProps) {
  return (
    <Bar>
      <BarBrand>today</BarBrand>
      <BarItem>
        <span className="sm:hidden">{shortDayLabel(date)}</span>
        <span className="hidden sm:inline">{dayLabel(date)}</span>
      </BarItem>
      <BarSpacer />
      <ToggleGroup
        className="self-stretch"
        aria-label="Mode"
        value={[mode]}
        onValueChange={(next) => onMode((next[0] as Mode | undefined) ?? mode)}
      >
        {(["track", "plan"] as const).map((value) => (
          <Toggle
            key={value}
            value={value}
            tone="ink"
            className="min-h-11 px-3 uppercase sm:min-h-7"
          >
            {value}
          </Toggle>
        ))}
      </ToggleGroup>
      <BarItem tone="muted" divided={false}>
        {sealed ? DAY_STATE.sealed : DAY_STATE[mode]}
      </BarItem>
    </Bar>
  );
}

/** Plan mode says what it is, because nothing in it marks or seals a day. */
export function PlanBanner() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 bg-inverted px-2.5 py-1.75 text-inverted-foreground">
      <Text size="xs" tracking="widest" caps>
        — plan mode —
      </Text>
      <Text size="xs" className="opacity-80">
        editing the routine list. nothing here marks or seals a day.
      </Text>
    </div>
  );
}

interface BacklogBarProps {
  summary: DaySummary;
  onResolve: () => void;
}

/** The one nag the console allows itself: a day that was never sealed. */
export function BacklogBar({ summary, onResolve }: BacklogBarProps) {
  return (
    <div className="tone-missed tone-tint flex items-center gap-2.5 border-b border-border px-2.5 py-1.5">
      <Text tone="record" size="xs" tracking="widest" caps className="hidden sm:inline">
        ! open
      </Text>
      <Text tone="muted" size="xs" className="min-w-0 flex-1 truncate">
        {backlogLine(summary)}
      </Text>
      <Button size="sm" className="min-h-11 sm:min-h-6" onClick={onResolve}>
        resolve
      </Button>
    </div>
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

interface ProgressLineProps {
  resolved: number;
  scheduled: number;
  open: number;
  onSeal: () => void;
}

/** The day's progress, written as the command that would finish it. */
export function TrackLine({ resolved, scheduled, open, onSeal }: ProgressLineProps) {
  return (
    <CommandLine action={open > 0 ? "seal --resolve-first" : "seal --now"} onClick={onSeal}>
      <CommandLineValue>
        {resolved}/{scheduled}
      </CommandLineValue>{" "}
      resolved today · <CommandLineValue>{open}</CommandLineValue> open
    </CommandLine>
  );
}

/** The same line in plan mode: a count, and the setup that does not exist. */
export function PlanLine({ count }: { count: number }) {
  return (
    <CommandLine action="routines --daily" disabled>
      <CommandLineValue>{count}</CommandLineValue> active · no schedules to maintain
    </CommandLine>
  );
}

/** The stamp a sealed day wears. Nothing below it is editable again. */
export function SealStamp({ text }: { text: string }) {
  return (
    <div className="tone-seal tone-tint tone-border mx-2.5 mb-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 border px-3 py-2.5">
      <Text tone="record" size="sm" tracking="widest" caps>
        {text}
      </Text>
      <Text tone="muted" size="xs">
        record locked — this day can no longer be edited
      </Text>
    </div>
  );
}

interface FooterProps {
  mode: Mode;
  sealed: boolean;
  marking: boolean;
  canSeal: boolean;
  onSeal: () => void;
}

function Keys({ keys }: { keys: readonly string[] }) {
  return (
    <span className="inline-flex gap-1">
      {keys.map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
    </span>
  );
}

export function ConsoleFooter({ mode, sealed, marking, canSeal, onSeal }: FooterProps) {
  return (
    <Bar placement="bottom">
      {mode === "plan" ? (
        <BarItem tone="muted" label={<Keys keys={["ESC"]} />}>
          back to track mode
        </BarItem>
      ) : null}
      {marking ? (
        <>
          <BarItem tone="muted" label={<Keys keys={["J", "K"]} />} className="hidden sm:flex">
            move
          </BarItem>
          <BarItem tone="muted" label={<Keys keys={["D", "M", "S"]} />} className="hidden sm:flex">
            mark
          </BarItem>
          <BarItem tone="muted" label={<Keys keys={["P"]} />} className="hidden sm:flex">
            plan
          </BarItem>
        </>
      ) : null}
      <BarSpacer />
      {sealed ? (
        <BarItem tone="muted" divided={false}>
          read only
        </BarItem>
      ) : null}
      {marking ? (
        <Button
          variant="accent"
          className="border-l border-border"
          disabled={!canSeal}
          onClick={onSeal}
        >
          <span className="hidden sm:inline">Z · </span>SEAL THE DAY
        </Button>
      ) : null}
    </Bar>
  );
}
