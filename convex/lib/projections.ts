import type { LocalDate } from "#domain/date";

import { foldDay } from "#domain/dayStats";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

import { findDay } from "./days";
import { instancesOn } from "./instances";

/**
 * Repair is eager and atomic: a close or a correction rewrites every affected
 * projection inside the same mutation, and the write returns only when its
 * numbers are current. There is no lazy repair, no read-through repair, no
 * queue and no background worker.
 *
 * Only settled Instances count, so a mark on an open day writes no row at all.
 */
export async function rewriteDayStats(
  ctx: MutationCtx,
  ownerId: Id<"owners">,
  date: LocalDate,
): Promise<Doc<"dayStats"> | null> {
  const day = await findDay(ctx, ownerId, date);
  const existing = await findDayStats(ctx, ownerId, date);

  if (!day || day.closedAt === null) {
    if (existing) await ctx.db.delete(existing._id);
    return null;
  }

  const instances = await instancesOn(ctx, ownerId, date);
  const fold = foldDay(date, instances, true);
  const row = { ownerId, date, ...fold, sourceRev: day.rev };

  if (existing) {
    await ctx.db.patch(existing._id, row);
    return (await ctx.db.get(existing._id))!;
  }
  const id = await ctx.db.insert("dayStats", row);
  return (await ctx.db.get(id))!;
}

export function findDayStats(
  ctx: QueryCtx | MutationCtx,
  ownerId: Id<"owners">,
  date: LocalDate,
): Promise<Doc<"dayStats"> | null> {
  return ctx.db
    .query("dayStats")
    .withIndex("by_owner_date", (q) => q.eq("ownerId", ownerId).eq("date", date))
    .unique();
}

export function dayStatsBetween(
  ctx: QueryCtx | MutationCtx,
  ownerId: Id<"owners">,
  from: LocalDate,
  to: LocalDate,
): Promise<Doc<"dayStats">[]> {
  return ctx.db
    .query("dayStats")
    .withIndex("by_owner_date", (q) => q.eq("ownerId", ownerId).gte("date", from).lte("date", to))
    .collect();
}
