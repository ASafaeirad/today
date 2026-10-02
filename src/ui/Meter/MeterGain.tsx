import NumberFlow, { continuous } from "@number-flow/react";
import { useState, type ComponentProps } from "react";

import { cn } from "#lib/cn";

import { Text } from "../Text/Text";
import { Meter, MeterIndicator, MeterTrack } from "./Meter";

const FILL_MS = 600;
const INITIAL_PAUSE_MS = 240;
const STEP_PAUSE_MS = 160;

export interface MeterGainStage {
  from: number;
  to: number;
  max: number;
  suffix?: string;
  /** The accessible name for this stage's current or target value. */
  valueLabel: (value: number) => string;
}

export interface MeterGainProps extends Omit<ComponentProps<"div">, "children"> {
  /** Increasing ranges, in order. Each stage starts a new meter. */
  stages: readonly MeterGainStage[];
  /** Milliseconds before the initial pause and fill. */
  delay?: number;
}

/** Total time until the last fill finishes, including pauses between stages. */
export function meterGainDuration(stageCount: number, delay = 0): number {
  if (stageCount === 0) return 0;
  return delay + INITIAL_PAUSE_MS + FILL_MS + (stageCount - 1) * (STEP_PAUSE_MS + FILL_MS);
}

/** Preserve the existing fill and animate each addition with its number reading. */
export function MeterGain({ stages, ...props }: MeterGainProps) {
  // A new range replays the gain from its own starting value.
  const sequence = stages.map(({ from, to, max }) => `${from}:${to}:${max}`).join("/");
  return <MeterGainSequence key={sequence} stages={stages} {...props} />;
}

function MeterGainSequence({ stages, delay = 0, className, ...props }: MeterGainProps) {
  const [index, setIndex] = useState(0);
  const [filling, setFilling] = useState(false);
  const stage = stages[index];
  if (stage === undefined) return null;
  const { from, to, max, suffix, valueLabel } = stage;
  const baseline = (from / max) * 100;
  const gain = ((to - from) / max) * 100;
  const value = filling ? to : from;

  return (
    <div data-slot="meter-gain" className={cn("flex items-center gap-2.25", className)} {...props}>
      <Meter tone="ink" value={value} max={max} aria-label={valueLabel(value)}>
        <MeterTrack key={index} className="h-2">
          <MeterIndicator style={{ width: `${baseline}%` }} data-slot="meter-existing" />
          <span
            aria-hidden="true"
            data-slot="meter-addition"
            className="absolute inset-y-0 origin-left animate-meter-gain bg-done"
            style={{
              left: `${baseline}%`,
              width: `${gain}%`,
              animationDelay: `${index === 0 ? delay + INITIAL_PAUSE_MS : STEP_PAUSE_MS}ms`,
            }}
            onAnimationStart={() => setFilling(true)}
            onAnimationEnd={() => {
              if (index < stages.length - 1) {
                setIndex(index + 1);
                setFilling(false);
              }
            }}
          />
        </MeterTrack>
      </Meter>
      <Text size="xs" tone="muted" className="whitespace-nowrap tabular-nums">
        <NumberFlow
          key={index}
          value={value}
          aria-label={`${value}${suffix ?? ""}`}
          format={{ useGrouping: false }}
          suffix={suffix}
          plugins={[continuous]}
          transformTiming={{ duration: FILL_MS, easing: "linear" }}
          opacityTiming={{ duration: 120, easing: "linear" }}
        />
      </Text>
    </div>
  );
}
