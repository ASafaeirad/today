import { describe, expect, it } from "vite-plus/test";

import { RETIREMENT_THRESHOLD } from "./constants";
import { consecutiveMisses, shouldSuggestRetirement } from "./retirement";

describe("the retirement counter", () => {
  it("counts leading misses and stops at the first other outcome", () => {
    expect(consecutiveMisses(["missed", "missed", "done", "missed"])).toBe(2);
  });

  it("is reset by a skip, which is a decision rather than a failure", () => {
    expect(consecutiveMisses(["skipped", "missed", "missed"])).toBe(0);
  });

  it("suggests retirement only at the threshold", () => {
    expect(shouldSuggestRetirement(RETIREMENT_THRESHOLD - 1)).toBe(false);
    expect(shouldSuggestRetirement(RETIREMENT_THRESHOLD)).toBe(true);
  });
});
