import { CLOSING_EXPERIENCE } from "#domain/constants";
import { closingExperience, levelThreshold } from "#domain/experience";
import { EVERY_DAY } from "#domain/schedule";

import { api } from "./_generated/api";
import { atDate, initConvexTest, realTime, signIn, sweepToToday } from "./setup.spec";

afterEach(realTime);

type Ledger = Awaited<ReturnType<typeof ledger>>;

/**
 * An owner with two daily routines, opened a week ago, so every date from the
 * 5th to today carries a roster.
 */
async function ledger(today = "2026-09-11") {
  atDate("2026-09-05");
  const as = await signIn(initConvexTest());
  await as.mutation(api.owners.ensure, { timezone: "UTC" });
  const routines = [];
  for (const name of ["Read", "Walk"]) {
    routines.push((await as.mutation(api.routines.create, { name, dowMask: EVERY_DAY })).routineId);
  }
  atDate(today);
  await sweepToToday(as);
  return { as, routines, today };
}

async function markAll(l: Ledger, date: string, outcomes: ("done" | "missed" | "skipped")[]) {
  for (const [index, outcome] of outcomes.entries()) {
    await l.as.mutation(api.marks.append, { date, routineId: l.routines[index]!, outcome });
  }
}

async function close(l: Ledger, date: string) {
  const day = await l.as.query(api.days.get, { date });
  return l.as.mutation(api.days.close, { date, seal: true, expectedRev: day.rev });
}

/** Marks every line done and seals, which is the shape of a clean day. */
async function cleanDay(l: Ledger, date: string) {
  await markAll(l, date, ["done", "done"]);
  return close(l, date);
}

function progression(l: Ledger) {
  return l.as.query(api.experience.progression, {});
}

it("banks one per done mark plus the multiplied closing reward", async () => {
  const l = await ledger();
  const { receipt } = await cleanDay(l, "2026-09-05");

  expect(receipt.doneExperience).toBe(2);
  expect(receipt.baseExperience).toBe(CLOSING_EXPERIENCE);
  expect(receipt.streak).toBe(1);
  expect(receipt.total).toBe(2 + closingExperience(1));
  expect((await progression(l)).experience).toBe(2 + closingExperience(1));
});

it("banks nothing for a day the schedule put nothing on", async () => {
  const l = await ledger();
  const { receipt } = await l.as.mutation(api.days.close, { date: "2026-09-04" });

  expect(receipt.eligible).toBe(false);
  expect(receipt.total).toBe(0);
  expect((await progression(l)).experience).toBe(0);
  expect((await progression(l)).streak).toBe(0);
});

it("keeps the base on a day with misses, and resets the run", async () => {
  const l = await ledger();
  await cleanDay(l, "2026-09-05");
  await markAll(l, "2026-09-06", ["done", "missed"]);
  const { receipt } = await close(l, "2026-09-06");

  expect(receipt.streak).toBe(0);
  expect(receipt.multiplier).toBe(1);
  expect(receipt.reset).toBe(true);
  expect(receipt.total).toBe(1 + CLOSING_EXPERIENCE);
});

it("keeps the run through a skipped outcome", async () => {
  const l = await ledger();
  await cleanDay(l, "2026-09-05");
  await cleanDay(l, "2026-09-06");
  // The fifth all-done day of the horizon mints the skip this spends.
  await cleanDay(l, "2026-09-07");
  await cleanDay(l, "2026-09-08");
  await cleanDay(l, "2026-09-09");
  await markAll(l, "2026-09-10", ["done", "skipped"]);
  const { receipt } = await close(l, "2026-09-10");

  expect(receipt.streak).toBe(6);
  expect(receipt.doneExperience).toBe(1);
});

it("banks nothing when the same day is closed again", async () => {
  const l = await ledger();
  await cleanDay(l, "2026-09-05");
  const before = (await progression(l)).experience;

  const again = await l.as.mutation(api.days.close, { date: "2026-09-05" });
  expect(again.receipt.total).toBe(0);
  expect((await progression(l)).experience).toBe(before);
});

it("freezes an award when a closed day is amended", async () => {
  const l = await ledger();
  await markAll(l, "2026-09-05", ["done", "done"]);
  // Closed without sealing, so the day still takes an Amendment.
  await l.as.mutation(api.days.close, { date: "2026-09-05" });
  const banked = (await progression(l)).experience;

  await l.as.mutation(api.marks.append, {
    date: "2026-09-05",
    routineId: l.routines[0]!,
    outcome: "missed",
  });

  expect((await progression(l)).experience).toBe(banked);
  expect((await l.as.query(api.days.get, { date: "2026-09-05" })).award?.total).toBe(banked);
});

