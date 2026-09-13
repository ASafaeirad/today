import { MAX_SWEEP_DAYS, MAX_SWEEP_PLACEMENTS } from "#domain/constants";
import { addDays, datesBetween } from "#domain/date";
import { EVERY_DAY, maskFromDays } from "#domain/schedule";

import { api } from "./_generated/api";
import { atDate, bankSkips, initConvexTest, realTime, signIn, sweepToToday } from "./setup.spec";

const WEEKDAYS = maskFromDays([1, 2, 3, 4, 5]);
const SUNDAYS = maskFromDays([0]);

/** 2026-03-01 is a Sunday. */
async function ledger(today: string, bank = 0) {
  const t = initConvexTest();
  atDate(today);
  const as = await signIn(t);
  if (bank === 0) {
    await as.mutation(api.owners.ensure, { timezone: "UTC" });
    return { t, as };
  }
  // A skip is bought, so a fixture that spends one mints it first, on dates of
  // its own that end before this ledger starts.
  await bankSkips(as, { count: bank, before: today });
  atDate(today);
  return { t, as };
}

afterEach(() => {
  realTime();
});

describe("the sweep", () => {
  it("pins a roster for every past date, opened or not", async () => {
    const { as } = await ledger("2026-03-01");
    await as.mutation(api.routines.create, { name: "Run", dowMask: EVERY_DAY });

    atDate("2026-03-05");
    await sweepToToday(as);

    for (const date of ["2026-03-01", "2026-03-03", "2026-03-05"]) {
      const day = await as.query(api.days.get, { date });
      expect(day.roster).toHaveLength(1);
    }
    const unopened = await as.query(api.days.get, { date: "2026-03-03" });
    expect(unopened.state).toBe("awaitingReview");
    expect(unopened.roster[0]!.marked).toBe(false);
  });

  it("places nothing on a date the mask does not name", async () => {
    const { as } = await ledger("2026-03-01");
    await as.mutation(api.routines.create, { name: "Run", dowMask: SUNDAYS });

    atDate("2026-03-04");
    await sweepToToday(as);

    expect((await as.query(api.days.get, { date: "2026-03-02" })).roster).toEqual([]);
    expect((await as.query(api.days.get, { date: "2026-03-01" })).roster).toHaveLength(1);
  });

  it("writes nothing on a re-run, because the watermark moves only forward", async () => {
    const { t, as } = await ledger("2026-03-01");
    await as.mutation(api.routines.create, { name: "Run", dowMask: EVERY_DAY });

    atDate("2026-03-05");
    await sweepToToday(as);
    const first = await t.run((ctx) => ctx.db.query("instances").collect());

    await sweepToToday(as);
    await sweepToToday(as);
    const second = await t.run((ctx) => ctx.db.query("instances").collect());

    expect(second.map((i) => i._id)).toEqual(first.map((i) => i._id));
  });

  it("pins a fortnight against the old version before a schedule edit lands", async () => {
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
    await sweepToToday(as);
    expect((await as.query(api.days.get, { date: "2026-03-20" })).roster).toHaveLength(1);
    expect((await as.query(api.days.get, { date: "2026-03-21" })).roster).toEqual([]);
    const sunday = await as.query(api.days.get, { date: "2026-03-22" });
    expect(sunday.roster).toHaveLength(1);
    expect(sunday.roster[0]!.scheduleVersionId).not.toBe(scheduleVersionId);
  });
});

