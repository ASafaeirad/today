import { cn } from "#lib/cn";
import { Button, Meter, MeterIndicator, MeterTrack, Text } from "#ui";

import {
  backfillLine,
  heldLine,
  levelView,
  pendingLine,
  streakLine,
  type LevelView,
  type ProgressionView,
} from "./experience";

/** One reading of the bar, walled off from its neighbours by a rule. */
function Cell({ className, ...props }: React.ComponentProps<typeof Text>) {
  return (
    <Text
      size="xs"
      tracking="widest"
      caps
      className={cn(
        "flex items-center border-l border-border px-2.5 py-1.75 whitespace-nowrap",
        className,
      )}
      {...props}
    />
  );
}

interface Props {
  progression: ProgressionView | undefined;
  /** Done marks on the day being looked at, worth a point each once it closes. */
  pending: number;
}

/**
 * The persistent reading of progression, under the chrome on every screen: the
 * level, how far into it the owner is, the lifetime total, and what the run is
 * currently multiplying a close by.
 *
 * The two chips at the end are the only parts that come and go. Pending
 * Experience is the day's done marks and nothing more — it is not banked, and
 * changing a mark takes it back. A held bonus says an older day is standing
 * between the run and its multiplier, which is a fact about the *backlog* and
 * belongs next to the streak it is holding up.
 */
export function ProgressionBar({ progression, pending }: Props) {
  if (progression === undefined) return null;
  const level = levelView(progression.experience);

  return (
    <div className="flex items-stretch border-b border-border">
      <Text
        tone="inherit"
        size="xs"
        tracking="widest"
        caps
        className="flex items-center bg-inverted px-2 py-1.75 whitespace-nowrap text-inverted-foreground"
      >
        lv {level.plate}
      </Text>
      <LevelMeter level={level} />
      <Cell className="hidden sm:flex">{level.lifetimeLine}</Cell>
      <Cell className="hidden sm:flex">
        {streakLine(progression.streak, progression.multiplier)}
      </Cell>
      {pending > 0 ? (
        <Text
          tone="inherit"
          size="xs"
          tracking="widest"
          caps
          className="tone-done tone-bg flex animate-cut items-center px-2 py-1.75 whitespace-nowrap"
        >
          <span className="sm:hidden">+{pending} XP</span>
          <span className="hidden sm:inline">{pendingLine(pending)}</span>
        </Text>
      ) : null}
      {progression.heldDays > 0 ? (
        <Text
          tone="record"
          size="xs"
          tracking="widest"
          caps
          // The one place the console explains itself in a tooltip: the chip is
          // about a day that is not on screen.
          title="a newer day banked its base reward; the streak part waits for the older day"
          className="tone-skipped tone-tint flex items-center border-l border-border px-2 py-1.75 whitespace-nowrap"
        >
          <span className="sm:hidden">held</span>
          <span className="hidden sm:inline">{heldLine(progression.heldDays)}</span>
        </Text>
      ) : null}
    </div>
  );
}

/**
 * The title and the meter. A phone stacks them — the title and the span it is
 * measured against on one line, the rail under it — and `contents` unwraps that
 * stack into the bar's own row once there is width for it.
 */
function LevelMeter({ level }: { level: LevelView }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-2.5 py-1.5 sm:flex-row sm:items-center sm:gap-0 sm:p-0">
      <div className="flex min-w-0 items-baseline gap-2 sm:contents">
        <Text
          size="xs"
          tracking="widest"
          caps
          className="min-w-0 flex-1 truncate sm:flex-none sm:border-r sm:border-border sm:px-2.5 sm:py-1.75"
        >
          {level.title}
        </Text>
        <Text size="xs" tone="muted" className="order-1 whitespace-nowrap sm:pr-2.5">
          {level.spanLine}
        </Text>
      </div>
      <div className="flex items-center sm:min-w-0 sm:flex-1 sm:px-2.5">
        <Meter
          tone="ink"
          value={level.percent}
          aria-label={`level ${level.level}, ${level.into} of ${level.span} experience to level ${level.level + 1}`}
        >
          <MeterTrack className="h-2">
            <MeterIndicator />
          </MeterTrack>
        </Meter>
      </div>
    </div>
  );
}

/** A brief, dismissible receipt for experience carried in from closed history. */
export function BackfillBar({
  backfill,
  onDismiss,
}: {
  backfill: { days: number; experience: number } | null | undefined;
  onDismiss: () => void;
}) {
  if (backfill == null) return null;
  return (
    <div className="flex min-w-0 items-center gap-2 border-b border-border bg-chrome px-2.5 py-1">
      <output className="min-w-0 flex-1">
        <Text as="p" size="sm" className="leading-snug">
          {backfillLine(backfill.days, backfill.experience)}
        </Text>
      </output>
      <Button variant="ghost" size="sm" className="min-h-11 sm:min-h-6" onClick={onDismiss}>
        dismiss
      </Button>
    </div>
  );
}
