import { expect } from "storybook/test";

import preview from "#storybook/preview";

import type { ProgressionView } from "./experience";

import { ProgressionBar } from "./ProgressionBar";

/** Lifetime 126 puts the owner six into level 4, which runs 120 to 200. */
const progression: ProgressionView = {
  experience: 126,
  streak: 3,
  multiplier: 1.5,
  heldDays: 0,
  caughtUp: true,
  backfill: null,
};

const meta = preview.meta({
  component: ProgressionBar,
  parameters: { layout: "fullscreen" },
  args: { progression, pending: 0 },
});

export const Default = meta.story({
  play: async ({ canvas }) => {
    await expect(canvas.getByText("lv 04")).toBeInTheDocument();
    await expect(canvas.getByText("WATCHKEEPER")).toBeInTheDocument();
    await expect(canvas.getByText("6/80 to lv 5")).toBeInTheDocument();
    await expect(canvas.getByText("126 XP")).toBeInTheDocument();

    // One streak, and it is the no-miss seal streak with the factor it is
    // worth — the number and its consequence are read together.
    await expect(canvas.getByText("NO-MISS 3D ×1.50")).toBeInTheDocument();

    // Nothing pending on a day with no done marks.
    await expect(canvas.queryByText(/PENDING/u)).not.toBeInTheDocument();
  },
});

/** Done marks preview a point each, and the bar says it is not banked yet. */
export const Pending = meta.story({
  args: { pending: 4 },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("+4 XP PENDING")).toBeInTheDocument();
    // The lifetime total has not moved: nothing banks until the day closes.
    await expect(canvas.getByText("126 XP")).toBeInTheDocument();
  },
});

/** An older awaiting-review day is standing between the run and its factor. */
export const BonusHeld = meta.story({
  args: { progression: { ...progression, heldDays: 2 } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("BONUS HELD · 2D")).toBeInTheDocument();
  },
});

/** Before the progression query lands there is no reading to print. */
export const Loading = meta.story({
  args: { progression: undefined },
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toBeEmptyDOMElement();
  },
});
