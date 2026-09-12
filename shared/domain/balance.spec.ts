import { canAfford, computeBalance, horizonRange, withinHorizon, type HorizonRow } from "./balance";
import { DAYS_PER_SKIP, HORIZON_DAYS } from "./constants";
import { addDays } from "./date";

const TODAY = "2026-03-30";

const allDone = (date: string): HorizonRow => ({
  date,
  scheduled: 2,
  done: 2,
  skipped: 0,
  closed: true,
});

const spentOne = (date: string): HorizonRow => ({
  date,
  scheduled: 2,
  done: 1,
  skipped: 1,
  closed: true,
});

const daysBack = (count: number, make: (date: string) => HorizonRow) =>
  Array.from({ length: count }, (_, index) => make(addDays(TODAY, -index)));

describe("the balance", () => {
  it("covers the last 30 local dates and nothing else", () => {
    expect(horizonRange(TODAY)).toEqual({ from: "2026-03-01", to: TODAY });
  });

  it("mints one skip per five all-done days", () => {
    const balance = computeBalance({
      today: TODAY,
      rows: daysBack(DAYS_PER_SKIP * 2, allDone),
      holds: 0,
    });
    expect(balance.minted).toBe(2);
    expect(balance.balance).toBe(2);
  });

  it("does not let an empty day farm currency", () => {
    const empty = daysBack(HORIZON_DAYS, (date) => ({
      date,
      scheduled: 0,
      done: 0,
      skipped: 0,
      closed: true,
    }));
    expect(computeBalance({ today: TODAY, rows: empty, holds: 0 }).minted).toBe(0);
  });

  it("does not count a day that was never closed", () => {
    const open = daysBack(HORIZON_DAYS, (date) => ({ ...allDone(date), closed: false }));
    expect(computeBalance({ today: TODAY, rows: open, holds: 0 }).minted).toBe(0);
  });

  it("floors at zero rather than going into debt", () => {
    const balance = computeBalance({
      today: TODAY,
      rows: daysBack(3, spentOne),
      holds: 0,
    });
    expect(balance.spent).toBe(3);
    expect(balance.balance).toBe(0);
  });

  it("shows a hold as unavailable without deducting it", () => {
    const balance = computeBalance({
      today: TODAY,
      rows: daysBack(DAYS_PER_SKIP, allDone),
      holds: 1,
    });
    expect(balance.balance).toBe(1);
    expect(balance.available).toBe(0);
  });

  it("ignores days that have aged out of the horizon", () => {
    const insideAndOutside = [
      ...daysBack(DAYS_PER_SKIP, allDone),
      ...Array.from({ length: 20 }, (_, index) => allDone(addDays(TODAY, -(HORIZON_DAYS + index)))),
    ];
    expect(computeBalance({ today: TODAY, rows: insideAndOutside, holds: 0 }).minted).toBe(1);
  });

  it("sells only what is available, holds included", () => {
    const balance = computeBalance({
      today: TODAY,
      rows: daysBack(DAYS_PER_SKIP * 2, allDone),
      holds: 1,
    });
    expect(canAfford(balance, 1)).toBe(true);
    expect(canAfford(balance, 2)).toBe(false);
    expect(canAfford(balance, 0)).toBe(true);
  });

  it("charges only dates it can account for", () => {
    expect(withinHorizon(TODAY, TODAY)).toBe(true);
    expect(withinHorizon(TODAY, addDays(TODAY, -(HORIZON_DAYS - 1)))).toBe(true);
    expect(withinHorizon(TODAY, addDays(TODAY, -HORIZON_DAYS))).toBe(false);
    expect(withinHorizon(TODAY, addDays(TODAY, 1))).toBe(false);
  });

  it("falls on a day the owner does nothing, when an all-done day ages out", () => {
    // The five minting days sit at the oldest edge of the horizon.
    const rows = Array.from({ length: DAYS_PER_SKIP }, (_, index) =>
      allDone(addDays(TODAY, -(HORIZON_DAYS - 1) + index)),
    );
    expect(computeBalance({ today: TODAY, rows, holds: 0 }).balance).toBe(1);

    const tomorrow = addDays(TODAY, 1);
    expect(computeBalance({ today: tomorrow, rows, holds: 0 }).balance).toBe(0);
  });
});
