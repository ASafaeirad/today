import { describe, expect, it } from "vite-plus/test";

import { resolveOutcome, type MarkLike } from "./outcome";

const mark = (id: string, outcome: MarkLike["outcome"], serverAt: number): MarkLike => ({
  _id: id,
  outcome,
  serverAt,
});

describe("resolveOutcome", () => {
  it("resolves a cell with no marks to missed, citing nothing", () => {
    expect(resolveOutcome([], 7)).toEqual({
      outcome: "missed",
      resolvedFromMarkId: null,
      outcomeRev: 7,
    });
  });

  it("takes the latest mark by serverAt, whatever order it arrives in", () => {
    const marks = [mark("m1", "done", 300), mark("m2", "skipped", 100), mark("m3", "missed", 200)];
    expect(resolveOutcome(marks, 1).resolvedFromMarkId).toBe("m1");
    expect(resolveOutcome([...marks].reverse(), 1).resolvedFromMarkId).toBe("m1");
  });

  it("breaks equal timestamps by id, so a rebuild picks the same winner", () => {
    const marks = [mark("m9", "done", 100), mark("m2", "skipped", 100)];
    const forwards = resolveOutcome(marks, 1);
    const backwards = resolveOutcome([...marks].reverse(), 1);
    expect(forwards).toEqual(backwards);
    expect(forwards.resolvedFromMarkId).toBe("m9");
  });

  it("clears to missed on an unset, and cites the unset that did it", () => {
    const resolution = resolveOutcome([mark("m1", "done", 100), mark("m2", null, 200)], 4);
    expect(resolution).toEqual({
      outcome: "missed",
      resolvedFromMarkId: "m2",
      outcomeRev: 4,
    });
  });

  it("stamps the revision it was resolved at", () => {
    expect(resolveOutcome([mark("m1", "done", 1)], 12).outcomeRev).toBe(12);
  });
});
