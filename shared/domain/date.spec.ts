import { describe, expect, it } from "vite-plus/test";

import {
  addDays,
  datesBetween,
  dayOfWeek,
  daysBetween,
  endOfMonth,
  localDateOf,
  monthChunks,
  rangeLength,
  startOfMonth,
} from "./date";

describe("local dates", () => {
  it("is the calendar date in the owner's timezone, not UTC", () => {
    const newYearInTokyo = Date.parse("2025-12-31T16:00:00Z");
    expect(localDateOf(newYearInTokyo, "Asia/Tokyo")).toBe("2026-01-01");
    expect(localDateOf(newYearInTokyo, "UTC")).toBe("2025-12-31");
  });

  it("crosses months, years and leap days", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(daysBetween("2025-12-31", "2026-01-01")).toBe(1);
    expect(daysBetween("2026-01-01", "2025-12-31")).toBe(-1);
  });

  it("counts a 30 day horizon inclusively", () => {
    expect(rangeLength("2026-03-01", "2026-03-30")).toBe(30);
    expect(rangeLength("2026-03-30", "2026-03-01")).toBe(0);
    expect(datesBetween("2026-03-01", "2026-03-03")).toEqual([
      "2026-03-01",
      "2026-03-02",
      "2026-03-03",
    ]);
  });

  it("numbers Sunday zero, matching the day-of-week mask", () => {
    expect(dayOfWeek("2026-03-01")).toBe(0);
    expect(dayOfWeek("2026-03-02")).toBe(1);
    expect(dayOfWeek("2026-03-07")).toBe(6);
  });

  it("chunks a range one calendar month at a time", () => {
    expect(startOfMonth("2026-03-17")).toBe("2026-03-01");
    expect(endOfMonth("2026-02-17")).toBe("2026-02-28");
    expect(monthChunks("2026-01-15", "2026-03-02")).toEqual([
      { from: "2026-01-15", to: "2026-01-31" },
      { from: "2026-02-01", to: "2026-02-28" },
      { from: "2026-03-01", to: "2026-03-02" },
    ]);
  });
});
