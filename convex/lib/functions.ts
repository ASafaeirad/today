import { customCtx, customMutation, customQuery } from "convex-helpers/server/customFunctions";

import type { LocalDate } from "#domain/date";

import type { Doc, Id } from "../_generated/dataModel";

import { mutation, query, type MutationCtx } from "../_generated/server";
import { requireOwner, todayFor } from "./owner";
import { sweepBeforeWrite } from "./sweep";

export interface OwnerContext {
  owner: Doc<"owners">;
  today: LocalDate;
}

/**
 * The shared mutation wrapper that holds the sweep obligation. Every write path
 * goes through it, so Instances are pinned forward to today before the mutation
 * writes anything.
 *
 * This is the one correctness property a reviewer cannot verify by reading the
 * tables. If a new write path bypasses it, the resulting hole looks exactly
 * like a legitimately empty stretch: it is always repairable, because Instances
 * are a pure function of immutable inputs, but detection is a job someone has
 * to run rather than an invariant the storage holds.
 *
 * A backlog too large for one transaction is refused rather than half swept.
 * `owners.sweep` is the resumable path out of it.
 */
export const ownedMutation = customMutation(
  mutation,
  customCtx(async (ctx): Promise<OwnerContext> => {
    const owner = await requireOwner(ctx);
    const today = todayFor(owner);
    return { owner: await sweepBeforeWrite(ctx, owner, today), today };
  }),
);

/**
 * Queries cannot sweep, and do not need to: a lagging watermark shows fewer
 * Instances, never wrong ones, and the next mutation repairs it.
 */
export const ownedQuery = customQuery(
  query,
  customCtx(async (ctx): Promise<OwnerContext> => {
    const owner = await requireOwner(ctx);
    return { owner, today: todayFor(owner) };
  }),
);

/** For scheduled continuations, which carry an owner id instead of an identity. */
export async function ownerById(
  ctx: MutationCtx,
  ownerId: Id<"owners">,
): Promise<MutationCtx & OwnerContext> {
  const owner = await ctx.db.get(ownerId);
  if (!owner) throw new Error("Owner not found");
  const today = todayFor(owner);
  return { ...ctx, owner: await sweepBeforeWrite(ctx, owner, today), today };
}
