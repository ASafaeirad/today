import { describe, expect, it } from "vite-plus/test";

import {
  checkScheduleWrite,
  daysFromMask,
  EVERY_DAY,
  isDowMask,
  maskFromDays,
  placesOn,
  rosterFor,
  type ScheduleVersionLike,
  versionCovering,
} from "./schedule";

const WEEKDAYS = maskFromDays([1, 2, 3, 4, 5]);

const version = (
  overrides: Partial<ScheduleVersionLike> & { _id: string; routineId: string },
): ScheduleVersionLike => ({
  seq: 0,
  dowMask: WEEKDAYS,
  activeFrom: "2026-01-01",
  activeUntil: null,
  ...overrides,
});

describe("the interval log", () => {
  it("round-trips a day-of-week mask", () => {
    expect(daysFromMask(maskFromDays([0, 6]))).toEqual([0, 6]);
    expect(maskFromDays([])).toBe(0);
  });

  it("admits only the seven bits as a mask", () => {
    expect(isDowMask(0)).toBe(true);
    expect(isDowMask(EVERY_DAY)).toBe(true);

    // 128 reads as active and places no day; -1 is coerced into every day; a
    // fraction is neither.
    expect(isDowMask(EVERY_DAY + 1)).toBe(false);
    expect(isDowMask(-1)).toBe(false);
    expect(isDowMask(1.5)).toBe(false);
    expect(isDowMask(Number.NaN)).toBe(false);
  });

  it("places a routine only on covered dates its mask names", () => {
    const weekdays = version({ _id: "v1", routineId: "r1" });
    expect(placesOn(weekdays, "2026-03-02")).toBe(true);
    expect(placesOn(weekdays, "2026-03-01")).toBe(false);
    expect(placesOn(weekdays, "2025-12-31")).toBe(false);
  });

  it("places nothing while paused, so a pause cannot be missed", () => {
    const paused = version({ _id: "v2", routineId: "r1", dowMask: 0 });
    expect(rosterFor("2026-03-02", [paused])).toEqual([]);
  });

  it("places nothing during a lapse, which is no rows rather than a flag", () => {
    const ran2025 = version({
      _id: "v1",
      routineId: "r1",
      activeFrom: "2025-01-01",
      activeUntil: "2025-12-31",
    });
    const returned2027 = version({
      _id: "v2",
      routineId: "r1",
      seq: 1,
      activeFrom: "2027-01-01",
    });
    const log = [ran2025, returned2027];

    expect(rosterFor("2025-06-02", log)).toHaveLength(1);
    expect(rosterFor("2026-06-02", log)).toEqual([]);
    expect(rosterFor("2027-06-02", log)).toHaveLength(1);
    expect(versionCovering("2026-06-02", log)).toBeUndefined();
  });

  it("sorts a roster by routine, so two runs produce the same one", () => {
    const roster = rosterFor("2026-03-02", [
      version({ _id: "vb", routineId: "rb" }),
      version({ _id: "va", routineId: "ra" }),
    ]);
    expect(roster.map((entry) => entry.routineId)).toEqual(["ra", "rb"]);
  });
});

describe("the three invariants of the log", () => {
  const today = "2026-03-10";

  it("refuses to touch a row closed before today", () => {
    const past = version({
      _id: "v1",
      routineId: "r1",
      activeUntil: "2026-03-09",
    });
    expect(checkScheduleWrite(past, today, { closeAt: today })).toMatch(/immutable/u);
  });

  it("lets the frontier retract future coverage but never past coverage", () => {
    const frontier = version({ _id: "v1", routineId: "r1" });
    expect(checkScheduleWrite(frontier, today, { closeAt: today })).toBeNull();
    expect(checkScheduleWrite(frontier, today, { closeAt: "2026-03-09" })).toMatch(
      /never past coverage/u,
    );
  });

  it("opens new rows today or later, never behind today", () => {
    expect(checkScheduleWrite(undefined, today, { openFrom: today })).toBeNull();
    expect(checkScheduleWrite(undefined, today, { openFrom: "2026-03-09" })).toMatch(
      /today or later/u,
    );
  });
});
