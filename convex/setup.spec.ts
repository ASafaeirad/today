/// <reference types="vite/client" />

import { register as registerAggregate } from "@convex-dev/aggregate/test";
import { register as registerBatchWorker } from "@convex-dev/batch-worker/test";
import { convexTest, type TestConvex } from "convex-test";
import { test, vi } from "vite-plus/test";

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

test("setup", () => {});
