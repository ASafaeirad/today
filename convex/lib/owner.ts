import { addDays, localDateOf, type LocalDate } from "#domain/date";

import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

import { initNamespace } from "./aggregates";
import { requireUserId } from "./auth";

export async function findOwner(ctx: QueryCtx | MutationCtx): Promise<Doc<"owners"> | null> {
  const userId = await requireUserId(ctx);
  return ctx.db
    .query("owners")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

export async function requireOwner(ctx: QueryCtx | MutationCtx): Promise<Doc<"owners">> {
  const owner = await findOwner(ctx);
  if (!owner) throw new Error("No owner. Call owners.ensure first.");
  return owner;
}

/**
 * The owner's timezone is frozen at creation: changing it moves only which date
 * counts as today from then on, never which date a past Instance belongs to.
 */
export function todayFor(owner: Doc<"owners">, now = Date.now()): LocalDate {
  return localDateOf(now, owner.timezone);
}

export async function ensureOwner(ctx: MutationCtx, timezone: string): Promise<Doc<"owners">> {
  const existing = await findOwner(ctx);
  if (existing) return existing;

  const userId = await requireUserId(ctx);
  const today = localDateOf(Date.now(), timezone);
  const ownerId = await ctx.db.insert("owners", {
    userId,
    timezone,
    // Yesterday, so the first mutation of the session sweeps today.
    pinsThroughDate: addDays(today, -1),
  });
  await initNamespace(ctx, ownerId);
  return (await ctx.db.get(ownerId))!;
}
