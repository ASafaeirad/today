import { afterEach, describe, expect, test } from "vite-plus/test";

import { EVERY_DAY, maskFromDays } from "#domain/schedule";

import { api } from "./_generated/api";
import { atDate, initConvexTest, realTime, signIn } from "./setup.spec";

const WEEKDAYS = maskFromDays([1, 2, 3, 4, 5]);
const SUNDAYS = maskFromDays([0]);

/** 2026-03-01 is a Sunday. */
async function ledger(today: string) {
  const t = initConvexTest();
  atDate(today);
  const as = await signIn(t);
  await as.mutation(api.owners.ensure, { timezone: "UTC" });
  return { t, as };
}

afterEach(() => {
  realTime();
});

describe("the sweep", () => {
  test("pins a roster for every past date, opened or not", async () => {
    const { as } = await ledger("2026-03-01");
    await as.mutation(api.routines.create, { name: "Run", dowMask: EVERY_DAY });

    atDate("2026-03-05");
    await as.mutation(api.owners.sweep, {});

    for (const date of ["2026-03-01", "2026-03-03", "2026-03-05"]) {
      const day = await as.query(api.days.get, { date });
      expect(day.roster).toHaveLength(1);
    }
    const unopened = await as.query(api.days.get, { date: "2026-03-03" });
    expect(unopened.state).toBe("awaitingReview");
    expect(unopened.roster[0]!.marked).toBe(false);
  });

  test("places nothing on a date the mask does not name", async () => {
    const { as } = await ledger("2026-03-01");
    await as.mutation(api.routines.create, { name: "Run", dowMask: SUNDAYS });

    atDate("2026-03-04");
    await as.mutation(api.owners.sweep, {});

    expect((await as.query(api.days.get, { date: "2026-03-02" })).roster).toEqual([]);
    expect((await as.query(api.days.get, { date: "2026-03-01" })).roster).toHaveLength(1);
  });

  test("writes nothing on a re-run, because the watermark moves only forward", async () => {
    const { t, as } = await ledger("2026-03-01");
    await as.mutation(api.routines.create, { name: "Run", dowMask: EVERY_DAY });

    atDate("2026-03-05");
    await as.mutation(api.owners.sweep, {});
    const first = await t.run((ctx) => ctx.db.query("instances").collect());

    await as.mutation(api.owners.sweep, {});
    await as.mutation(api.owners.sweep, {});
    const second = await t.run((ctx) => ctx.db.query("instances").collect());

    expect(second.map((i) => i._id)).toEqual(first.map((i) => i._id));
  });

  test("pins a fortnight against the old version before a schedule edit lands", async () => {
    const { as } = await ledger("2026-03-06");
    const { routineId, scheduleVersionId } = await as.mutation(api.routines.create, {
      name: "Run",
      dowMask: WEEKDAYS,
    });

    // Fourteen days away, then an edit on the twentieth.
    atDate("2026-03-20");
    await as.mutation(api.schedules.set, { routineId, dowMask: SUNDAYS });

    // The fortnight was pinned against the version in force at the time.
    const monday = await as.query(api.days.get, { date: "2026-03-09" });
    expect(monday.roster).toHaveLength(1);
    expect(monday.roster[0]!.scheduleVersionId).toBe(scheduleVersionId);
    expect((await as.query(api.days.get, { date: "2026-03-14" })).roster).toEqual([]);

    // The new version takes effect from tomorrow, not from today.
    atDate("2026-03-23");
    await as.mutation(api.owners.sweep, {});
    expect((await as.query(api.days.get, { date: "2026-03-20" })).roster).toHaveLength(1);
    expect((await as.query(api.days.get, { date: "2026-03-21" })).roster).toEqual([]);
    const sunday = await as.query(api.days.get, { date: "2026-03-22" });
    expect(sunday.roster).toHaveLength(1);
    expect(sunday.roster[0]!.scheduleVersionId).not.toBe(scheduleVersionId);
  });
});

