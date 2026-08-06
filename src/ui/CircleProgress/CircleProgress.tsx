import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { createContext, use, useId, useMemo } from "react";

import { cn } from "#lib/cn";

const CIRCULAR_PROGRESS_NAME = "CircularProgress";
const INDICATOR_NAME = "CircularProgressIndicator";
const TRACK_NAME = "CircularProgressTrack";
const RANGE_NAME = "CircularProgressRange";
const VALUE_TEXT_NAME = "CircularProgressValueText";

const DEFAULT_MAX = 100;

type ProgressState = "indeterminate" | "complete" | "loading";

function getProgressState(value: number | undefined | null, maxValue: number): ProgressState {
  return value == null ? "indeterminate" : value === maxValue ? "complete" : "loading";
}

function getIsValidNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getIsValidMaxNumber(max: unknown): max is number {
  return getIsValidNumber(max) && max > 0;
}

function getIsValidValueNumber(value: unknown, min: number, max: number): value is number {
  return getIsValidNumber(value) && value <= max && value >= min;
}

function getDefaultValueText(value: number, min: number, max: number): string {
  const percentage = max === min ? 100 : ((value - min) / (max - min)) * 100;
  return `${Math.round(percentage)}%`;
}

interface CircularProgressContextValue {
  value: number | null;
  valueText: string | undefined;
  max: number;
  min: number;
  state: ProgressState;
  radius: number;
  thickness: number;
  size: number;
  center: number;
  circumference: number;
  percentage: number | null;
  valueTextId?: string;
}

const CircularProgressContext = createContext<CircularProgressContextValue | null>(null);

function useCircularProgressContext(consumerName: string) {
  const context = use(CircularProgressContext);
  if (!context) {
    throw new Error(`\`${consumerName}\` must be used within \`${CIRCULAR_PROGRESS_NAME}\``);
  }
  return context;
}

interface CircularProgressProps
  extends React.ComponentProps<"div">, useRender.ComponentProps<"div"> {
  value?: number | null | undefined;
  getValueText?(value: number, min: number, max: number): string;
  min?: number;
  max?: number;
  size?: number;
  thickness?: number;
  label?: string;
}

function CircularProgressRoot(props: CircularProgressProps) {
  const {
    value: valueProp = null,
    // oxlint-disable-next-line typescript/unbound-method
    getValueText = getDefaultValueText,
    min: minProp = 0,
    max: maxProp,
    size = 48,
    thickness = 4,
    label,
    render,
    className,
    children,
    ...rootProps
  } = props;

  const rawMax = getIsValidMaxNumber(maxProp) ? maxProp : DEFAULT_MAX;
  const min = getIsValidNumber(minProp) ? minProp : 0;
  const max = rawMax <= min ? min + 1 : rawMax;

  const value = getIsValidValueNumber(valueProp, min, max)
    ? valueProp
    : getIsValidNumber(valueProp) && valueProp > max
      ? max
      : getIsValidNumber(valueProp) && valueProp < min
        ? min
        : null;

  const valueText = getIsValidNumber(value) ? getValueText(value, min, max) : undefined;
  const state = getProgressState(value, max);
  const radius = Math.max(0, (size - thickness) / 2);
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  const percentage = getIsValidNumber(value)
    ? max === min
      ? 1
      : (value - min) / (max - min)
    : null;

  const labelId = useId();
  const valueTextId = useId();

  const contextValue = useMemo<CircularProgressContextValue>(
    () => ({
      value,
      valueText,
      max,
      min,
      state,
      radius,
      thickness,
      size,
      center,
      circumference,
      percentage,
      valueTextId,
    }),
    [
      value,
      valueText,
      max,
      min,
      state,
      radius,
      thickness,
      size,
      center,
      circumference,
      percentage,
      valueTextId,
    ],
  );

  return (
    <CircularProgressContext value={contextValue}>
      {useRender({
        defaultTagName: "div",
        props: mergeProps<"div">(
          {
            role: "progressbar",
            "aria-describedby": valueText ? valueTextId : undefined,
            "aria-labelledby": label ? labelId : undefined,
            "aria-valuemax": max,
            "aria-valuemin": min,
            "aria-valuenow": getIsValidNumber(value) ? value : undefined,
            "aria-valuetext": valueText,
            className: cn("relative inline-flex w-fit items-center justify-center", className),
            children: (
              <>
                {children}
                {label && <div id={labelId}>{label}</div>}
              </>
            ),
          },
          rootProps,
        ),
        render,
        state: {
          slot: "circular-progress",
          state,
          value: value ?? undefined,
          max,
          min,
          percentage,
        },
      })}
    </CircularProgressContext>
  );
}

