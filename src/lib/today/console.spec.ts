import { expect, test } from "vite-plus/test";

import { MAX_EAGER_DAYS } from "#domain/constants";

import {
  backlogLine,
  balanceLine,
  dayLabel,
  errorText,
  nudgeDates,
  rowStatus,
  sealStamp,
  shortDayLabel,
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

test("labels print the weekday the bar carries, long and short", () => {
  expect(dayLabel("2026-08-28")).toBe("2026-08-28 · fri");
  expect(shortDayLabel("2026-08-28")).toBe("08-28 fri");
});

test("the nudge asks about the oldest open days first, and is bounded", () => {
  expect(nudgeDates(["2026-08-27", "2026-07-01", "2026-08-02"])).toEqual([
    "2026-07-01",
    "2026-08-02",
    "2026-08-27",
  ]);

  const flood = Array.from({ length: 60 }, (_, i) => `2026-06-${String(i + 1).padStart(2, "0")}`);
  const asked = nudgeDates(flood);
  expect(asked).toHaveLength(MAX_EAGER_DAYS);
  expect(asked[0]).toBe("2026-06-01");
});

test("the nudge says what the day never did and what it still owes", () => {
  expect(backlogLine(summary({ date: "2026-09-10", scheduled: 6, open: 3 }))).toBe(
    "2026-09-10 never sealed · 3 of 6 unresolved",
  );
});

test("the skip bank prints what is spendable out of what was minted", () => {
  expect(balanceLine({ available: 1, minted: 2 })).toBe("skip bank 1/2");
  // A held skip is unavailable without being spent: the bank reads down, the
  // mint does not.
  expect(balanceLine({ available: 0, minted: 2 })).toBe("skip bank 0/2");
  expect(balanceLine({ available: 0, minted: 0 })).toBe("skip bank 0/0");
});

test("a sealed day wears its tally", () => {
  expect(sealStamp("2026-09-11", 4, 6)).toBe("sealed 2026-09-11 · 4/6 done");
});

test("a row is open until marked, unless its day has settled it", () => {
  expect(rowStatus({ outcome: "missed", marked: false, settled: false })).toBe("open");
  expect(rowStatus({ outcome: "done", marked: true, settled: false })).toBe("done");
  expect(rowStatus({ outcome: "missed", marked: false, settled: true })).toBe("missed");
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
