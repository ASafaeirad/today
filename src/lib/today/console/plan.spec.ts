import { describe, expect, it } from "vite-plus/test";

import { isRoutinePlanned } from "./plan";

describe("the Plan Routine list", () => {
  it("shows an active Routine from an older list response", () => {
    expect(isRoutinePlanned({ state: "active" })).toBe(true);
  });

  it("uses planned state when the list response provides it", () => {
    expect(isRoutinePlanned({ state: "active", planned: "retired" })).toBe(false);
  });
});
