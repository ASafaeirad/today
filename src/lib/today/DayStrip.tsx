import type { LocalDate } from "#domain/date";

import { cn } from "#lib/cn";
import { Button, Text } from "#ui";

import {
  dayTally,
  dayTitle,
  dayTone,
  PHONE_STRIP_DAYS,
  STRIP_DAYS,
  weekday,
  type DaySummary,
} from "./console";

/** The tally is the one thing in the cell that carries the day's verdict. */
const TALLY_INK = {
  done: "text-done",
  missed: "text-missed",
  neutral: "text-foreground",
  empty: "text-subtle-foreground",
} as const;

interface DayStripProps {
  /** The window, oldest first. Undefined while the overview is still reading. */
  days: DaySummary[] | undefined;
  /** The date on screen, which is the cell the strip inverts. */
  date: LocalDate;
  onPick: (date: LocalDate) => void;
  onStep: (delta: number) => void;
  canStepBack: boolean;
  canStepForward: boolean;
}

/**
 * The recent past, under the chrome on every screen: one cell per date, each
 * saying what that day came to and whether it was ever sealed.
 *
 * Today is the first cell and history recedes to the right, which is the order
 * the owner is standing in — the day being worked is where the eye lands, and
 * looking back is a move away from it rather than a scan toward it.
 *
 * Looking back is a first-class move rather than a report you go and open, so
 * the strip is always on screen and every cell is a way into that day. A phone
 * has room for the days nearest today; the step keys reach the rest either way.
 */
export function DayStrip({
  days,
  date,
  onPick,
  onStep,
  canStepBack,
  canStepForward,
}: DayStripProps) {
  // The window is read oldest first everywhere else; only the strip turns it
  // around, because only the strip is a picture of it.
  const cells = days === undefined ? undefined : [...days].reverse();

  return (
    <div className="flex items-stretch overflow-hidden border-b border-border">
      <StepButton direction={1} disabled={!canStepForward} onStep={onStep} />
      <div className="flex min-w-0 flex-1 border-x border-border">
        {cells?.map((summary, index) => (
          <DayCell
            key={summary.date}
            summary={summary}
            current={summary.date === date}
            /* The far end of the window is desktop-only: a phone cell narrower
               than a fingertip is decoration, not a control. */
            onPhone={index < PHONE_STRIP_DAYS}
            onPick={onPick}
          />
        ))}
      </div>
      <Text
        size="xs"
        tone="subtle"
        tracking="widest"
        caps
        className="hidden self-center px-2.5 whitespace-nowrap sm:block"
      >
        last {STRIP_DAYS}
      </Text>
      <StepButton direction={-1} disabled={!canStepBack} onStep={onStep} />
    </div>
  );
}

interface StepButtonProps {
  direction: 1 | -1;
  disabled: boolean;
  onStep: (delta: number) => void;
}

/**
 * One day back or forward, at either end of the strip it moves over.
 *
 * The glyph follows the strip rather than the calendar: today sits at the left
 * and history runs right, so the button that steps back into it points right
 * and stands at that end. The label keeps saying which date it means.
 */
function StepButton({ direction, disabled, onStep }: StepButtonProps) {
  const back = direction === -1;
  const label = back ? "previous day" : "next day";

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onStep(direction)}
      className="min-h-11 min-w-11 sm:min-h-7 sm:min-w-9"
    >
      {back ? "→" : "←"}
    </Button>
  );
}

interface DayCellProps {
  summary: DaySummary;
  current: boolean;
  onPhone: boolean;
  onPick: (date: LocalDate) => void;
}

function DayCell({ summary, current, onPhone, onPick }: DayCellProps) {
  const title = dayTitle(summary);

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-current={current || undefined}
      onClick={() => onPick(summary.date)}
      className={cn(
        "flex h-11 min-w-0 flex-1 flex-col justify-end overflow-hidden border-r border-border transition-colors sm:h-11.5",
        current
          ? "bg-inverted text-inverted-foreground"
          : // A day that was never sealed is hatched wherever it is drawn: the
            // record is not closed, and the strip should not read as if it were.
            cn("hover:bg-panel", !summary.sealed && "tone-missed tone-hatch"),
        !onPhone && "hidden sm:flex",
      )}
    >
      <span
        className={cn(
          "flex flex-1 items-center justify-center text-sm leading-none",
          !current && TALLY_INK[dayTone(summary)],
        )}
      >
        {dayTally(summary)}
      </span>
      <span className="pb-0.75 text-center text-xs leading-tight">{summary.date.slice(8)}</span>
      <span className="pb-1 text-center text-xs leading-none opacity-60">
        {weekday(summary.date)}
      </span>
    </button>
  );
}
