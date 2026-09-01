import type { LocalDate } from "#domain/date";
import { resolveOutcome, type Resolution } from "#domain/outcome";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

import { aggregateDelete, aggregateInsert, aggregateReplace } from "./aggregates";

export type MarkId = Id<"marks">;

export interface Cell {
  ownerId: Id<"owners">;
  date: LocalDate;
  routineId: Id<"routines">;
}

export function marksForCell(ctx: QueryCtx | MutationCtx, cell: Cell): Promise<Doc<"marks">[]> {
  return ctx.db
    .query("marks")
    .withIndex("by_owner_date_routine_serverAt", (q) =>
      q.eq("ownerId", cell.ownerId).eq("date", cell.date).eq("routineId", cell.routineId),
    )
    .collect();
}

/**
 * Resolve a cell without writing. Verification calls exactly this and compares
 * the whole tuple, so the hot path and a rebuild cannot pick different winners.
 */
export async function resolveCell(
  ctx: QueryCtx | MutationCtx,
  cell: Cell,
  nextDayRev: number,
): Promise<Resolution<MarkId>> {
  return resolveOutcome(await marksForCell(ctx, cell), nextDayRev);
}

export function findInstance(
  ctx: QueryCtx | MutationCtx,
  cell: Cell,
): Promise<Doc<"instances"> | null> {
  return ctx.db
    .query("instances")
    .withIndex("by_owner_routine_date", (q) =>
      q.eq("ownerId", cell.ownerId).eq("routineId", cell.routineId).eq("date", cell.date),
    )
    .unique();
}

export function instancesOn(
  ctx: QueryCtx | MutationCtx,
  ownerId: Id<"owners">,
  date: LocalDate,
): Promise<Doc<"instances">[]> {
  return ctx.db
    .query("instances")
    .withIndex("by_owner_date", (q) => q.eq("ownerId", ownerId).eq("date", date))
    .collect();
}

export function instancesBetween(
  ctx: QueryCtx | MutationCtx,
  ownerId: Id<"owners">,
  from: LocalDate,
  to: LocalDate,
): Promise<Doc<"instances">[]> {
  return ctx.db
    .query("instances")
    .withIndex("by_owner_date", (q) => q.eq("ownerId", ownerId).gte("date", from).lte("date", to))
    .collect();
}

/**
 * Place the Instance a schedule version puts on a date. The outcome triple is
 * written by the resolver here too: with no Marks yet it resolves to `missed`
 * with a null citation, which is explicit and falsifiable.
 */
export async function placeInstance(
  ctx: MutationCtx,
  input: Cell & {
    scheduleVersionId: Id<"scheduleVersions">;
    dayRev: number;
    tolerateDrift?: boolean;
  },
): Promise<Doc<"instances">> {
  const resolution = await resolveCell(ctx, input, input.dayRev);
  const id = await ctx.db.insert("instances", {
    ownerId: input.ownerId,
    date: input.date,
    routineId: input.routineId,
    scheduleVersionId: input.scheduleVersionId,
    closedAt: null,
    ...resolution,
  });
  const doc = (await ctx.db.get(id))!;
  await aggregateInsert(ctx, doc, input.tolerateDrift);
  return doc;
}

/**
 * The one writer of `outcome`, `resolvedFromMarkId` and `outcomeRev`. They are
 * one claim, written together or not at all: no caller gets a narrower API that
 * can set only the outcome. Confirm by grep that nothing else patches them.
 *
 * `closedAt` is the seal, written once at close and never changed.
 */
export async function applyResolution(
  ctx: MutationCtx,
  instance: Doc<"instances">,
  resolution: Resolution<MarkId>,
  options: { seal?: number; tolerateDrift?: boolean } = {},
): Promise<Doc<"instances">> {
  const closedAt = instance.closedAt ?? options.seal ?? null;
  await ctx.db.patch(instance._id, { ...resolution, closedAt });
  const updated = (await ctx.db.get(instance._id))!;
  await aggregateReplace(ctx, instance, updated, options.tolerateDrift);
  return updated;
}

/** Used only by repair, when the schedule log says a placement never existed. */
export async function removeInstance(
  ctx: MutationCtx,
  instance: Doc<"instances">,
  tolerateDrift = false,
): Promise<void> {
  await ctx.db.delete(instance._id);
  await aggregateDelete(ctx, instance, tolerateDrift);
}
