import { datesBetween } from "#domain/date";
import { EVERY_DAY } from "#domain/schedule";

import type { Id } from "./_generated/dataModel";

import { api, internal } from "./_generated/api";
import { atDate, bankSkips, initConvexTest, realTime, signIn, sweepToToday } from "./setup.spec";

type Ledger = Awaited<ReturnType<typeof fixture>>;

/** A week of marked and closed days, two routines, plus one open day. */
async function fixture() {
  const t = initConvexTest();
  const as = await signIn(t);
  // The skip below is a purchase, so the ledger opens with one banked. Its days
  // sit in February, outside every window this file verifies.
  const bank = await bankSkips(as, { count: 1, before: "2026-03-01" });

  atDate("2026-03-01");
  const { routineId } = await as.mutation(api.routines.create, {
    name: "Run",
    dowMask: EVERY_DAY,
  });
  const second = await as.mutation(api.routines.create, {
    name: "Read",
    dowMask: EVERY_DAY,
  });

  atDate("2026-03-08");
  await sweepToToday(as);
  for (const date of datesBetween("2026-03-01", "2026-03-05")) {
    await as.mutation(api.marks.append, { date, routineId, outcome: "done" });
  }
  await as.mutation(api.marks.append, {
    date: "2026-03-03",
    routineId: second.routineId,
    outcome: "skipped",
  });
  for (const date of datesBetween("2026-03-01", "2026-03-07")) {
    await as.mutation(api.days.close, { date });
  }

  return { t, as, routineId, secondId: second.routineId, bank };
}

function verifyMarch({ as }: Ledger) {
  return as.action(api.verify.run, { from: "2026-03-01", to: "2026-03-31" });
}

async function ownerIdOf({ as }: Ledger) {
  return (await as.query(api.owners.current, {}))!.ownerId;
}

/**
 * Verification exists to catch a fact written out of band, so these helpers
 * write out of band on purpose: straight to the table, past every wrapper and
 * past the resolver.
 */
function forgeOutcome(
  { t }: Ledger,
  date: string,
  outcome: "done" | "skipped" | "missed",
): Promise<Id<"instances">> {
  return t.run(async (ctx) => {
    const rows = await ctx.db.query("instances").collect();
    const instance = rows.find((row) => row.date === date)!;
    await ctx.db.patch(instance._id, { outcome });
    return instance._id;
  });
}

async function forgeDayStats({ t }: Ledger, date: string, done: number) {
  await t.run(async (ctx) => {
    const rows = await ctx.db.query("dayStats").collect();
    await ctx.db.patch(rows.find((row) => row.date === date)!._id, { done });
  });
}

/** Undoes one Instance's seal, which is what a faulty close would leave behind. */
async function forgeUnseal({ t }: Ledger, date: string) {
  await t.run(async (ctx) => {
    const rows = await ctx.db.query("instances").collect();
    await ctx.db.patch(rows.find((row) => row.date === date)!._id, { closedAt: null });
  });
}

async function dropInstance({ t }: Ledger, date: string) {
  await t.run(async (ctx) => {
    const rows = await ctx.db.query("instances").collect();
    await ctx.db.delete(rows.find((row) => row.date === date)!._id);
  });
}

async function dropEveryDayStat({ t }: Ledger) {
  await t.run(async (ctx) => {
    const rows = await ctx.db.query("dayStats").collect();
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
  });
}

function readInstance({ t }: Ledger, id: Id<"instances">) {
  return t.run((ctx) => ctx.db.get(id));
}

function dayStatRows({ t }: Ledger) {
  return t.run((ctx) => ctx.db.query("dayStats").withIndex("by_owner_date").collect());
}

async function batchRunRow({ t }: Ledger, runId: string) {
  const rows = await t.run((ctx) => ctx.db.query("batchRuns").collect());
  return rows.find((row) => row.runId === runId);
}

afterEach(() => {
  realTime();
});

