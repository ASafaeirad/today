import type { LocalDate } from "#domain/date";

import {
  canAfford,
  computeBalance,
  horizonRange,
  withinHorizon,
  type BalanceBreakdown,
  type HorizonRow,
} from "#domain/balance";
import { HORIZON_DAYS } from "#domain/constants";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

import { instancesBetween } from "./instances";
import { dayStatsBetween } from "./projections";

/**
 * The one reader of the Balance. The query that shows the number and the two
 * paths that spend it all come through here, so what an owner is quoted and
 * what a skip is charged against are the same arithmetic over the same horizon.
 *
 * `ignoreHold` drops the Instances the caller is about to pay for out of the
 * hold count. A close spends its own day's holds rather than bidding against
 * them: without this, a held skip would be counted twice at the moment it is
 * settled and the last affordable skip of the horizon could never be closed.
 */
export async function readBalance(
  ctx: QueryCtx | MutationCtx,
  ownerId: Id<"owners">,
  today: LocalDate,
  ignoreHold: (instance: Doc<"instances">) => boolean = () => false,
): Promise<{ breakdown: BalanceBreakdown; rows: HorizonRow[] }> {
  const { from, to } = horizonRange(today);

  const stats = await dayStatsBetween(ctx, ownerId, from, to);
  const instances = await instancesBetween(ctx, ownerId, from, to);

  const holds = instances.filter(
    (instance) =>
      instance.closedAt === null && instance.outcome === "skipped" && !ignoreHold(instance),
  ).length;

  const rows: HorizonRow[] = stats.map((row) => ({
    date: row.date,
    scheduled: row.scheduled,
    done: row.done,
    skipped: row.skipped,
    closed: row.closed,
  }));

  return { breakdown: computeBalance({ today, rows, holds }), rows };
}

/**
 * The purchase. `skips` of them must be available right now, and the date must
 * be one the horizon can account for, or the write is refused outright: an
 * Instance that stays skipped leaves the completion denominator for good, so a
 * skip nothing paid for is a permanent exclusion bought with nothing (ADR-0001).
 *
 * Refusing is the whole mechanism. There is no debt, no negative Balance and no
 * fourth outcome to park an unpaid skip in: the owner marks it done or missed,
 * or banks another all-done day and comes back.
 *
 * Call it only when there is something to charge. A mark that costs nothing
 * must not pay for the horizon scan this does, and the hot path is one tap.
 */
export async function requireSkips(
  ctx: QueryCtx | MutationCtx,
  ownerId: Id<"owners">,
  today: LocalDate,
  input: {
    date: LocalDate;
    skips: number;
    ignoreHold?: (instance: Doc<"instances">) => boolean;
    subject: string;
  },
): Promise<BalanceBreakdown> {
  const { breakdown } = await readBalance(ctx, ownerId, today, input.ignoreHold);

  if (!withinHorizon(today, input.date)) {
    throw new Error(
      `${input.subject}: ${input.date} is outside the ${HORIZON_DAYS}-day Balance horizon (${breakdown.from} to ${breakdown.to}), so a skip there can never be charged. Mark it done or missed.`,
    );
  }

  if (!canAfford(breakdown, input.skips)) {
    throw new Error(
      `${input.subject}: ${input.skips} skip${input.skips === 1 ? "" : "s"} needed, ${breakdown.available} available (${breakdown.minted} minted from ${breakdown.allDoneDays} all-done days, ${breakdown.spent} spent, ${breakdown.held} held). Mark it done or missed, or bank another all-done day.`,
    );
  }

  return breakdown;
}
