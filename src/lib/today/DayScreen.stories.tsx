import { expect, fn, waitFor } from "storybook/test";

import preview from "#storybook/preview";

import type { DayView, RosterEntry } from "./ledger";

import { DayScreen } from "./DayScreen";

const TODAY = "2026-09-11";

const NAMES = ["Read 20 min", "Walk 3 km", "Meds"];

/** The screen a thumb reads, as against the 1200px one every story defaults to. */
const PHONE = { viewport: { value: "mobile2" } };

function entry(name: string, index: number): RosterEntry {
  return {
    instanceId: `instance-${index}` as RosterEntry["instanceId"],
    routineId: `routine-${index}` as RosterEntry["routineId"],
    name,
    outcome: "missed",
    marked: false,
    settled: false,
    scheduleVersionId: `schedule-${index}` as RosterEntry["scheduleVersionId"],
  };
}

const roster = NAMES.map(entry);

function day(overrides: Partial<DayView> = {}): DayView {
  return {
    date: TODAY,
    state: "open",
    rev: 0,
    closedAt: null,
    sealed: false,
    closingNote: "",
    roster,
    stats: null,
    ...overrides,
  };
}

const sealed = day({
  sealed: true,
  state: "closed",
  closedAt: 1_757_500_000_000,
  roster: roster.map((line) => ({ ...line, settled: true })),
});

const meta = preview.meta({
  component: DayScreen,
  parameters: { layout: "fullscreen" },
  args: {
    day: day(),
    date: TODAY,
    isToday: true,
    cursor: 0,
    rowRefs: { current: [] },
    onCursor: fn(),
    onMark: fn(),
  },
});

/** A pointer has room for the three keys on every line at once. */
export const Default = meta.story({
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.getAllByRole("button", { name: "done" })).toHaveLength(NAMES.length);
    // Nothing to open: the keys are already out.
    await expect(canvas.queryByRole("button", { name: /^mark /u })).toBeNull();

    await userEvent.click(canvas.getAllByRole("button", { name: "done" })[1]!);

    await expect(args.onMark).toHaveBeenCalledWith(roster[1], "done");
  },
});

/**
 * A phone carries the keys one line at a time: the line is the tap target, and
 * what it opens is a drawer under it that closes again on a verdict.
 */
export const Phone = meta.story({
  globals: PHONE,
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.queryByRole("button", { name: "done" })).toBeNull();

    const line = canvas.getByRole("button", { name: "mark Walk 3 km" });
    await expect(line).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(line);

    await expect(line).toHaveAttribute("aria-expanded", "true");
    await expect(args.onCursor).toHaveBeenCalledWith(1);
    // One line at a time: the keys that opened belong to the line that was hit.
    await expect(canvas.getAllByRole("button", { name: "done" })).toHaveLength(1);
    // The row cuts in on mount, so the drawer is worth waiting a frame for.
    await waitFor(() =>
      expect(canvas.getByRole("group", { name: "Walk 3 km outcome" })).toBeVisible(),
    );

    await userEvent.click(canvas.getByRole("button", { name: "done" }));

    await expect(args.onMark).toHaveBeenCalledWith(roster[1], "done");
    await expect(line).toHaveAttribute("aria-expanded", "false");
    await expect(canvas.queryByRole("button", { name: "done" })).toBeNull();
  },
});

/** The line that opened the drawer closes it again, at no cost. */
export const PhoneReconsidered = meta.story({
  globals: PHONE,
  play: async ({ args, canvas, userEvent }) => {
    const line = canvas.getByRole("button", { name: "mark Meds" });

    await userEvent.click(line);
    await userEvent.click(line);

    await expect(line).toHaveAttribute("aria-expanded", "false");
    await expect(canvas.queryByRole("button", { name: "skipped" })).toBeNull();
    await expect(args.onMark).not.toHaveBeenCalled();
  },
});

/** A sealed day is read-only: the keys are gone and the line says why. */
export const Sealed = meta.story({
  args: { day: sealed },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole("button", { name: "done" })).toBeNull();
    await expect(canvas.getAllByText("locked")).toHaveLength(NAMES.length);
  },
});

/** A sealed day has no verdict left to take, so no line offers to open. */
export const PhoneSealed = meta.story({
  globals: PHONE,
  args: { day: sealed },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole("button", { name: /^mark /u })).toBeNull();
    await expect(canvas.getAllByText("missed")).toHaveLength(NAMES.length);
  },
});

/** A past day the schedule put nothing on is a lapse, not a slate to fill in. */
export const Lapsed = meta.story({
  args: { day: day({ roster: [], date: "2026-09-04" }), date: "2026-09-04", isToday: false },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/nothing was scheduled on this day/u)).toBeInTheDocument();
    await expect(canvas.queryByRole("button")).toBeNull();
  },
});
