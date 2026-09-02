/// <reference types="vite/client" />

import { register as registerAggregate } from "@convex-dev/aggregate/test";
import { register as registerBatchWorker } from "@convex-dev/batch-worker/test";
import { convexTest, type TestConvex } from "convex-test";
import { test, vi } from "vite-plus/test";

import { DAYS_PER_SKIP } from "#domain/constants";
import { addDays, datesBetween } from "#domain/date";
import { EVERY_DAY } from "#domain/schedule";

import { api } from "./_generated/api";
import schema from "./schema";

export const modules = import.meta.glob("./**/*.*s");

/** The two aggregate mounts from `convex.config.ts`, plus the worker each uses. */
const AGGREGATE_NAMES = ["instancesByOwner", "instancesByRoutine"];

export function initConvexTest(): TestConvex<typeof schema> {
  const t = convexTest(schema, modules);
  for (const name of AGGREGATE_NAMES) {
    registerAggregate(t, name);
    registerBatchWorker(t, `${name}/batchWorker`);
  }
  return t;
}

/**
 * Convex Auth encodes the user id as the leading segment of the identity
 * subject, so a test identity is `${userId}|${sessionId}`.
 */
export async function signIn(t: TestConvex<typeof schema>) {
  const userId = await t.run((ctx) => ctx.db.insert("users", { name: "Owner" }));
  return t.withIdentity({ subject: `${userId}|test-session` });
}

/**
 * Drives `owners.sweep` to today. The sweep pins a bounded chunk per call, so a
 * fixture spanning more than a month needs the loop a client would run.
 */
export async function sweepToToday(as: Awaited<ReturnType<typeof signIn>>) {
  let result = await as.mutation(api.owners.sweep, {});
  while (!result.caughtUp) result = await as.mutation(api.owners.sweep, {});
  return result;
}

/**
 * Only `Date` is faked, so the scheduler's own timers stay real and a
 * continuation still runs.
 */
export function atDate(date: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${date}T12:00:00Z`));
}

export function realTime() {
  vi.useRealTimers();
}

/**
 * Banks `count` skips, the way an owner has to. A skip is bought and not
 * merely declared, so a fixture that marks one has to mint it first or the
 * write is refused.
 *
 * The bank is a routine of its own over the `DAYS_PER_SKIP` all-done days each
 * skip costs, ending the day before `before`, and it is retired on its last
 * day so it places nothing into the ledger under test. Call it first, before
 * the fixture's own routines exist: a day is all-done only when everything
 * scheduled on it is done, so a routine already running over these dates would
 * mint nothing. Those dates have to sit inside the horizon of the date the
 * fixture spends at, or the mint ages out before it can be spent.
 */
export async function bankSkips(
  as: Awaited<ReturnType<typeof signIn>>,
  input: { count: number; before: string },
) {
  const dates = datesBetween(
    addDays(input.before, -(input.count * DAYS_PER_SKIP)),
    addDays(input.before, -1),
  );
  const last = dates.at(-1)!;

  atDate(dates[0]!);
  // The owner is created here rather than by the caller: the sweep watermark
  // starts the day before the owner does and only ever moves forward, so an
  // owner created after these dates could never have Instances on them.
  await as.mutation(api.owners.ensure, { timezone: "UTC" });
  const { routineId } = await as.mutation(api.routines.create, {
    name: "Bank",
    dowMask: EVERY_DAY,
  });

  atDate(last);
  await sweepToToday(as);
  for (const date of dates) {
    await as.mutation(api.marks.append, { date, routineId, outcome: "done" });
  }

  // Closed at today, so the last banked date still places and nothing after it does.
  await as.mutation(api.schedules.retire, { routineId });
  for (const date of dates) {
    await as.mutation(api.days.close, { date });
  }

  return { routineId, from: dates[0]!, to: last };
}

test("setup", () => {});
