import { afterEach, describe, expect, test } from "vite-plus/test";

import { RATE_DOCUMENT_LIMIT } from "#domain/constants";
import { datesBetween } from "#domain/date";
import { EVERY_DAY, maskFromDays } from "#domain/schedule";

import { api } from "./_generated/api";
import { atDate, bankSkips, initConvexTest, realTime, signIn, sweepToToday } from "./setup.spec";

type Ledger = Awaited<ReturnType<typeof ledger>>;

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

async function closeEach({ as }: Ledger, from: string, to: string) {
  for (const date of datesBetween(from, to)) {
    await as.mutation(api.days.close, { date });
  }
}

afterEach(() => {
  realTime();
});

describe("rates", () => {
  test("counts done over done plus missed, with skipped on neither side", async () => {
    const l = await ledger("2026-03-01", 1);
    const { as } = l;
    const { routineId } = await as.mutation(api.routines.create, {
      name: "Run",
      dowMask: EVERY_DAY,
    });

    atDate("2026-03-04");
    await sweepToToday(as);
    await as.mutation(api.marks.append, {
      date: "2026-03-01",
      routineId,
      outcome: "done",
    });
    await as.mutation(api.marks.append, {
      date: "2026-03-02",
      routineId,
      outcome: "skipped",
    });
    // 03-03 is left unmarked, so closing it settles it as missed.
    await closeEach(l, "2026-03-01", "2026-03-03");

    const answer = await as.query(api.rates.window, {
      from: "2026-03-01",
      to: "2026-03-04",
    });

    expect(answer.counts).toMatchObject({ done: 1, skipped: 1, missed: 1, open: 1 });
    expect(answer.rate).toBe(0.5);
  });

  test("an open day is pending, not missed, so opening today cannot lower a rate", async () => {
    const l = await ledger("2026-03-01");
    const { as } = l;
    const { routineId } = await as.mutation(api.routines.create, {
      name: "Run",
      dowMask: EVERY_DAY,
    });
    await as.mutation(api.marks.append, {
      date: "2026-03-01",
      routineId,
      outcome: "done",
    });
    await as.mutation(api.days.close, { date: "2026-03-01" });

    atDate("2026-03-02");
    await sweepToToday(as);

    const answer = await as.query(api.rates.window, {
      from: "2026-03-01",
      to: "2026-03-02",
    });
    expect(answer.rate).toBe(1);
    expect(answer.counts.open).toBe(1);
    expect(answer.receipt.excluded.open).toBe(1);
  });

  test("a day that was never closed is excluded as awaiting review", async () => {
    const l = await ledger("2026-03-01");
    const { as } = l;
    await as.mutation(api.routines.create, { name: "Run", dowMask: EVERY_DAY });

    atDate("2026-03-05");
    await sweepToToday(as);
    await as.mutation(api.days.close, { date: "2026-03-01" });

    const answer = await as.query(api.rates.window, {
      from: "2026-03-01",
      to: "2026-03-05",
    });
    expect(answer.counts.missed).toBe(1);
    expect(answer.receipt.excluded.awaitingReview).toBe(3);
    expect(answer.receipt.excluded.open).toBe(1);
  });

  test("a paused routine appears in no denominator", async () => {
    const l = await ledger("2026-03-01");
    const { as } = l;
    const { routineId } = await as.mutation(api.routines.create, {
      name: "Run",
      dowMask: EVERY_DAY,
    });

    // Pausing on the first takes effect on the second.
    await as.mutation(api.schedules.set, { routineId, dowMask: 0 });

    atDate("2026-03-05");
    await sweepToToday(as);
    await closeEach(l, "2026-03-01", "2026-03-05");

    const answer = await as.query(api.rates.window, {
      from: "2026-03-02",
      to: "2026-03-05",
      routineId,
    });
    expect(answer.counts).toMatchObject({ done: 0, missed: 0 });
    expect(answer.rate).toBeNull();
    expect(answer.receipt.excluded.paused).toBe(1);

    const listed = await as.query(api.routines.list, {});
    expect(listed[0]!.state).toBe("paused");
  });

  test("a lapsed year reads as not active rather than as 0%", async () => {
    const l = await ledger("2025-06-01");
    const { as } = l;
    const { routineId } = await as.mutation(api.routines.create, {
      name: "Run",
      dowMask: EVERY_DAY,
    });
    await as.mutation(api.days.close, { date: "2025-06-01" });

    // Retired the same day: the frontier closes and nothing opens.
    await as.mutation(api.schedules.retire, { routineId });

    atDate("2026-06-01");
    await sweepToToday(as);

    const lapsed = await as.query(api.rates.window, {
      from: "2026-01-01",
      to: "2026-12-31",
      routineId,
    });
    expect(lapsed.counts).toMatchObject({ done: 0, missed: 0, awaitingReview: 0 });
    expect(lapsed.rate).toBeNull();

    const ran = await as.query(api.rates.window, {
      from: "2025-01-01",
      to: "2025-12-31",
      routineId,
    });
    expect(ran.rate).toBe(0);

    // One routine with a visible gap, not two routines.
    expect(await as.query(api.routines.list, {})).toHaveLength(1);
    expect((await as.query(api.routines.list, {}))[0]!.state).toBe("lapsed");
  });

  test("a routine that returns after a gap keeps one identity", async () => {
    const l = await ledger("2025-06-01");
    const { as } = l;
    const { routineId } = await as.mutation(api.routines.create, {
      name: "Run",
      dowMask: EVERY_DAY,
    });
    await as.mutation(api.schedules.retire, { routineId });

    // Two years of backlog is more than one transaction pins, so the catch-up
    // runs first and the edit lands on a watermark that has reached today.
    atDate("2027-06-01");
    await sweepToToday(as);
    await as.mutation(api.schedules.set, { routineId, dowMask: EVERY_DAY });

    const history = await as.query(api.schedules.history, { routineId });
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({
      activeFrom: "2025-06-01",
      activeUntil: "2025-06-01",
    });
    expect(history[1]).toMatchObject({ activeFrom: "2027-06-02", activeUntil: null });
  });

  test("compares a partial period against the same slice of the previous one", async () => {
    const l = await ledger("2026-02-01");
    const { as } = l;
    const { routineId } = await as.mutation(api.routines.create, {
      name: "Run",
      dowMask: EVERY_DAY,
    });

    atDate("2026-03-05");
    await sweepToToday(as);
    for (const date of datesBetween("2026-02-01", "2026-02-28")) {
      await as.mutation(api.marks.append, { date, routineId, outcome: "done" });
    }
    await closeEach(l, "2026-02-01", "2026-03-03");

    const compared = await as.query(api.rates.compare, {
      from: "2026-03-01",
      to: "2026-03-31",
      previousFrom: "2026-02-01",
      previousTo: "2026-02-28",
    });

    expect(compared.elapsedDays).toBe(3);
    expect(compared.current!.to).toBe("2026-03-03");
    expect(compared.previous!.to).toBe("2026-02-03");
    expect(compared.current!.rate).toBe(0);
    expect(compared.previous!.rate).toBe(1);
  });
});

