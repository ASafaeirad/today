import { afterEach, describe, expect, test } from "vite-plus/test";

import { DAYS_PER_SKIP, RETIREMENT_THRESHOLD } from "#domain/constants";
import { datesBetween } from "#domain/date";
import { EVERY_DAY } from "#domain/schedule";

import { api, internal } from "./_generated/api";
import { atDate, initConvexTest, realTime, signIn, sweepToToday } from "./setup.spec";

type Ledger = Awaited<ReturnType<typeof ledger>>;

async function ledger(today: string) {
  const t = initConvexTest();
  atDate(today);
  const as = await signIn(t);
  await as.mutation(api.owners.ensure, { timezone: "UTC" });
  return { t, as };
}

async function closeEach({ as }: Ledger, from: string, to: string) {
  for (const date of datesBetween(from, to)) {
    await as.mutation(api.days.close, { date });
  }
}

async function markEach(
  { as }: Ledger,
  span: {
    routineId: string;
    from: string;
    to: string;
    outcome: "done" | "skipped" | "missed";
  },
) {
  for (const date of datesBetween(span.from, span.to)) {
    await as.mutation(api.marks.append, {
      date,
      routineId: span.routineId as never,
      outcome: span.outcome,
    });
  }
}

afterEach(() => {
  realTime();
});

describe("the balance", () => {
  test("mints one skip for five all-done days inside the horizon", async () => {
    const l = await ledger("2026-03-01");
    const { as } = l;
    const { routineId } = await as.mutation(api.routines.create, {
      name: "Run",
      dowMask: EVERY_DAY,
    });

    atDate("2026-03-10");
    await sweepToToday(as);
    await markEach(l, {
      routineId,
      from: "2026-03-01",
      to: "2026-03-05",
      outcome: "done",
    });
    await closeEach(l, "2026-03-01", "2026-03-09");

    const balance = await as.query(api.balance.current, {});
    expect(balance.allDoneDays).toBe(DAYS_PER_SKIP);
    expect(balance.minted).toBe(1);
    expect(balance.spent).toBe(0);
    expect(balance.balance).toBe(1);
    expect(balance.days.filter((day) => day.allDone)).toHaveLength(DAYS_PER_SKIP);
  });

  test("a hold reserves a skip without deducting it, and un-marking is free", async () => {
    const l = await ledger("2026-03-01");
    const { as } = l;
    const { routineId } = await as.mutation(api.routines.create, {
      name: "Run",
      dowMask: EVERY_DAY,
    });

    atDate("2026-03-10");
    await sweepToToday(as);
    await markEach(l, {
      routineId,
      from: "2026-03-01",
      to: "2026-03-05",
      outcome: "done",
    });
    await closeEach(l, "2026-03-01", "2026-03-09");

    await as.mutation(api.marks.append, {
      date: "2026-03-10",
      routineId,
      outcome: "skipped",
    });
    const held = await as.query(api.balance.current, {});
    expect(held.balance).toBe(1);
    expect(held.held).toBe(1);
    expect(held.available).toBe(0);

    await as.mutation(api.marks.append, {
      date: "2026-03-10",
      routineId,
      outcome: null,
    });
    const released = await as.query(api.balance.current, {});
    expect(released.held).toBe(0);
    expect(released.available).toBe(1);
  });

  test("the deduction is real only at close", async () => {
    const l = await ledger("2026-03-01");
    const { as } = l;
    const { routineId } = await as.mutation(api.routines.create, {
      name: "Run",
      dowMask: EVERY_DAY,
    });

    atDate("2026-03-10");
    await sweepToToday(as);
    await markEach(l, {
      routineId,
      from: "2026-03-01",
      to: "2026-03-05",
      outcome: "done",
    });
    await closeEach(l, "2026-03-01", "2026-03-09");

    await as.mutation(api.marks.append, {
      date: "2026-03-10",
      routineId,
      outcome: "skipped",
    });
    await as.mutation(api.days.close, { date: "2026-03-10" });

    const spent = await as.query(api.balance.current, {});
    expect(spent.spent).toBe(1);
    expect(spent.held).toBe(0);
    expect(spent.balance).toBe(0);
  });

  test("a correction outside the horizon moves a rate and leaves the balance alone", async () => {
    const l = await ledger("2026-01-15");
    const { as } = l;
    const { routineId } = await as.mutation(api.routines.create, {
      name: "Run",
      dowMask: EVERY_DAY,
    });

    atDate("2026-03-30");
    await sweepToToday(as);
    await as.mutation(api.days.close, { date: "2026-01-20" });

    const before = await as.query(api.balance.current, {});
    const rateBefore = await as.query(api.rates.window, {
      from: "2026-01-01",
      to: "2026-01-31",
    });
    expect(rateBefore.rate).toBe(0);

    // Month fourteen: they did do the run, they just forgot to mark it.
    await as.mutation(api.marks.append, {
      date: "2026-01-20",
      routineId,
      outcome: "done",
    });

    const after = await as.query(api.balance.current, {});
    const rateAfter = await as.query(api.rates.window, {
      from: "2026-01-01",
      to: "2026-01-31",
    });

    expect(rateAfter.rate).toBe(1);
    expect(after.balance).toBe(before.balance);
    expect(after.minted).toBe(before.minted);
    expect(after.spent).toBe(before.spent);
  });

  test("correcting a missed day inside the horizon re-earns its skip", async () => {
    const l = await ledger("2026-03-01");
    const { as } = l;
    const { routineId } = await as.mutation(api.routines.create, {
      name: "Run",
      dowMask: EVERY_DAY,
    });

    atDate("2026-03-10");
    await sweepToToday(as);
    await markEach(l, {
      routineId,
      from: "2026-03-01",
      to: "2026-03-04",
      outcome: "done",
    });
    await closeEach(l, "2026-03-01", "2026-03-09");

    expect((await as.query(api.balance.current, {})).balance).toBe(0);

    await as.mutation(api.marks.append, {
      date: "2026-03-05",
      routineId,
      outcome: "done",
    });

    expect((await as.query(api.balance.current, {})).balance).toBe(1);
  });
});

