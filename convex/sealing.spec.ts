import { afterEach, expect, test } from "vite-plus/test";

import { EVERY_DAY } from "#domain/schedule";

import { api } from "./_generated/api";
import { atDate, initConvexTest, realTime, signIn } from "./setup.spec";

afterEach(realTime);

async function fixture() {
  atDate("2026-09-11");
  const as = await signIn(initConvexTest());
  await as.mutation(api.owners.ensure, { timezone: "UTC" });
  const { routineId } = await as.mutation(api.routines.create, {
    name: "Read",
    dowMask: EVERY_DAY,
  });
  return { as, routineId, date: "2026-09-11" };
}

test("sealing requires an explicit outcome, including after an unset", async () => {
  const { as, routineId, date } = await fixture();
  let day = await as.query(api.days.get, { date });
  await expect(
    as.mutation(api.days.close, { date, seal: true, expectedRev: day.rev }),
  ).rejects.toThrow("every routine");
  await as.mutation(api.marks.append, { date, routineId, outcome: "done" });
  await as.mutation(api.marks.append, { date, routineId, outcome: null });
  day = await as.query(api.days.get, { date });
  expect(day.roster[0]?.marked).toBe(false);
  await expect(
    as.mutation(api.days.close, { date, seal: true, expectedRev: day.rev }),
  ).rejects.toThrow("every routine");
  expect((await as.query(api.days.get, { date })).closedAt).toBeNull();
});

test("sealing checks the reviewed revision and permanently keeps outcomes and note", async () => {
  const { as, routineId, date } = await fixture();
  await as.mutation(api.marks.append, { date, routineId, outcome: "done" });
  const reviewed = await as.query(api.days.get, { date });
  await as.mutation(api.marks.append, { date, routineId, outcome: "missed" });
  await expect(
    as.mutation(api.days.close, { date, seal: true, expectedRev: reviewed.rev }),
  ).rejects.toThrow("changed");
  const current = await as.query(api.days.get, { date });
  await as.mutation(api.days.close, {
    date,
    seal: true,
    expectedRev: current.rev,
    closingNote: "Try earlier tomorrow.",
  });
  await expect(as.mutation(api.marks.append, { date, routineId, outcome: "done" })).rejects.toThrow(
    "permanent",
  );
  await as.mutation(api.days.close, {
    date,
    seal: true,
    expectedRev: current.rev,
    closingNote: "Replacement",
  });
  const sealed = await as.query(api.days.get, { date });
  expect(sealed.sealed).toBe(true);
  expect(sealed.closingNote).toBe("Try earlier tomorrow.");
  expect(sealed.roster[0]?.outcome).toBe("missed");
});

test("past days remain editable and appear in the backlog until sealed", async () => {
  const { as, routineId, date } = await fixture();
  atDate("2026-09-15");
  await as.mutation(api.owners.sweep, {});
  expect(await as.query(api.days.backlog, {})).toContain(date);
  await as.mutation(api.marks.append, { date, routineId, outcome: "missed" });
  const day = await as.query(api.days.get, { date });
  await as.mutation(api.days.close, { date, seal: true, expectedRev: day.rev });
  expect(await as.query(api.days.backlog, {})).not.toContain(date);
});

test("creating a routine after sealing today starts it tomorrow", async () => {
  const { as, routineId, date } = await fixture();
  await as.mutation(api.marks.append, { date, routineId, outcome: "done" });
  const reviewed = await as.query(api.days.get, { date });
  await as.mutation(api.days.close, { date, seal: true, expectedRev: reviewed.rev });
  await as.mutation(api.routines.create, { name: "Walk", dowMask: EVERY_DAY });
  const sealed = await as.query(api.days.get, { date });
  expect(sealed.roster).toHaveLength(1);
  atDate("2026-09-12");
  await as.mutation(api.owners.sweep, {});
  expect((await as.query(api.days.get, { date: "2026-09-12" })).roster).toHaveLength(2);
});