describe("the receipt", () => {
  test("names the bounds, the namespace and what it excluded", async () => {
    const l = await ledger("2026-03-01");
    const { as } = l;
    await as.mutation(api.routines.create, { name: "Run", dowMask: EVERY_DAY });

    atDate("2026-03-03");
    await sweepToToday(as);
    await closeEach(l, "2026-03-01", "2026-03-02");

    const answer = await as.query(api.rates.window, {
      from: "2026-03-01",
      to: "2026-03-03",
    });

    expect(answer.receipt.source).toBe("component");
    expect(answer.receipt.bounds).toEqual({
      from: "2026-03-01",
      to: "2026-03-03",
      inclusive: true,
    });
    expect(answer.receipt.sortKey).toBe("[state, localDate]");
    expect(answer.receipt.denominator).toBe("closed and scheduled: done + missed");
    expect(answer.receipt.currentAsOf).toMatchObject({ date: "2026-03-02" });
    expect(answer.receipt.documentLimit).toBe(RATE_DOCUMENT_LIMIT);
  });

  test("the recount folds the instances the bounds name and agrees", async () => {
    const l = await ledger("2026-01-01");
    const { as } = l;
    const { routineId } = await as.mutation(api.routines.create, {
      name: "Run",
      dowMask: maskFromDays([1, 3, 5]),
    });

    atDate("2026-02-15");
    await sweepToToday(as);
    for (const date of datesBetween("2026-01-05", "2026-01-20")) {
      const day = await as.query(api.days.get, { date });
      if (day.roster.length === 0) continue;
      await as.mutation(api.marks.append, { date, routineId, outcome: "done" });
    }
    await closeEach(l, "2026-01-01", "2026-02-10");

    const recount = await as.query(api.rates.recount, {
      from: "2026-01-01",
      to: "2026-02-15",
    });

    expect(recount.agrees).toBe(true);
    expect(recount.disagreements).toEqual([]);
    expect(recount.counts).toEqual(recount.component);
    expect(recount.counts.done).toBeGreaterThan(0);
  });

  test("a rate drills down to the days underneath it", async () => {
    const l = await ledger("2026-03-01", 2);
    const { as } = l;
    const { routineId } = await as.mutation(api.routines.create, {
      name: "Run",
      dowMask: EVERY_DAY,
    });

    atDate("2026-03-05");
    await sweepToToday(as);
    await as.mutation(api.marks.append, {
      date: "2026-03-02",
      routineId,
      outcome: "skipped",
    });
    await as.mutation(api.marks.append, {
      date: "2026-03-04",
      routineId,
      outcome: "skipped",
    });
    await closeEach(l, "2026-03-01", "2026-03-03");

    const skipped = await as.query(api.routines.datesWithOutcome, {
      routineId,
      outcome: "skipped",
      from: "2026-03-01",
      to: "2026-03-05",
    });

    // The fourth is marked skipped but its day is still open, so it is a hold
    // rather than a spend and does not appear under the rate.
    expect(skipped).toEqual(["2026-03-02"]);
  });

  test("a per-routine span is answered in its own namespace", async () => {
    const l = await ledger("2026-03-01");
    const { as } = l;
    const a = await as.mutation(api.routines.create, {
      name: "Run",
      dowMask: EVERY_DAY,
    });
    const b = await as.mutation(api.routines.create, {
      name: "Read",
      dowMask: EVERY_DAY,
    });

    atDate("2026-03-03");
    await sweepToToday(as);
    for (const date of datesBetween("2026-03-01", "2026-03-02")) {
      await as.mutation(api.marks.append, {
        date,
        routineId: a.routineId,
        outcome: "done",
      });
    }
    await closeEach(l, "2026-03-01", "2026-03-02");

    const forA = await as.query(api.rates.window, {
      from: "2026-03-01",
      to: "2026-03-02",
      routineId: a.routineId,
    });
    const forB = await as.query(api.rates.window, {
      from: "2026-03-01",
      to: "2026-03-02",
      routineId: b.routineId,
    });
    const overall = await as.query(api.rates.window, {
      from: "2026-03-01",
      to: "2026-03-02",
    });

    expect(forA.rate).toBe(1);
    expect(forB.rate).toBe(0);
    expect(overall.rate).toBe(0.5);
    expect(forA.receipt.namespace).not.toBe(forB.receipt.namespace);
    expect(overall.receipt.namespace).not.toBe(forA.receipt.namespace);
  });
});
