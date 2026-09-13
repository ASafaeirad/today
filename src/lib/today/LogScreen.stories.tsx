import { expect, fn, userEvent } from "storybook/test";

import preview from "#storybook/preview";

import { LOG_DAYS, lookbackDates, type DaySummary } from "./console";
import { LogScreen } from "./LogScreen";

const TODAY = "2026-09-11";

/**
 * A window that is mostly sealed, with one past day left open, one lapse the
 * schedule put nothing on, and today still being worked.
 */
function window(): DaySummary[] {
  return lookbackDates(TODAY, LOG_DAYS).map((date, index) => {
    if (date === "2026-09-06") {
      return blank({ date, state: "awaitingReview" });
    }
    if (date === "2026-09-09") {
      return blank({ date, scheduled: 6, done: 3, open: 3, state: "awaitingReview" });
    }
    if (date === TODAY) {
      return blank({ date, scheduled: 6, done: 2, skipped: 1, open: 3, state: "open" });
    }
    const done = index % 3 === 0 ? 6 : 4;
    return blank({
      date,
      scheduled: 6,
      done,
      missed: 6 - done,
      state: "closed",
      sealed: true,
    });
  });
}

function blank(over: Partial<DaySummary> & { date: string }): DaySummary {
  return {
    scheduled: 0,
    open: 0,
    done: 0,
    skipped: 0,
    missed: 0,
    state: "awaitingReview",
    sealed: false,
    ...over,
  };
}

const meta = preview.meta({
  component: LogScreen,
  parameters: { layout: "fullscreen" },
  /* The panel fills the console's middle row, so the story has to give it one. */
  decorators: [
    (Story) => (
      <div className="flex h-150 flex-col bg-background p-2.5">
        <Story />
      </div>
    ),
  ],
  args: {
    days: window(),
    today: TODAY,
    date: TODAY,
    onOpen: fn(),
  },
});

export const Default = meta.story({
  play: async ({ args, canvas }) => {
    // Newest first: the log is read from where the owner is standing.
    const rows = canvas.getAllByRole("button");
    await expect(rows[0]).toHaveAccessibleName("2026-09-11 · fri · open");
    await expect(rows).toHaveLength(LOG_DAYS);

    // A past day nobody closed says so, and a lapse claims nothing at all.
    // Presence rather than visibility: every row cuts in, and an assertion
    // landing mid-animation would read the opacity it starts at.
    await expect(
      canvas.getByRole("button", { name: "2026-09-09 · wed · unsealed" }),
    ).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "2026-09-06 · sun · —" })).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "2026-09-08 · tue · sealed" }));
    await expect(args.onOpen).toHaveBeenCalledWith("2026-09-08");
  },
});

/** The day the console is parked on is marked, so returning has a target. */
export const Current = meta.story({
  args: { date: "2026-09-09" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /2026-09-09/u })).toHaveAttribute(
      "aria-current",
      "true",
    );
  },
});

/** Before the overview lands the log has nothing to print but its prompt. */
export const Loading = meta.story({
  args: { days: undefined },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("reading the record ...")).toBeInTheDocument();
  },
});
