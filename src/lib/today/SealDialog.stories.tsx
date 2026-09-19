import { expect, fn, screen, userEvent } from "storybook/test";

import preview from "#storybook/preview";

import type { ReceiptView } from "./experience";

import { rowStatus, type DayView, type RosterEntry, type SealModel } from "./console";
import { SealDialog } from "./SealDialog";

const DATE = "2026-09-11";
const NAMES = ["Read 20 min", "Walk 3 km", "Meds", "Journal", "Stretch", "No phone after 22:00"];

function entry(name: string, index: number, outcome: "done" | "missed" | "open"): RosterEntry {
  return {
    instanceId: `instance-${index}` as RosterEntry["instanceId"],
    routineId: `routine-${index}` as RosterEntry["routineId"],
    name,
    outcome: outcome === "open" ? "missed" : outcome,
    marked: outcome !== "open",
    settled: false,
    scheduleVersionId: `schedule-${index}` as RosterEntry["scheduleVersionId"],
  };
}

function day(open: number): DayView {
  return {
    date: DATE,
    state: "open",
    rev: 4,
    closedAt: null,
    sealed: false,
    closingNote: "",
    roster: NAMES.map((name, index) =>
      entry(name, index, index >= NAMES.length - open ? "open" : "done"),
    ),
    stats: null,
    award: null,
  };
}

/** A clean sixth day: six done marks, and the closing reward at ×1.70. */
const receipt: ReceiptView = {
  date: DATE,
  eligible: true,
  doneExperience: 6,
  baseExperience: 10,
  streakExperience: 7,
  held: false,
  streak: 6,
  multiplier: 1.7,
  reset: false,
  released: 0,
  total: 23,
  experienceBefore: 103,
  experienceAfter: 126,
  levelBefore: 4,
  levelAfter: 4,
};

interface CeremonyOptions {
  stage?: "resolve" | "lock" | "receipt";
  day?: DayView;
  receipt?: ReceiptView;
  refusal?: { phase: "resolve" | "lock"; reason: string };
}

/** A scripted Close adapter for the focused dialog stories. */
function ceremony(options: CeremonyOptions = {}): SealModel {
  const under = options.day ?? day(0);
  const stage = options.stage ?? "lock";
  const pending = under.roster.filter((line) => rowStatus(line) === "open");
  const workflow: SealModel["workflow"] = options.refusal
    ? {
        state: "refused",
        date: DATE,
        day: under,
        pending,
        ...options.refusal,
      }
    : stage === "receipt" && options.receipt
      ? { state: "receipt", date: DATE, day: under, receipt: options.receipt }
      : stage === "resolve"
        ? { state: "resolving", date: DATE, day: under, pending }
        : { state: "ready", date: DATE, day: under };
  return {
    workflow,
    begin: fn(),
    resolve: fn(),
    lock: fn(),
    cancel: fn(),
  };
}

const meta = preview.meta({
  component: SealDialog,
  parameters: { layout: "fullscreen" },
  args: {
    seal: ceremony(),
    balance: { available: 1, minted: 2 },
  },
});

/** Act one: every open line owes a verdict before anything can be locked. */
export const Resolve = meta.story({
  args: { seal: ceremony({ day: day(2), stage: "resolve" }) },
  play: async ({ args }) => {
    await expect(screen.getByText("RESOLVE · 2 LEFT")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /done/u }));
    await expect(args.seal.resolve).toHaveBeenCalledWith("done");
  },
});

/** Act two: the record as it will stand, and the word that makes it final. */
export const Lock = meta.story({
  play: async ({ args }) => {
    await expect(screen.getByText("LOCK · FINAL")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /LOCK/u }));
    await expect(args.seal.lock).toHaveBeenCalled();
  },
});