describe("marks and close", () => {
  test("the latest mark wins and the instance cites it", async () => {
    const { as } = await ledger("2026-03-02");
    const { routineId } = await as.mutation(api.routines.create, {
      name: "Run",
      dowMask: EVERY_DAY,
    });

    await as.mutation(api.marks.append, {
      date: "2026-03-02",
      routineId,
      outcome: "done",
    });
    const second = await as.mutation(api.marks.append, {
      date: "2026-03-02",
      routineId,
      outcome: "skipped",
    });

    const day = await as.query(api.days.get, { date: "2026-03-02" });
    expect(day.roster[0]!.outcome).toBe("skipped");
    expect(second.resolvedFromMarkId).toBe(second.markId);
    expect(await as.query(api.marks.forCell, { date: "2026-03-02", routineId })).toHaveLength(2);
  });

  test("an unset clears to missed and cites the unset", async () => {
    const { as } = await ledger("2026-03-02");
    const { routineId } = await as.mutation(api.routines.create, {
      name: "Run",
      dowMask: EVERY_DAY,
    });

    await as.mutation(api.marks.append, {
      date: "2026-03-02",
      routineId,
      outcome: "done",
    });
    const unset = await as.mutation(api.marks.append, {
      date: "2026-03-02",
      routineId,
      outcome: null,
    });

    expect(unset.outcome).toBe("missed");
    expect(unset.resolvedFromMarkId).toBe(unset.markId);
  });

  test("a mark on an open day writes no projection row", async () => {
    const { t, as } = await ledger("2026-03-02");
    const { routineId } = await as.mutation(api.routines.create, {
      name: "Run",
      dowMask: EVERY_DAY,
    });
    await as.mutation(api.marks.append, {
      date: "2026-03-02",
      routineId,
      outcome: "done",
    });

    expect(await t.run((ctx) => ctx.db.query("dayStats").collect())).toEqual([]);
  });

  test("closing settles every unset instance as missed", async () => {
    const { as } = await ledger("2026-03-02");
    const { routineId } = await as.mutation(api.routines.create, {
      name: "Skip me",
      dowMask: EVERY_DAY,
    });
    await as.mutation(api.routines.create, { name: "Run", dowMask: EVERY_DAY });
    await as.mutation(api.marks.append, {
      date: "2026-03-02",
      routineId,
      outcome: "done",
    });

    await as.mutation(api.days.close, { date: "2026-03-02" });

    const day = await as.query(api.days.get, { date: "2026-03-02" });
    expect(day.state).toBe("closed");
    expect(day.stats).toMatchObject({ scheduled: 2, done: 1, missed: 1, skipped: 0 });
    expect(day.roster.every((entry) => entry.settled)).toBe(true);
  });

  test("a second close changes nothing and never mints twice", async () => {
    const { t, as } = await ledger("2026-03-02");
    await as.mutation(api.routines.create, { name: "Run", dowMask: EVERY_DAY });

    const first = await as.mutation(api.days.close, { date: "2026-03-02" });
    const before = await t.run((ctx) => ctx.db.query("dayStats").collect());

    const second = await as.mutation(api.days.close, { date: "2026-03-02" });
    const after = await t.run((ctx) => ctx.db.query("dayStats").collect());

    expect(first.alreadyClosed).toBe(false);
    expect(second.alreadyClosed).toBe(true);
    expect(second.rev).toBe(first.rev);
    expect(after).toEqual(before);
  });

  test("a closed day is amended in place, with no reopen", async () => {
    const { as } = await ledger("2026-03-02");
    const { routineId } = await as.mutation(api.routines.create, {
      name: "Run",
      dowMask: EVERY_DAY,
    });
    await as.mutation(api.days.close, { date: "2026-03-02" });

    await as.mutation(api.marks.append, {
      date: "2026-03-02",
      routineId,
      outcome: "done",
    });

    const day = await as.query(api.days.get, { date: "2026-03-02" });
    expect(day.state).toBe("closed");
    expect(day.stats).toMatchObject({ done: 1, missed: 0 });
  });

  test("refuses a mark on a date the routine was not scheduled", async () => {
    const { as } = await ledger("2026-03-02");
    const { routineId } = await as.mutation(api.routines.create, {
      name: "Run",
      dowMask: SUNDAYS,
    });

    await expect(
      as.mutation(api.marks.append, {
        date: "2026-03-02",
        routineId,
        outcome: "done",
      }),
    ).rejects.toThrow(/not scheduled/iu);
  });
});
