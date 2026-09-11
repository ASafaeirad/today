import { expect, test } from "vite-plus/test";

import { MAX_EAGER_DAYS } from "#domain/constants";

import {
  clockIn,
  countBacklog,
  dayLabel,
  errorText,
  recentDates,
  rowStatus,
  slotLabel,
  slotStatus,
  stripDates,
  visibleDates,
  type DaySummary,
} from "./console";

const summary = (over: Partial<DaySummary> & { date: string }): DaySummary => ({
  scheduled: 0,
  open: 0,
  done: 0,
  skipped: 0,
  missed: 0,
  state: "awaitingReview",
  sealed: false,
  ...over,
});

test("labels print the weekday the way the strip does", () => {
  expect(dayLabel("2026-08-28")).toBe("2026-08-28 FRI");
  expect(slotLabel("2026-08-28", "2026-08-28")).toBe("TODAY");
  expect(slotLabel("2026-08-27", "2026-08-28")).toBe("27 THU");
});

test("the strip is the recent window plus open history, newest first and bounded", () => {
  expect(recentDates("2026-08-28", 3)).toEqual(["2026-08-28", "2026-08-27", "2026-08-26"]);

  const dates = stripDates("2026-08-28", ["2026-08-27", "2026-07-01", "2026-08-30"]);
  expect(dates[0]).toBe("2026-08-28");
  expect(dates).toContain("2026-07-01");
  expect(dates).not.toContain("2026-08-30");
  expect(dates).toEqual([...dates].sort().reverse());

  const flood = Array.from({ length: 60 }, (_, i) => `2026-06-${String(i + 1).padStart(2, "0")}`);
  expect(stripDates("2026-08-28", flood)).toHaveLength(MAX_EAGER_DAYS);
});

test("old dates keep a slot only while something on them is still owed", () => {
  const today = "2026-08-28";
  const summaries = new Map<string, DaySummary>([
    ["2026-07-01", summary({ date: "2026-07-01", scheduled: 2, open: 1 })],
    ["2026-07-02", summary({ date: "2026-07-02", scheduled: 2, open: 0, sealed: true })],
    ["2026-07-03", summary({ date: "2026-07-03", scheduled: 0 })],
  ]);
  expect(
    visibleDates(
      ["2026-08-28", "2026-08-22", "2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04"],
      summaries,
      today,
    ),
  ).toEqual(["2026-08-28", "2026-08-22", "2026-07-01"]);
});

test("slot status reads sealed, empty, open count, or ready", () => {
  expect(slotStatus(undefined)).toEqual({ text: "...", tone: "inherit" });
  expect(slotStatus(summary({ date: "d", scheduled: 3, sealed: true }))).toEqual({
    text: "SEALED",
    tone: "seal",
  });
  expect(slotStatus(summary({ date: "d" }))).toEqual({ text: "NO DATA", tone: "inherit" });
  expect(slotStatus(summary({ date: "d", scheduled: 8, open: 3 }))).toEqual({
    text: "03 OPEN",
    tone: "inherit",
  });
  expect(slotStatus(summary({ date: "d", scheduled: 8 }))).toEqual({ text: "READY", tone: "done" });
});

test("a row is open until marked, unless its day has settled it", () => {
  expect(rowStatus({ outcome: "missed", marked: false, settled: false })).toBe("open");
  expect(rowStatus({ outcome: "done", marked: true, settled: false })).toBe("done");
  expect(rowStatus({ outcome: "missed", marked: false, settled: true })).toBe("missed");
});

test("the backlog is earlier days that are neither sealed nor fully marked", () => {
  const today = "2026-08-28";
  const rows = [
    summary({ date: "2026-08-28", scheduled: 8, open: 3 }),
    summary({ date: "2026-08-27", scheduled: 8, open: 2 }),
    summary({ date: "2026-08-26", scheduled: 0 }),
    summary({ date: "2026-08-25", scheduled: 8, open: 1, sealed: true }),
    summary({ date: "2026-08-24", scheduled: 8, open: 0 }),
  ];
  expect(countBacklog(rows, today)).toBe(1);
});

test("the closing clock is read in the owner's zone", () => {
  expect(clockIn(Date.UTC(2026, 7, 28, 22, 41), "UTC")).toBe("22:41");
  expect(clockIn(Date.UTC(2026, 7, 28, 22, 41), "Asia/Tehran")).toBe("02:11");
});

test("a refusal is reduced to the sentence the mutation gave", () => {
  const error = new Error(
    "[CONVEX M(marks:append)] [Request ID: abc] Server Error\nUncaught Error: Cannot mark skipped: 1 skip needed, 0 available\n    at handler",
  );
  expect(errorText(error)).toBe("Cannot mark skipped: 1 skip needed, 0 available");
  expect(errorText(new Error("Uncaught Error: A sealed day is permanent."))).toBe(
    "A sealed day is permanent.",
  );
  expect(errorText("plain")).toBe("plain");
});
