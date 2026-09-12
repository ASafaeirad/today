import { describe, expect, it } from "vite-plus/test";

import { isRoutinePlanned } from "./useRoutinePlan";

describe("the plan routine list", () => {
  it("shows an active routine from a list response without planned state", () => {
    expect(isRoutinePlanned({ state: "active" })).toBe(true);
  });

  it("uses planned state when the list response provides it", () => {
    expect(isRoutinePlanned({ state: "active", planned: "retired" })).toBe(false);
  });
});
