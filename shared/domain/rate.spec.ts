import { describe, expect, it } from "vite-plus/test";

import { clipComparison, completionRate } from "./rate";

describe("the completion rate", () => {
  it("is done over done plus missed, never done over scheduled", () => {
    expect(completionRate({ done: 3, missed: 1 })).toBe(0.75);
  });

  it("keeps a skipped instance off both sides", () => {
    // Ten of fifteen skipped, five done: 100% on a denominator of five.
    expect(completionRate({ done: 5, missed: 0 })).toBe(1);
  });

  it("reads as not active rather than as 0% when nothing was scheduled", () => {
    expect(completionRate({ done: 0, missed: 0 })).toBeNull();
  });

  it("is 0 when everything scheduled was missed", () => {
    expect(completionRate({ done: 0, missed: 4 })).toBe(0);
  });
});

describe("comparing a partial period", () => {
  it("clips both periods to the same elapsed slice", () => {
    const clipped = clipComparison({
      current: { from: "2026-08-01", to: "2026-08-31" },
      previous: { from: "2026-07-01", to: "2026-07-31" },
      lastClosed: "2026-08-28",
    });
    expect(clipped.elapsedDays).toBe(28);
    expect(clipped.current).toEqual({ from: "2026-08-01", to: "2026-08-28" });
    expect(clipped.previous).toEqual({ from: "2026-07-01", to: "2026-07-28" });
  });

  it("clips to the shorter previous period, so February cannot overrun", () => {
    const clipped = clipComparison({
      current: { from: "2026-03-01", to: "2026-03-31" },
      previous: { from: "2026-02-01", to: "2026-02-28" },
      lastClosed: "2026-03-31",
    });
    expect(clipped.elapsedDays).toBe(28);
  });

  it("compares nothing when no day in the current period has closed", () => {
    const clipped = clipComparison({
      current: { from: "2026-08-01", to: "2026-08-31" },
      previous: { from: "2026-07-01", to: "2026-07-31" },
      lastClosed: "2026-07-31",
    });
    expect(clipped).toEqual({ current: null, previous: null, elapsedDays: 0 });
  });
});