describe("verification", () => {
  it("reports nothing on a ledger written by the normal path", async () => {
    const l = await fixture();
    const report = await verifyMarch(l);
    expect(report.findings).toEqual([]);
    expect(report.runId).toBeTruthy();
  });

  it("names the day and the mark when an outcome disagrees with the marks", async () => {
    const l = await fixture();
    await forgeOutcome(l, "2026-03-02", "missed");

    const report = await verifyMarch(l);
    const finding = report.findings.find((line) => line.startsWith("instance-from-marks"));

    expect(finding).toMatch(/2026-03-02/u);
    expect(finding).toMatch(/expected \{done, /u);
    expect(finding).toMatch(/found \{missed, /u);

    // The printed command is the repair path, so it has to be one the mutation
    // accepts: Convex rejects an unexpected argument.
    expect(finding).toMatch(/-> repair\.range\(\{ from: "2026-03-02", to: "2026-03-02" \}\)$/u);

    // The run that found it is named by the row that stores the findings.
    expect((await batchRunRow(l, report.runId))?.findings).toContain(finding);
  });

  it("never repairs what it finds", async () => {
    const l = await fixture();
    const corrupted = await forgeOutcome(l, "2026-03-02", "missed");

    await verifyMarch(l);
    await verifyMarch(l);

    expect((await readInstance(l, corrupted))!.outcome).toBe("missed");
  });

  it("catches a projection that disagrees with the instances", async () => {
    const l = await fixture();
    await forgeDayStats(l, "2026-03-04", 99);

    const report = await verifyMarch(l);
    expect(report.findings.find((line) => line.startsWith("dayStats-from-instances"))).toMatch(
      /found \{scheduled 2, done 99/u,
    );
  });

  it("catches a hole where the schedule log places an instance", async () => {
    const l = await fixture();
    await dropInstance(l, "2026-03-08");

    const report = await verifyMarch(l);
    expect(report.findings.find((line) => line.startsWith("instances-from-schedule"))).toMatch(
      /no Instance is pinned/u,
    );
  });

  it("reports a sweep watermark that lags behind today", async () => {
    const l = await fixture();
    atDate("2026-03-20");

    const report = await verifyMarch(l);
    expect(report.findings.find((line) => line.startsWith("sweep-watermark"))).toMatch(
      /pinned through 2026-03-08 but today is 2026-03-20/u,
    );

    await sweepToToday(l.as);
    expect((await verifyMarch(l)).findings).toEqual([]);
  });

  it("catches an unsettled instance inside a closed day", async () => {
    const l = await fixture();
    await forgeUnseal(l, "2026-03-04");

    const finding = (await verifyMarch(l)).findings.find((line) =>
      line.startsWith("instance-seal"),
    );

    expect(finding).toMatch(/2026-03-04/u);
    expect(finding).toMatch(/unsettled inside a day closed at/u);
  });

  it("prints the date of the last full verify", async () => {
    const l = await fixture();
    const first = await verifyMarch(l);
    expect(first.lastFullVerify).toBeNull();

    const second = await verifyMarch(l);
    expect(second.lastFullVerify).not.toBeNull();

    const last = await l.as.query(api.verify.lastRun, {});
    expect(last!.runId).toBe(second.runId);
  });
});

describe("repair", () => {
  it("fixes what verification found, and is a no-op the second time", async () => {
    const l = await fixture();
    await forgeOutcome(l, "2026-03-02", "missed");

    await l.as.mutation(api.repair.range, { from: "2026-03-02", to: "2026-03-02" });
    expect((await verifyMarch(l)).findings).toEqual([]);

    const recounted = await l.as.query(api.rates.recount, {
      from: "2026-03-01",
      to: "2026-03-08",
    });
    expect(recounted.agrees).toBe(true);

    const first = await l.as.query(api.days.get, { date: "2026-03-02" });
    await l.as.mutation(api.repair.range, { from: "2026-03-02", to: "2026-03-02" });
    const second = await l.as.query(api.days.get, { date: "2026-03-02" });

    expect(second.stats!.digest).toBe(first.stats!.digest);
    expect(second.roster).toEqual(first.roster);
  });

  it("seals what it restores into a closed day", async () => {
    const l = await fixture();
    await dropInstance(l, "2026-03-04");

    await l.as.mutation(api.repair.range, { from: "2026-03-04", to: "2026-03-04" });

    // Unsealed, the restored Instance would be folded as missed by the
    // projection and counted as pending by the aggregates.
    const day = await l.as.query(api.days.get, { date: "2026-03-04" });
    expect(day.roster).toHaveLength(2);
    expect(day.roster.map((entry) => entry.settled)).toEqual([true, true]);
    expect((await verifyMarch(l)).findings).toEqual([]);
  });

  it("re-seals an instance a faulty close left unsettled", async () => {
    const l = await fixture();
    await forgeUnseal(l, "2026-03-04");

    await l.as.mutation(api.repair.range, { from: "2026-03-04", to: "2026-03-04" });

    expect((await verifyMarch(l)).findings).toEqual([]);
  });

  it("refills a hole left by a write path that skipped the sweep", async () => {
    const l = await fixture();
    await dropInstance(l, "2026-03-08");

    await l.as.mutation(api.repair.range, { from: "2026-03-08", to: "2026-03-08" });

    expect((await l.as.query(api.days.get, { date: "2026-03-08" })).roster).toHaveLength(2);
    expect((await verifyMarch(l)).findings).toEqual([]);
  });
});

describe("the batch path", () => {
  it("moves the cursor inside the chunk's transaction and resumes", async () => {
    const l = await fixture();
    const started = await l.as.mutation(api.repair.start, {
      from: "2026-01-15",
      to: "2026-03-08",
      reason: "backfill",
    });
    expect(started.chunkCount).toBe(3);

    const midRun = await l.as.query(api.repair.inFlight, {});
    expect(midRun[0]).toMatchObject({ runId: started.runId, reason: "backfill" });

    await l.t.finishAllScheduledFunctions(() => {});

    await expect(batchRunRow(l, started.runId)).resolves.toMatchObject({
      state: "done",
      chunksDone: 3,
      appliedChunks: [0, 1, 2],
      cursor: null,
    });
    await expect(l.as.query(api.repair.inFlight, {})).resolves.toEqual([]);
  });

  it("a retry of a chunk does nothing", async () => {
    const l = await fixture();
    const started = await l.as.mutation(api.repair.start, {
      from: "2026-03-01",
      to: "2026-03-08",
      reason: "backfill",
    });
    await l.t.finishAllScheduledFunctions(() => {});

    const before = await dayStatRows(l);
    const ownerId = await ownerIdOf(l);

    await l.t.mutation(internal.repair.runChunk, { ownerId, runId: started.runId });
    await l.t.mutation(internal.repair.runChunk, { ownerId, runId: started.runId });

    const after = await dayStatRows(l);
    expect(after.map((row) => row.digest)).toEqual(before.map((row) => row.digest));
  });
});

describe("rebuild equivalence", () => {
  it("digests match byte for byte after every projection is deleted", async () => {
    const l = await fixture();

    const before = await dayStatRows(l);
    const rateBefore = await l.as.query(api.rates.window, {
      from: "2026-03-01",
      to: "2026-03-08",
    });

    await dropEveryDayStat(l);
    // Every row is dropped, so every row is rebuilt: the banked days are as
    // much of the ledger as the week under test.
    await l.as.mutation(api.rebuild.dayStats, { from: l.bank.from, to: "2026-03-08" });
    await l.as.mutation(api.rebuild.aggregates, {});

    const after = await dayStatRows(l);
    const rateAfter = await l.as.query(api.rates.window, {
      from: "2026-03-01",
      to: "2026-03-08",
    });

    const shape = (rows: typeof before) =>
      rows.map((row) => ({
        date: row.date,
        scheduled: row.scheduled,
        done: row.done,
        skipped: row.skipped,
        missed: row.missed,
        closed: row.closed,
        digest: row.digest,
        sourceRev: row.sourceRev,
      }));

    expect(shape(after)).toEqual(shape(before));
    expect(rateAfter.counts).toEqual(rateBefore.counts);
    expect((await verifyMarch(l)).findings).toEqual([]);
  });
});
