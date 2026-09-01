import type { LocalDate } from "#domain/date";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export function findDay(
  ctx: QueryCtx | MutationCtx,
  ownerId: Id<"owners">,
  date: LocalDate,
): Promise<Doc<"days"> | null> {
  return ctx.db
    .query("days")
    .withIndex("by_owner_date", (q) => q.eq("ownerId", ownerId).eq("date", date))
    .unique();
}

export async function ensureDay(
  ctx: MutationCtx,
  ownerId: Id<"owners">,
  date: LocalDate,
): Promise<Doc<"days">> {
  const existing = await findDay(ctx, ownerId, date);
  if (existing) return existing;
  const id = await ctx.db.insert("days", {
    ownerId,
    date,
    closedAt: null,
    rev: 0,
    closeKey: null,
  });
  return (await ctx.db.get(id))!;
}

/**
 * Every resolution stamps the revision it was resolved at, so a re-tap landing
 * on the same outcome still moves the day's digest.
 */
export async function bumpRev(ctx: MutationCtx, day: Doc<"days">): Promise<number> {
  const rev = day.rev + 1;
  await ctx.db.patch(day._id, { rev });
  return rev;
}

/** The last local date the owner has closed, or null if they never have. */
export async function lastClosedDate(
  ctx: QueryCtx | MutationCtx,
  ownerId: Id<"owners">,
): Promise<LocalDate | null> {
  const rows = await ctx.db
    .query("dayStats")
    .withIndex("by_owner_date", (q) => q.eq("ownerId", ownerId))
    .order("desc")
    .take(1);
  return rows[0]?.date ?? null;
}
