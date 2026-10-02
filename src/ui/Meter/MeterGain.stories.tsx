import { useState } from "react";
import { expect, waitFor } from "storybook/test";

import preview from "#storybook/preview";

import { Button } from "../Button/Button";
import { MeterGain, type MeterGainStage } from "./MeterGain";

function stage(from: number, to: number, max: number): MeterGainStage {
  return { from, to, max, suffix: `/${max}`, valueLabel: (value) => `Progress ${value} of ${max}` };
}

function addition(meter: HTMLElement): HTMLElement {
  return meter.querySelector<HTMLElement>('[data-slot="meter-addition"]')!;
}

const meta = preview.meta({
  component: MeterGain,
  args: { stages: [stage(6, 29, 80)], className: "w-80" },
});

export const Gain = meta.story({
  play: async ({ canvas }) => {
    const meter = canvas.getByRole("meter");
    const existing = meter.querySelector<HTMLElement>('[data-slot="meter-existing"]')!;
    const gained = addition(meter);
    const animation = gained.getAnimations()[0]!;
    animation.pause();
    animation.currentTime = 0;
    await expect(canvas.getByLabelText("6/80")).toBeInTheDocument();
    await expect(existing.style.width).toBe("7.5%");
    await expect(gained.style.left).toBe("7.5%");
    await expect(gained.style.width).toBe("28.75%");
    await expect(getComputedStyle(gained).transform).toBe("matrix(0, 0, 0, 1, 0, 0)");
    animation.currentTime = Number(animation.effect!.getTiming().delay) + 310;
    await expect(getComputedStyle(gained).transform).toBe("matrix(0.5, 0, 0, 1, 0, 0)");
    await waitFor(() => expect(canvas.getByLabelText("29/80")).toBeInTheDocument());
    await expect(existing.style.width).toBe("7.5%");
    await expect(meter).toHaveAttribute("aria-valuenow", "29");
    animation.finish();
  },
});

export const Sequence = meta.story({
  args: { stages: [stage(75, 80, 80), stage(0, 20, 100)] },
  play: async ({ canvas }) => {
    const meter = canvas.getByRole("meter");
    await expect(meter).toHaveAccessibleName("Progress 75 of 80");
    addition(meter).getAnimations()[0]!.finish();
    await waitFor(() => expect(meter).toHaveAccessibleName("Progress 0 of 100"));
    await expect(addition(meter).style.left).toBe("0%");
    await expect(addition(meter).style.width).toBe("20%");
    addition(meter).getAnimations()[0]!.finish();
    await waitFor(() => expect(meter).toHaveAccessibleName("Progress 20 of 100"));
  },
});

export const NoGain = meta.story({
  args: { stages: [stage(6, 6, 80)] },
  play: async ({ canvas }) => {
    const meter = canvas.getByRole("meter");
    await expect(addition(meter).style.width).toBe("0%");
    addition(meter).getAnimations()[0]!.finish();
    await waitFor(() => expect(canvas.getByLabelText("6/80")).toBeInTheDocument());
    await expect(meter).toHaveAccessibleName("Progress 6 of 80");
  },
});

function RepeatedGain() {
  const [from, setFrom] = useState(6);
  return (
    <div className="flex flex-col gap-3">
      <MeterGain stages={[stage(from, from + 23, 80)]} className="w-80" />
      <Button onClick={() => setFrom(from + 23)}>Add another 23</Button>
    </div>
  );
}

export const UpdatedRange = meta.story({
  render: () => <RepeatedGain />,
  play: async ({ canvas, userEvent }) => {
    const meter = canvas.getByRole("meter");
    addition(meter).getAnimations()[0]!.finish();
    await waitFor(() => expect(meter).toHaveAccessibleName("Progress 29 of 80"));
    await userEvent.click(canvas.getByRole("button", { name: "Add another 23" }));
    const updated = canvas.getByRole("meter");
    await expect(updated).toHaveAccessibleName("Progress 29 of 80");
    await expect(addition(updated).style.left).toBe("36.25%");
    addition(updated).getAnimations()[0]!.finish();
    await waitFor(() => expect(updated).toHaveAccessibleName("Progress 52 of 80"));
  },
});
