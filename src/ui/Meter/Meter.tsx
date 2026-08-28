import type { VariantProps } from "class-variance-authority";

import { Meter as MeterPrimitive } from "@base-ui/react/meter";
import { cva } from "class-variance-authority";

import { cn } from "#lib/cn";

const meterVariants = cva("flex w-full flex-col gap-1.5", {
  variants: {
    tone: {
      ink: "tone-ink",
      done: "tone-done",
      missed: "tone-missed",
      skipped: "tone-skipped",
      seal: "tone-seal",
    },
  },
  defaultVariants: {
    tone: "seal",
  },
});

export type MeterProps = MeterPrimitive.Root.Props & VariantProps<typeof meterVariants>;

export function Meter({ className, tone = "seal", ...props }: MeterProps) {
  return (
    <MeterPrimitive.Root
      data-slot="meter"
      className={cn(meterVariants({ tone }), className)}
      {...props}
    />
  );
}

export function MeterTrack({ className, ...props }: MeterPrimitive.Track.Props) {
  return (
    <MeterPrimitive.Track
      data-slot="meter-track"
      className={cn("tone-border relative h-3.5 w-full overflow-hidden border", className)}
      {...props}
    />
  );
}

export type MeterIndicatorProps = MeterPrimitive.Indicator.Props & {
  /** Fills in discrete steps on mount, the way a lock engages. */
  animated?: boolean;
};

export function MeterIndicator({ className, animated = false, ...props }: MeterIndicatorProps) {
  return (
    <MeterPrimitive.Indicator
      data-slot="meter-indicator"
      className={cn("tone-rail origin-left", { "animate-fill": animated }, className)}
      {...props}
    />
  );
}

export function MeterValue({ className, ...props }: MeterPrimitive.Value.Props) {
  return (
    <MeterPrimitive.Value
      data-slot="meter-value"
      className={cn("tone-fg text-sm tracking-wider tabular-nums", className)}
      {...props}
    />
  );
}

export function MeterLabel({ className, ...props }: MeterPrimitive.Label.Props) {
  return (
    <MeterPrimitive.Label
      data-slot="meter-label"
      className={cn("text-xs tracking-wider text-muted-foreground uppercase", className)}
      {...props}
    />
  );
}

export { meterVariants };
