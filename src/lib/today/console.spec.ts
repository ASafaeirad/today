import { MAX_EAGER_DAYS } from "#domain/constants";

import {
  backlogLine,
  balanceLine,
  dayLabel,
  dayTally,
  dayTitle,
  dayTone,
  errorText,
  logState,
  logSummary,
  lookbackDates,
  lookbackNote,
  recordSegments,
  nudgeDates,
  rowStatus,
  sealCta,
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

it("labels print the weekday the bar carries, long and short", () => {
  expect(dayLabel("2026-08-28")).toBe("2026-08-28 · fri");
  expect(shortDayLabel("2026-08-28")).toBe("08-28 fri");
});

it("the nudge asks about the oldest open days first, and is bounded", () => {
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

it("the nudge says what the day never did and what it still owes", () => {
  expect(backlogLine(summary({ date: "2026-09-10", scheduled: 6, open: 3 }))).toBe(
    "2026-09-10 never sealed · 3 of 6 unresolved",
  );
});

it("the skip bank prints what is spendable out of what was minted", () => {
  expect(balanceLine({ available: 1, minted: 2 })).toBe("skip bank 1/2");
  // A held skip is unavailable without being spent: the bank reads down, the
  // mint does not.
  expect(balanceLine({ available: 0, minted: 2 })).toBe("skip bank 0/2");
  expect(balanceLine({ available: 0, minted: 0 })).toBe("skip bank 0/0");
});

it("a sealed day wears its tally", () => {
  expect(sealStamp("2026-09-11", 4, 6)).toBe("sealed 2026-09-11 · 4/6 done");
});

it("a row is open until marked, unless its day has settled it", () => {
  expect(rowStatus({ outcome: "missed", marked: false, settled: false })).toBe("open");
  expect(rowStatus({ outcome: "done", marked: true, settled: false })).toBe("done");
  expect(rowStatus({ outcome: "missed", marked: false, settled: true })).toBe("missed");
});

it("a refusal is reduced to the sentence the mutation gave", () => {
  const error = new Error(
    "[CONVEX M(marks:append)] [Request ID: abc] Server Error\nUncaught Error: Cannot mark skipped: 1 skip needed, 0 available\n    at handler",
  );
  expect(errorText(error)).toBe("Cannot mark skipped: 1 skip needed, 0 available");
  expect(errorText(new Error("Uncaught Error: A sealed day is permanent."))).toBe(
    "A sealed day is permanent.",
  );
  expect(errorText("plain")).toBe("plain");
});

it("the lookback window ends at today and reaches back over the span", () => {
  expect(lookbackDates("2026-09-11", 3)).toEqual(["2026-09-09", "2026-09-10", "2026-09-11"]);
  expect(lookbackDates("2026-03-01", 2)).toEqual(["2026-02-28", "2026-03-01"]);
  expect(lookbackDates("2026-09-11", 14)).toHaveLength(14);
});

it("a strip cell prints its record, and an em dash where there was none", () => {
  expect(dayTally(summary({ date: "2026-09-10", scheduled: 6, done: 4, missed: 2 }))).toBe("4/6");
  // A lapse is not a run of zeroes: there was nothing to do, not nothing done.
  expect(dayTally(summary({ date: "2026-09-10" }))).toBe("—");
});

it("a cell's ink is the verdict the day arrived at, if it arrived at one", () => {
  expect(dayTone(summary({ date: "2026-09-10", scheduled: 6, done: 6 }))).toBe("done");
  expect(dayTone(summary({ date: "2026-09-10", scheduled: 6, done: 4, missed: 2 }))).toBe(
    "neutral",
  );
  // Anything still owed outranks the rest of the tally: the day is not finished.
  expect(dayTone(summary({ date: "2026-09-10", scheduled: 6, done: 5, open: 1 }))).toBe("missed");
  expect(dayTone(summary({ date: "2026-09-10" }))).toBe("empty");
});

it("a cell says what it is when pointed at, sealed or not", () => {
  expect(
    dayTitle(summary({ date: "2026-09-10", scheduled: 6, done: 4, missed: 2, sealed: true })),
  ).toBe("2026-09-10 · thu · sealed 4/6 done");
  expect(dayTitle(summary({ date: "2026-09-10", scheduled: 6, done: 3, open: 3 }))).toBe(
    "2026-09-10 · thu · never sealed · 3 open",
  );
  expect(dayTitle(summary({ date: "2026-09-10" }))).toBe("2026-09-10 · thu · nothing scheduled");
});

it("an unsealed past day is still live, and a sealed one is behind glass", () => {
  expect(lookbackNote(false, 3)).toBe("never sealed · 3 open — still editable");
  expect(lookbackNote(true, 0)).toBe("sealed record · read only");
});

it("the seal names the day it would close, once that is not today", () => {
  expect(sealCta("2026-09-11", "2026-09-11")).toBe("SEAL THE DAY");
  expect(sealCta("2026-09-08", "2026-09-11")).toBe("SEAL 2026-09-08");
});

it("the log says where a day stands, and sealed is the only final answer", () => {
  const today = "2026-09-11";
  expect(logState(summary({ date: today, scheduled: 6, open: 6 }), today)).toBe("open");
  // Today is not late until it is over; a past day that was never closed is.
  expect(logState(summary({ date: "2026-09-10", scheduled: 6, open: 6 }), today)).toBe("unsealed");
  expect(logState(summary({ date: today, scheduled: 6, done: 6, sealed: true }), today)).toBe(
    "sealed",
  );
  expect(logState(summary({ date: "2026-09-10" }), today)).toBe("—");
});

it("the record bar carries only the outcomes the day actually landed on", () => {
  expect(
    recordSegments(summary({ date: "2026-09-10", scheduled: 6, done: 4, skipped: 1, open: 1 })),
  ).toEqual([
    { outcome: "done", count: 4 },
    { outcome: "skipped", count: 1 },
    { outcome: "open", count: 1 },
  ]);
  expect(recordSegments(summary({ date: "2026-09-10" }))).toEqual([]);
});

it("the log counts what the window came to, and how much of it was closed", () => {
  const today = "2026-09-11";
  const counted = logSummary(
    [
      summary({ date: "2026-09-08", scheduled: 6, done: 6, sealed: true }),
      summary({ date: "2026-09-09", scheduled: 6, open: 6 }),
      summary({ date: "2026-09-10", scheduled: 6, done: 6, sealed: true }),
      summary({ date: today, scheduled: 6, open: 6 }),
    ],
    today,
  );
  expect(counted).toEqual({ sealed: 2, scheduled: 4, awaiting: 1, streak: 1 });
});

it("the streak ends at the first day that was owed a seal and never got one", () => {
  const today = "2026-09-11";
  const days = [
    summary({ date: "2026-09-07", scheduled: 6, done: 6, sealed: true }),
    summary({ date: "2026-09-08", scheduled: 6, open: 6 }),
    summary({ date: "2026-09-09", scheduled: 6, done: 6, sealed: true }),
    // A day the schedule put nothing on had nothing to seal, so it neither
    // counts toward the streak nor breaks it.
    summary({ date: "2026-09-10" }),
    summary({ date: today, scheduled: 6, open: 6 }),
  ];
  expect(logSummary(days, today).streak).toBe(1);

  // Today still being open is not a break: it is not late yet.
  const unbroken = [
    summary({ date: "2026-09-09", scheduled: 6, done: 6, sealed: true }),
    summary({ date: "2026-09-10", scheduled: 6, done: 6, sealed: true }),
    summary({ date: today, scheduled: 6, open: 6 }),
  ];
  expect(logSummary(unbroken, today).streak).toBe(2);
});
