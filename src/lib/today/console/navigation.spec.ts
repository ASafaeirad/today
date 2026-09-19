import { describe, expect, it } from "vite-plus/test";

import type { RosterEntry } from "./types";

import { nextRosterRoutine, selectedLogDate, selectedRosterIndex, stepLogDate } from "./navigation";

function entry(id: string, marked: boolean): RosterEntry {
  return {
    instanceId: `instance-${id}` as RosterEntry["instanceId"],
    routineId: id as RosterEntry["routineId"],
    scheduleVersionId: `schedule-${id}` as RosterEntry["scheduleVersionId"],
    name: id,
    outcome: marked ? "done" : "missed",
    marked,
    settled: false,
  };
}

describe("Roster selection", () => {
  const roster = [entry("read", true), entry("walk", false), entry("write", false)];

  it("keeps selection on Routine identity when the Roster is replaced", () => {
    expect(selectedRosterIndex([roster[2]!, roster[1]!, roster[0]!], roster[1]!.routineId)).toBe(1);
  });

  it("falls back to the first open Routine when selection disappears", () => {
    expect(selectedRosterIndex(roster, "gone" as RosterEntry["routineId"])).toBe(1);
  });

  it("advances to the next open Routine", () => {
    expect(nextRosterRoutine(roster, 0)).toBe(roster[1]!.routineId);
  });

  it("steps through Log dates from newest to oldest", () => {
    const history = (["2026-09-09", "2026-09-10", "2026-09-11"] as const).map((date) => ({
      date,
      scheduled: 1,
      open: 0,
      done: 1,
      skipped: 0,
      missed: 0,
      state: "closed" as const,
      sealed: true,
      award: null,
    }));

    expect(stepLogDate(history, "2026-09-11", 1)).toBe("2026-09-10");
    expect(selectedLogDate(history, "2026-08-01")).toBe("2026-09-11");
    expect(stepLogDate(history, "2026-08-01", 1)).toBe("2026-09-10");
  });
});
