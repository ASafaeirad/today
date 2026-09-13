import { expect, fn, userEvent } from "storybook/test";

import preview from "#storybook/preview";

import { lookbackDates, STRIP_DAYS, type DaySummary } from "./console";
import { DayStrip } from "./DayStrip";

const TODAY = "2026-09-11";

/** A window that runs sealed, then two days that were never closed. */
function window(): DaySummary[] {
  return lookbackDates(TODAY, STRIP_DAYS).map((date, index) => {
    const sealed = index < STRIP_DAYS - 2;
    const done = index % 4 === 0 ? 6 : 4;
    return {
      date,
      scheduled: 6,
      done: sealed ? done : 3,
      missed: sealed ? 6 - done : 0,
      skipped: 0,
      open: sealed ? 0 : 3,
      state: sealed ? "closed" : "awaitingReview",
      sealed,
    };
  });
}

const meta = preview.meta({
  component: DayStrip,
  parameters: { layout: "fullscreen" },
  args: {
    days: window(),
    date: TODAY,
    onPick: fn(),
    onStep: fn(),
    canStepBack: true,
    canStepForward: false,
  },
});

export const Default = meta.story({
  play: async ({ args, canvas }) => {
    const today = canvas.getByRole("button", { name: /2026-09-11/u });
    await expect(today).toHaveAttribute("aria-current", "true");

    // A day that was never sealed says so from the strip, before it is opened.
    await expect(canvas.getByRole("button", { name: /2026-09-10/u })).toHaveAccessibleName(
      "2026-09-10 · thu · never sealed · 3 open",
    );

    await userEvent.click(canvas.getByRole("button", { name: /2026-09-04/u }));
    await expect(args.onPick).toHaveBeenCalledWith("2026-09-04");
  },
});

/** Looking back: the cell the console is parked on is the one it inverts. */
export const LookingBack = meta.story({
  args: { date: "2026-09-05", canStepForward: true },
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "next day" }));
    await expect(args.onStep).toHaveBeenCalledWith(1);

    await expect(canvas.getByRole("button", { name: /2026-09-05/u })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(canvas.getByRole("button", { name: /2026-09-11/u })).not.toHaveAttribute(
      "aria-current",
    );
  },
});

/** At the near edge of the window, there is nowhere forward to go. */
export const AtTheEdge = meta.story({
  args: { canStepBack: false },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "previous day" })).toBeDisabled();
    // Today is the near edge of the window, and there is no stepping past it.
    await expect(canvas.getByRole("button", { name: "next day" })).toBeDisabled();
  },
});

/** Before the overview lands there are no cells, only the frame they sit in. */
export const Loading = meta.story({
  args: { days: undefined },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole("button", { name: /2026-09-11/u })).toBeNull();
  },
});
