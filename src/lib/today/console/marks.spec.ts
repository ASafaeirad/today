import { describe, expect, it } from "vite-plus/test";

import type { RosterEntry } from "./types";

import { applyRosterMark } from "./marks";

const entry: RosterEntry = {
  instanceId: "instance-read" as RosterEntry["instanceId"],
  routineId: "routine-read" as RosterEntry["routineId"],
  scheduleVersionId: "schedule-read" as RosterEntry["scheduleVersionId"],
  name: "Read",
  outcome: "missed",
  marked: false,
  settled: false,
};

describe("optimistic Mark state", () => {
  it("applies an outcome to the matching Routine", () => {
    expect(applyRosterMark([entry], entry.routineId, "done")).toEqual([
      { ...entry, outcome: "done", marked: true },
    ]);
  });

  it("represents Unset as an unmarked missed wire value", () => {
    expect(
      applyRosterMark([{ ...entry, outcome: "done", marked: true }], entry.routineId, null),
    ).toEqual([entry]);
  });
});
