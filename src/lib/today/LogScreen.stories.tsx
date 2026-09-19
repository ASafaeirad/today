import { expect, fn, userEvent } from "storybook/test";

import preview from "#storybook/preview";

import { LOG_DAYS, lookbackDates, type DaySummary } from "./console";
import { LogScreen } from "./LogScreen";

/** What a clean sealed day banked, at the streak the window ran up to. */
function award(total: number, held = false): DaySummary["award"] {
  return {
    total,
    doneExperience: total - 13,
    baseExperience: 10,
    streakExperience: held ? 0 : 3,
    held,
    streak: held ? null : 4,
    multiplier: held ? null : 1.25,
  };
}

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
      // Everything after the day nobody closed banked its base and is waiting
      // on that day for the rest.
      award: award(done + 13, date > "2026-09-09"),
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
    award: null,
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
    selectedDate: TODAY,
    onCursor: fn(),
    onOpen: fn(),
  },
});

export const Default = meta.story({
  play: async ({ args, canvas }) => {
    // Newest first: the log is read from where the owner is standing.
    const rows = canvas.getAllByRole("button");
    // The bar is the line and the bar has no words, so the counts it draws are
    // in the name a screen reader hears.
    await expect(rows[0]).toHaveAccessibleName(
      "2026-09-11 · fri · open · 2 done, 1 skipped, 3 open",
    );
    await expect(rows).toHaveLength(LOG_DAYS);

    // A past day nobody closed is awaiting review, the name the ledger fixes,
    // and a lapse claims no state at all. Presence rather than visibility:
    // every row cuts in, and an assertion landing mid-animation would read the
    // opacity it starts at.
    await expect(
      canvas.getByRole("button", { name: "2026-09-09 · wed · awaiting review · 3 done, 3 open" }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "2026-09-06 · sun · nothing scheduled" }),
    ).toBeInTheDocument();

    await userEvent.click(
      canvas.getByRole("button", {
        name: "2026-09-08 · tue · sealed · 4 done, 2 missed · 17 experience",
      }),
    );
    await expect(args.onOpen).toHaveBeenCalledWith("2026-09-08");
  },
});

/**
 * The XP column. A day that banked says what it banked; a day still held by an
 * older one is marked; a lapse and an open day are different kinds of nothing.
 */
export const Experience = meta.story({
  play: async ({ canvas }) => {
    const sealedRow = canvas.getByRole("button", { name: /2026-09-08/u });
    await expect(sealedRow).toHaveTextContent("+17");

    // Banked, but not the last word: 09-09 was never closed, so everything
    // after it is still waiting on it.
    const heldRow = canvas.getByRole("button", { name: /2026-09-10/u });
    await expect(heldRow).toHaveAccessibleName(/streak bonus held/u);
    await expect(heldRow).toHaveTextContent("+17 •");

    // A lapse had nothing to bank; today has not banked yet.
    await expect(canvas.getByRole("button", { name: /2026-09-06/u })).toHaveTextContent("—");
    await expect(canvas.getByRole("button", { name: /2026-09-11/u })).toHaveTextContent("·");
  },
});

/** The day the console is parked on is marked, so returning has a target. */
export const Current = meta.story({
  args: { selectedDate: "2026-09-09" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /2026-09-09/u })).toHaveAttribute(
      "aria-current",
      "true",
    );
  },
});

/** Selection is controlled by the console model; focus reports its candidate. */
export const ControlledSelection = meta.story({
  args: { selectedDate: "2026-09-10" },
  play: async ({ args, canvas }) => {
    const september9 = canvas.getByRole("button", { name: /2026-09-09/u });
    const september10 = canvas.getByRole("button", { name: /2026-09-10/u });

    await expect(september10).toHaveAttribute("aria-current", "true");
    await userEvent.click(september9);

    await expect(args.onCursor).toHaveBeenCalledWith("2026-09-09");
    await expect(args.onOpen).toHaveBeenCalledWith("2026-09-09");
  },
});

/** Before the overview lands the log has nothing to print but its prompt. */
export const Loading = meta.story({
  args: { days: undefined },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("reading the record ...")).toBeInTheDocument();
  },
});