function CircularProgressIndicator(props: React.ComponentProps<"svg">) {
  const { className, ...indicatorProps } = props;

  const context = useCircularProgressContext(INDICATOR_NAME);

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${context.size} ${context.size}`}
      data-state={context.state}
      data-value={context.value ?? undefined}
      data-max={context.max}
      data-min={context.min}
      data-percentage={context.percentage}
      width={context.size}
      height={context.size}
      {...indicatorProps}
      className={cn("-rotate-90 transform", className)}
    />
  );
}

CircularProgressIndicator.displayName = INDICATOR_NAME;

function CircularProgressTrack(props: React.ComponentProps<"circle">) {
  const { className, ...trackProps } = props;

  const context = useCircularProgressContext(TRACK_NAME);

  return (
    <circle
      data-state={context.state}
      cx={context.center}
      cy={context.center}
      r={context.radius}
      fill="none"
      stroke="currentColor"
      strokeWidth={context.thickness}
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
      {...trackProps}
      className={cn("text-muted-foreground/20", className)}
    />
  );
}

function CircularProgressRange(props: React.ComponentProps<"circle">) {
  const { className, ...rangeProps } = props;

  const context = useCircularProgressContext(RANGE_NAME);

  const strokeDasharray = context.circumference;
  const strokeDashoffset =
    context.state === "indeterminate"
      ? context.circumference * 0.75
      : context.percentage !== null
        ? context.circumference - context.percentage * context.circumference
        : context.circumference;

  return (
    <circle
      data-state={context.state}
      data-value={context.value ?? undefined}
      data-max={context.max}
      data-min={context.min}
      cx={context.center}
      cy={context.center}
      r={context.radius}
      fill="none"
      stroke="currentColor"
      strokeWidth={context.thickness}
      strokeLinecap="round"
      strokeDasharray={strokeDasharray}
      strokeDashoffset={strokeDashoffset}
      vectorEffect="non-scaling-stroke"
      {...rangeProps}
      className={cn(
        "origin-center text-primary transition-all duration-300 ease-in-out",
        context.state === "indeterminate" &&
          "motion-reduce:animate-none motion-safe:animate-spin-around",
        className,
      )}
    />
  );
}

interface CircularProgressValueTextProps
  extends React.ComponentProps<"span">, useRender.ComponentProps<"span"> {}

function CircularProgressValueText(props: CircularProgressValueTextProps) {
  const { render, className, children, ...valueTextProps } = props;

  const context = useCircularProgressContext(VALUE_TEXT_NAME);

  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        id: context.valueTextId,
        className: cn(
          "absolute inset-0 flex items-center justify-center font-medium text-sm",
          className,
        ),
        children: children ?? context.valueText,
      },
      valueTextProps,
    ),
    render,
    state: {
      slot: "circular-progress-value-text",
      state: context.state,
    },
  });
}

function CircularProgress({ children, ...props }: CircularProgressProps) {
  return (
    <CircularProgressRoot {...props}>
      <CircularProgressIndicator>
        <CircularProgressTrack />
        <CircularProgressRange />
      </CircularProgressIndicator>
      {children}
    </CircularProgressRoot>
  );
}

export {
  CircularProgressRoot,
  CircularProgress,
  CircularProgressIndicator,
  type CircularProgressProps,
  CircularProgressRange,
  CircularProgressTrack,
  CircularProgressValueText,
};