describe("the retirement counter", () => {
  test("counts consecutive scheduled misses and offers retirement at close", async () => {
    const l = await ledger("2026-03-01");
    const { as } = l;
    const { routineId } = await as.mutation(api.routines.create, {
      name: "Run",
      dowMask: EVERY_DAY,
    });

    atDate(`2026-03-0${RETIREMENT_THRESHOLD + 1}`);
    await sweepToToday(as);

    let lastClose;
    for (const date of datesBetween("2026-03-01", `2026-03-0${RETIREMENT_THRESHOLD}`)) {
      lastClose = await as.mutation(api.days.close, { date });
    }

    const counter = await as.query(api.routines.retirementCounter, { routineId });
    expect(counter.consecutive).toBe(RETIREMENT_THRESHOLD);
    expect(counter.suggestRetirement).toBe(true);
    expect(lastClose!.suggestions).toEqual([{ routineId, consecutive: RETIREMENT_THRESHOLD }]);
  });

  test("steps over paused days rather than resetting on them", async () => {
    const l = await ledger("2026-03-01");
    const { as } = l;
    const { routineId } = await as.mutation(api.routines.create, {
      name: "Run",
      dowMask: EVERY_DAY,
    });

    atDate("2026-03-03");
    await sweepToToday(as);
    await closeEach(l, "2026-03-01", "2026-03-03");

    // Pausing on the third takes effect on the fourth.
    await as.mutation(api.schedules.set, { routineId, dowMask: 0 });
    atDate("2026-03-08");
    await sweepToToday(as);
    await closeEach(l, "2026-03-04", "2026-03-08");

    // No Instance exists for the paused days, so the run of misses is unbroken.
    const counter = await as.query(api.routines.retirementCounter, { routineId });
    expect(counter.consecutive).toBe(3);
  });
});

describe("the eager scope rule", () => {
  test("an oversized repair fails rather than doing part of the work", async () => {
    const { as } = await ledger("2026-03-01");
    await expect(
      as.mutation(api.repair.range, { from: "2026-01-01", to: "2026-03-01" }),
    ).rejects.toThrow(/over the eager limit/u);
  });
});