export const RejectedLockWithOpenRows = meta.story({
  args: {
    seal: ceremony({
      day: day(1),
      refusal: { phase: "lock", reason: "The Day changed before it could Close." },
    }),
  },
  play: async () => {
    await expect(screen.getByText("RESOLVE · 1 LEFT")).toBeInTheDocument();
    await expect(screen.getByRole("alert")).toHaveTextContent(
      "The Day changed before it could Close.",
    );
  },
});

/**
 * Act three: what the lock banked, itemised. The done marks, the reward for
 * closing at all, and what the run multiplied that reward by.
 */
export const Receipt = meta.story({
  args: { seal: ceremony({ stage: "receipt", receipt }) },
  play: async ({ args }) => {
    await expect(screen.getByText(`SEALED ${DATE}`)).toBeInTheDocument();
    await expect(screen.getByText("BANKED")).toBeInTheDocument();
    await expect(screen.getByText("done marks × 6")).toBeInTheDocument();
    await expect(screen.getByText("closing the day")).toBeInTheDocument();
    await expect(screen.getByText("no-miss streak 6d ×1.70")).toBeInTheDocument();
    await expect(screen.getByText("+23 XP")).toBeInTheDocument();
    // The lifetime total has moved by exactly what the receipt says.
    await expect(screen.getByText("126 XP")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /CLOSE/u }));
    await expect(args.seal.cancel).toHaveBeenCalled();
  },
});

/**
 * A level-up expands the same receipt rather than opening a second dialog: the
 * milestone is the same event as the close, told louder.
 */
export const LevelUp = meta.story({
  args: {
    seal: ceremony({
      stage: "receipt",
      receipt: { ...receipt, experienceAfter: 121, levelBefore: 3, levelAfter: 4 },
    }),
  },
  play: async () => {
    await expect(screen.getByText("level up · 3 → 4")).toBeInTheDocument();
    await expect(screen.getByText("LV 04 · WATCHKEEPER")).toBeInTheDocument();
    await expect(screen.getByText("title band holds through lv 5")).toBeInTheDocument();
  },
});

/**
 * A broken run is reported, not punished: the ten points for closing are still
 * banked, which is the whole reason a bad day was worth facing.
 */
export const StreakReset = meta.story({
  args: {
    seal: ceremony({
      stage: "receipt",
      receipt: {
        ...receipt,
        doneExperience: 4,
        streakExperience: 0,
        streak: 0,
        multiplier: 1,
        reset: true,
        total: 14,
        experienceAfter: 117,
      },
    }),
  },
  play: async () => {
    await expect(screen.getByText("no-miss streak 0d ×1.00")).toBeInTheDocument();
    await expect(screen.getByText(/the 10 xp for closing is still yours/u)).toBeInTheDocument();
    await expect(screen.getByText("+14 XP")).toBeInTheDocument();
  },
});

/**
 * Closed over an older day nobody has reviewed: the base banks now and the
 * streak part waits, because the run's position past that day is not knowable.
 */
export const BonusHeld = meta.story({
  args: {
    seal: ceremony({
      stage: "receipt",
      receipt: {
        ...receipt,
        held: true,
        streak: null,
        multiplier: null,
        streakExperience: 0,
        total: 16,
        experienceAfter: 119,
      },
    }),
  },
  play: async () => {
    await expect(screen.getByText("no-miss streak bonus")).toBeInTheDocument();
    await expect(screen.getByText("held")).toBeInTheDocument();
    await expect(
      screen.getByText(/the streak bonus follows once that day is settled/u),
    ).toBeInTheDocument();
  },
});

/**
 * Settling the older day releases what every day after it was holding, on the
 * receipt of the day that settled it.
 */
export const ReleasedBacklog = meta.story({
  args: {
    seal: ceremony({
      stage: "receipt",
      receipt: { ...receipt, released: 18, total: 41, experienceAfter: 144 },
    }),
  },
  play: async () => {
    await expect(screen.getByText("released from settled backlog")).toBeInTheDocument();
    await expect(screen.getByText("+18 xp")).toBeInTheDocument();
    await expect(screen.getByText("+41 XP")).toBeInTheDocument();
  },
});
