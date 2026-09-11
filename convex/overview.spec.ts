import { afterEach, expect, test } from "vite-plus/test";

import { MAX_EAGER_DAYS } from "#domain/constants";
import { addDays, datesBetween } from "#domain/date";
import { EVERY_DAY } from "#domain/schedule";

import { api } from "./_generated/api";
import { atDate, initConvexTest, realTime, signIn, sweepToToday } from "./setup.spec";

afterEach(realTime);

async function fixture(documentsReadLimit?: number) {
  atDate("2026-09-09");
  const as = await signIn(initConvexTest(documentsReadLimit));
  await as.mutation(api.owners.ensure, { timezone: "UTC" });
  const { routineId } = await as.mutation(api.routines.create, {
    name: "Read",
    dowMask: EVERY_DAY,
  });
  atDate("2026-09-11");
  await sweepToToday(as);
  return { as, routineId };
}

test("overview counts a cell under its outcome only once it is marked or settled", async () => {
  const { as, routineId } = await fixture();

  await as.mutation(api.marks.append, { date: "2026-09-10", routineId, outcome: "done" });
  const reviewed = await as.query(api.days.get, { date: "2026-09-10" });
  await as.mutation(api.days.close, {
    date: "2026-09-10",
    seal: true,
    expectedRev: reviewed.rev,
    closingNote: "Fine.",
  });
  // A mark followed by an Unset leaves the cell open again.
  await as.mutation(api.marks.append, { date: "2026-09-11", routineId, outcome: "done" });
  await as.mutation(api.marks.append, { date: "2026-09-11", routineId, outcome: null });

  const rows = await as.query(api.days.overview, {
    dates: ["2026-09-11", "2026-09-10", "2026-09-09", "2026-09-08"],
  });

  expect(rows.map((row) => row.date)).toEqual([
    "2026-09-11",
    "2026-09-10",
    "2026-09-09",
    "2026-09-08",
  ]);
  expect(rows[0]).toMatchObject({ scheduled: 1, open: 1, done: 0, state: "open", sealed: false });
  expect(rows[1]).toMatchObject({ scheduled: 1, open: 0, done: 1, state: "closed", sealed: true });
  expect(rows[1]?.closedAt).not.toBeNull();
  expect(rows[2]).toMatchObject({ scheduled: 1, open: 1, state: "awaitingReview", sealed: false });
  // Before the owner existed: nothing was scheduled, so nothing is owed.
  expect(rows[3]).toMatchObject({ scheduled: 0, open: 0 });
});

test("a legacy close settles every cell without a mark as missed", async () => {
  const { as } = await fixture();
  await as.mutation(api.days.close, { date: "2026-09-09" });

  const [row] = await as.query(api.days.overview, { dates: ["2026-09-09"] });
  expect(row).toMatchObject({ scheduled: 1, open: 0, missed: 1, state: "closed", sealed: false });
});

test("overview is bounded like every eager read", async () => {
  const { as } = await fixture();
  expect(await as.query(api.days.overview, { dates: [] })).toEqual([]);
  const tooMany = datesBetween(addDays("2026-09-11", -MAX_EAGER_DAYS), "2026-09-11");
  await expect(as.query(api.days.overview, { dates: tooMany })).rejects.toThrow("limit");
});

test("overview does not scan days between sparse requested dates", async () => {
  const { as } = await fixture(100);
  const dates = ["2026-09-11", "1900-01-01", "2026-09-11"];

  await as.run(async (ctx) => {
    const owner = await ctx.db.query("owners").unique();
    for (const date of datesBetween("2026-05-01", "2026-08-31")) {
      await ctx.db.insert("days", {
        ownerId: owner!._id,
        date,
        closedAt: null,
        rev: 0,
        closeKey: null,
      });
    }
  });

  const rows = await as.query(api.days.overview, { dates });

  expect(rows.map((row) => row.date)).toEqual(dates);
  expect(rows[0]).toMatchObject({ scheduled: 1, open: 1 });
  expect(rows[1]).toMatchObject({ scheduled: 0, open: 0 });
  expect(rows[2]).toEqual(rows[0]);
});