describe("the sweep's bounds", () => {
  it("refuses a write while a backlog larger than one transaction is outstanding", async () => {
    const { as } = await ledger("2026-01-01");
    const { routineId } = await as.mutation(api.routines.create, {
      name: "Run",
      dowMask: EVERY_DAY,
    });

    // A year away is more Instances than one mutation can pin, and pinning half
    // of them and writing anyway is the retroactive reshaping the sweep exists
    // to prevent. So the edit is refused rather than half applied.
    atDate("2027-01-01");
    await expect(as.mutation(api.schedules.set, { routineId, dowMask: SUNDAYS })).rejects.toThrow(
      /over the sweep limit/u,
    );

    // `owners.sweep` is the way out, and it commits every chunk it pins.
    const first = await as.mutation(api.owners.sweep, {});
    expect(first.caughtUp).toBe(false);
    expect(first.pinsThroughDate).toBe(addDays("2026-01-01", MAX_SWEEP_DAYS));

    await expect(sweepToToday(as)).resolves.toMatchObject({
      caughtUp: true,
      pinsThroughDate: "2027-01-01",
    });
    await as.mutation(api.schedules.set, { routineId, dowMask: SUNDAYS });
    // A year of backlog is a dozen committed chunks, which is real work rather
    // than a slow assertion. Budgeted like the other tests that pin a year.
  }, 30_000);

  it("stops on the Instance bound as well as the date one", async () => {
    const { as } = await ledger("2026-03-01");
    const routines = 20;
    for (let n = 0; n < routines; n += 1) {
      await as.mutation(api.routines.create, { name: `Routine ${n}`, dowMask: EVERY_DAY });
    }

    // Fewer dates than the date bound, more Instances than the Instance one.
    atDate("2026-03-26");
    const first = await as.mutation(api.owners.sweep, {});
    expect(first.caughtUp).toBe(false);
    expect(first.pinsThroughDate).toBe(addDays("2026-03-01", MAX_SWEEP_PLACEMENTS / routines));

    await expect(sweepToToday(as)).resolves.toMatchObject({
      caughtUp: true,
      pinsThroughDate: "2026-03-26",
    });
  });

  it("a chunk stops on a date boundary, so it never leaves half a roster", async () => {
    const { t, as } = await ledger("2026-03-01");
    for (const name of ["Run", "Read", "Call"]) {
      await as.mutation(api.routines.create, { name, dowMask: EVERY_DAY });
    }

    atDate("2027-03-01");
    const first = await as.mutation(api.owners.sweep, {});
    const instances = await t.run((ctx) => ctx.db.query("instances").collect());

    const pinned = instances.filter((row) => row.date <= first.pinsThroughDate);
    expect(pinned).toHaveLength(instances.length);
    for (const date of datesBetween("2026-03-01", first.pinsThroughDate)) {
      expect(instances.filter((row) => row.date === date)).toHaveLength(3);
    }
  }, 30_000);
});

describe("the day-of-week mask", () => {
  it("refuses a mask outside the seven bits, on create as well as on edit", async () => {
    const { as } = await ledger("2026-03-01");

    // 128 reads as active and places nothing; -1 is coerced into every day.
    for (const dowMask of [128, -1, 1.5]) {
      await expect(as.mutation(api.routines.create, { name: "Run", dowMask })).rejects.toThrow(
        /not a day-of-week mask/iu,
      );
    }

    const { routineId } = await as.mutation(api.routines.create, {
      name: "Run",
      dowMask: EVERY_DAY,
    });
    await expect(as.mutation(api.schedules.set, { routineId, dowMask: 128 })).rejects.toThrow(
      /not a day-of-week mask/iu,
    );

    // A refused create writes no routine and no first schedule version.
    await expect(as.query(api.routines.list, {})).resolves.toHaveLength(1);
    await expect(as.query(api.schedules.history, { routineId })).resolves.toHaveLength(1);
  });
});

describe("the plan list", () => {
  it("a retired routine leaves the plan at once and today's roster at midnight", async () => {
    const { as } = await ledger("2026-03-01");
    const { routineId } = await as.mutation(api.routines.create, {
      name: "Run",
      dowMask: EVERY_DAY,
    });

    await as.mutation(api.schedules.retire, { routineId });

    // Retirement closes the frontier *at* today, so today keeps its Instance
    // and today's state still reads active. The plan is the go-forward list.
    const [listed] = await as.query(api.routines.list, {});
    expect(listed!.state).toBe("active");
    expect(listed!.planned).toBe("retired");

    atDate("2026-03-02");
    await sweepToToday(as);
    const [tomorrow] = await as.query(api.routines.list, {});
    expect(tomorrow!.state).toBe("lapsed");
    expect(tomorrow!.planned).toBe("retired");
  });

  it("a paused routine is planned as paused, not as retired", async () => {
    const { as } = await ledger("2026-03-01");
    const { routineId } = await as.mutation(api.routines.create, {
      name: "Run",
      dowMask: EVERY_DAY,
    });

    await as.mutation(api.schedules.set, { routineId, dowMask: 0 });
    expect((await as.query(api.routines.list, {}))[0]!.planned).toBe("paused");
  });
});

describe("marks and close", () => {
  it("the latest mark wins and the instance cites it", async () => {
    const { as } = await ledger("2026-03-02", 1);
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
    await expect(
      as.query(api.marks.forCell, { date: "2026-03-02", routineId }),
    ).resolves.toHaveLength(2);
  });

  it("an unset clears to missed and cites the unset", async () => {
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

  it("a mark on an open day writes no projection row", async () => {
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

    await expect(t.run((ctx) => ctx.db.query("dayStats").collect())).resolves.toEqual([]);
  });

  it("closing settles every unset instance as missed", async () => {
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

  it("a second close changes nothing and never mints twice", async () => {
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

  it("a closed day is amended in place, with no reopen", async () => {
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

  it("refuses a mark on a date the routine was not scheduled", async () => {
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