describe("an older day awaiting review", () => {
  it("holds the streak part of everything after it and releases it on review", async () => {
    const l = await ledger();
    await cleanDay(l, "2026-09-05");
    // 09-06 is left awaiting review, so 09-07 cannot know where the run stands.
    await cleanDay(l, "2026-09-07");

    let day = await l.as.query(api.days.get, { date: "2026-09-07" });
    expect(day.award).toMatchObject({ held: true, streakExperience: 0 });
    expect(day.award?.total).toBe(2 + CLOSING_EXPERIENCE);
    expect((await progression(l)).heldDays).toBe(1);

    const { receipt } = await cleanDay(l, "2026-09-06");
    expect(receipt.released).toBe(closingExperience(3) - CLOSING_EXPERIENCE);
    expect((await progression(l)).heldDays).toBe(0);
    expect((await progression(l)).streak).toBe(3);

    day = await l.as.query(api.days.get, { date: "2026-09-07" });
    expect(day.award).toMatchObject({ held: false, streak: 3 });
  });

  it("comes to the same total whatever order the backlog was reviewed in", async () => {
    const forwards = await ledger();
    for (const date of ["2026-09-05", "2026-09-06", "2026-09-07"]) await cleanDay(forwards, date);

    const backwards = await ledger();
    for (const date of ["2026-09-07", "2026-09-05", "2026-09-06"]) await cleanDay(backwards, date);

    expect((await progression(backwards)).experience).toBe(
      (await progression(forwards)).experience,
    );
    expect((await progression(backwards)).streak).toBe((await progression(forwards)).streak);
  });

  it("is stepped over when the schedule put nothing on it", async () => {
    const l = await ledger();
    // 09-04 predates the routines, so it is a lapse rather than a gap.
    await cleanDay(l, "2026-09-05");
    expect((await progression(l)).streak).toBe(1);
  });
});

describe("levels", () => {
  it("crosses a threshold on the close that reaches it", async () => {
    const l = await ledger();
    let levelAfter = 1;
    for (const date of ["2026-09-05", "2026-09-06"]) {
      ({
        receipt: { levelAfter },
      } = await cleanDay(l, date));
    }

    const { experience } = await progression(l);
    expect(experience).toBeGreaterThanOrEqual(levelThreshold(2));
    expect(levelAfter).toBe(2);
  });
});

describe("the backfill", () => {
  it("carries closed history in once and summarizes it", async () => {
    const l = await ledger();
    // Close three days the way a pre-progression client would have: through the
    // legacy path, which wrote no award.
    for (const date of ["2026-09-05", "2026-09-06", "2026-09-07"]) {
      await markAll(l, date, ["done", "done"]);
      await l.as.mutation(api.days.close, { date });
    }
    await l.as.run(async (ctx) => {
      for (const award of await ctx.db.query("dayAwards").collect()) await ctx.db.delete(award._id);
      for (const row of await ctx.db.query("progression").collect()) await ctx.db.delete(row._id);
    });

    let result = await l.as.mutation(api.experience.sync, {});
    while (!result.complete) result = await l.as.mutation(api.experience.sync, {});

    const after = await progression(l);
    expect(after.streak).toBe(3);
    expect(after.experience).toBe(
      3 * 2 + closingExperience(1) + closingExperience(2) + closingExperience(3),
    );
    expect(after.backfill).toEqual({ days: 3, experience: after.experience });

    // A second run banks nothing and does not re-announce what it carried in.
    await l.as.mutation(api.experience.sync, {});
    expect((await progression(l)).experience).toBe(after.experience);

    await l.as.mutation(api.experience.acknowledgeBackfill, {});
    expect((await progression(l)).backfill).toBeNull();
  });

  it("says nothing to an owner who had no closed history", async () => {
    const l = await ledger();
    await l.as.mutation(api.experience.sync, {});
    await expect(progression(l)).resolves.toMatchObject({
      backfill: null,
      caughtUp: true,
      experience: 0,
    });
  });
});

it("refolds the lifetime total from the awards that are its evidence", async () => {
  const l = await ledger();
  await cleanDay(l, "2026-09-05");
  await markAll(l, "2026-09-06", ["done", "missed"]);
  await close(l, "2026-09-06");
  await cleanDay(l, "2026-09-07");
  const banked = await progression(l);

  // The rollup is disposable; the awards are not.
  await l.as.run(async (ctx) => {
    for (const row of await ctx.db.query("progression").collect()) {
      await ctx.db.patch(row._id, { experience: 9999, streak: 42, settledThrough: null });
    }
  });
  await l.as.mutation(api.rebuild.progression, {});

  await expect(progression(l)).resolves.toMatchObject({
    experience: banked.experience,
    streak: banked.streak,
  });
});

it("keeps asking to be driven while the walk still owes a continuation", async () => {
  const l = await ledger();
  await cleanDay(l, "2026-09-05");
  // A watermark far enough behind that one pass cannot reach today.
  await l.as.run(async (ctx) => {
    for (const row of await ctx.db.query("progression").collect()) {
      await ctx.db.patch(row._id, { settledThrough: "2020-01-01", bankedThrough: "2020-01-01" });
    }
  });

  expect((await progression(l)).caughtUp).toBe(false);
  let result = await l.as.mutation(api.experience.sync, {});
  while (!result.complete) result = await l.as.mutation(api.experience.sync, {});
  expect((await progression(l)).caughtUp).toBe(true);
});
