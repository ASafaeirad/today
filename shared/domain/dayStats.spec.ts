import { dayDigest, foldDay, type InstanceLeaf } from "./dayStats";

const leaf = (
  routineId: string,
  outcome: InstanceLeaf["outcome"],
  outcomeRev = 1,
): InstanceLeaf => ({
  routineId,
  scheduleVersionId: `sv-${routineId}`,
  outcome,
  outcomeRev,
});

describe("the day fold", () => {
  it("keeps done, skipped and missed separately", () => {
    const fold = foldDay(
      "2026-03-02",
      [leaf("a", "done"), leaf("b", "skipped"), leaf("c", "missed")],
      true,
    );
    expect(fold).toMatchObject({ scheduled: 3, done: 1, skipped: 1, missed: 1 });
  });

  it("folds an empty roster to zeroes rather than to nothing", () => {
    expect(foldDay("2026-03-02", [], true)).toMatchObject({
      scheduled: 0,
      done: 0,
      missed: 0,
    });
  });
});

describe("the day digest", () => {
  it("does not depend on the order the instances arrive in", () => {
    const instances = [leaf("b", "done"), leaf("a", "missed")];
    expect(dayDigest("2026-03-02", instances)).toBe(
      dayDigest("2026-03-02", [...instances].reverse()),
    );
  });

  it("moves when an outcome changes", () => {
    expect(dayDigest("2026-03-02", [leaf("a", "done")])).not.toBe(
      dayDigest("2026-03-02", [leaf("a", "missed")]),
    );
  });

  it("moves on a re-tap that lands on the same outcome", () => {
    expect(dayDigest("2026-03-02", [leaf("a", "done", 1)])).not.toBe(
      dayDigest("2026-03-02", [leaf("a", "done", 2)]),
    );
  });

  it("commits to the date, so two days cannot share a digest", () => {
    expect(dayDigest("2026-03-02", [leaf("a", "done")])).not.toBe(
      dayDigest("2026-03-03", [leaf("a", "done")]),
    );
  });
});
