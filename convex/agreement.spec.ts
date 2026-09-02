import { afterEach, describe, expect, test } from "vite-plus/test";

import { RATE_DOCUMENT_LIMIT } from "#domain/constants";
import { addDays, datesBetween } from "#domain/date";
import { EVERY_DAY, maskFromDays } from "#domain/schedule";

import type { Id } from "./_generated/dataModel";

import { api } from "./_generated/api";
import { atDate, initConvexTest, realTime, signIn, sweepToToday } from "./setup.spec";

/** Seeded, so a failure is reproducible rather than a story about one run. */
function generator(seed: number) {
  let state = seed >>> 0;
  return (bound: number) => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state % bound;
  };
}

const MARKS = ["done", "skipped", "missed", null] as const;

afterEach(() => {
  realTime();
});

describe("component agreement", () => {
  test("every rate answer's recount equals the component's count", async () => {
    const t = initConvexTest();
    atDate("2026-01-01");
    const as = await signIn(t);
    await as.mutation(api.owners.ensure, { timezone: "UTC" });

    const routines: Id<"routines">[] = [];
    for (const [name, mask] of [
      ["Run", EVERY_DAY],
      ["Read", maskFromDays([1, 3, 5])],
      ["Call", maskFromDays([0, 6])],
    ] as const) {
      const created = await as.mutation(api.routines.create, { name, dowMask: mask });
      routines.push(created.routineId);
    }

    const next = generator(20_260_101);
    const dates = datesBetween("2026-01-01", "2026-04-30");

    atDate("2026-05-01");
    await sweepToToday(as);

    for (const date of dates) {
      const day = await as.query(api.days.get, { date });
      for (const entry of day.roster) {
        const outcome = MARKS[next(MARKS.length)]!;
        await as.mutation(api.marks.append, {
          date,
          routineId: entry.routineId,
          outcome,
        });
      }
      // One day in five is left awaiting review, forever.
      if (next(5) !== 0) await as.mutation(api.days.close, { date });
    }

    // Windows of every shape the product asks for: a week, a month, a quarter,
    // a year, and arbitrary per-routine spans.
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const from = dates[next(dates.length)]!;
      const to = addDays(from, next(200));
      const routineId = next(2) === 0 ? undefined : routines[next(routines.length)]!;

      const recounted = await as.query(api.rates.recount, { from, to, routineId });

      expect(recounted.disagreements).toEqual([]);
      expect(recounted.agrees).toBe(true);
      expect(recounted.counts).toEqual(recounted.component);
    }
  });

  test("the receipt's excluded tallies reconcile with the instances in range", async () => {
    const t = initConvexTest();
    atDate("2026-03-01");
    const as = await signIn(t);
    await as.mutation(api.owners.ensure, { timezone: "UTC" });
    await as.mutation(api.routines.create, { name: "Run", dowMask: EVERY_DAY });

    atDate("2026-03-10");
    await sweepToToday(as);
    for (const date of datesBetween("2026-03-01", "2026-03-05")) {
      await as.mutation(api.days.close, { date });
    }

    const answer = await as.query(api.rates.window, {
      from: "2026-03-01",
      to: "2026-03-10",
    });
    const { counts, receipt } = answer;

    const inRange = await t.run((ctx) => ctx.db.query("instances").collect());
    expect(counts.done + counts.skipped + counts.missed + counts.open + counts.awaitingReview).toBe(
      inRange.filter((row) => row.date >= "2026-03-01" && row.date <= "2026-03-10").length,
    );
    expect(receipt.excluded.open).toBe(counts.open);
    expect(receipt.excluded.awaitingReview).toBe(counts.awaitingReview);
    expect(receipt.excluded.skipped).toBe(counts.skipped);
  });
});

describe("the adoption gate", () => {
  /**
   * The measurement ADR-adjacent decision rests on: a year-wide count must stay
   * inside `RATE_DOCUMENT_LIMIT` component documents. Re-run this on real data
   * before shipping, and again if it regresses. If it exceeds the limit, drop
   * the component and serve rates from `rates.recount`; the recount is already
   * written, because it is the verifier, and no schema migration is needed.
   */
  test("a year-wide count stays inside the document budget", async () => {
    const t = initConvexTest();
    atDate("2025-01-01");
    const as = await signIn(t);
    await as.mutation(api.owners.ensure, { timezone: "UTC" });

    // Roughly the 1,388 Instances the original measurement was taken over.
    for (const [name, mask] of [
      ["Run", EVERY_DAY],
      ["Stretch", EVERY_DAY],
      ["Read", maskFromDays([1, 2, 3, 4, 5])],
      ["Practice", maskFromDays([1, 3, 5])],
      ["Call", maskFromDays([0, 6])],
      ["Write", maskFromDays([2, 4])],
    ] as const) {
      await as.mutation(api.routines.create, { name, dowMask: mask });
    }

    atDate("2025-12-31");
    await sweepToToday(as);

    const instances = await t.run((ctx) => ctx.db.query("instances").collect());
    expect(instances.length).toBeGreaterThan(1_300);

    const answer = await as.query(api.rates.window, {
      from: "2025-01-01",
      to: "2025-12-31",
    });

    // eslint-disable-next-line no-console -- the measurement is the point
    console.log(
      `year-wide count over ${instances.length} Instances: ${answer.receipt.documentsRead} documents`,
    );
    expect(answer.receipt.documentsRead).toBeLessThanOrEqual(RATE_DOCUMENT_LIMIT);
    expect(answer.receipt.withinLimit).toBe(true);
    // Seeding a year of Instances outruns the default timeout.
  }, 30_000);
});
