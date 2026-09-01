import { computeBalance, horizonRange } from "#domain/balance";
import { DAYS_PER_SKIP, HORIZON_DAYS } from "#domain/constants";

import { ownedQuery } from "./lib/functions";
import { instancesBetween } from "./lib/instances";
import { dayStatsBetween } from "./lib/projections";

/**
 * A count over the last 30 local dates and nothing else, so it costs the same
 * in year one and year ten, and a correction to a day outside the horizon
 * cannot move it at all. ADR-0003.
 *
 * Holds are read from the Instances of the open dates inside the horizon, not
 * from `dayStats`: marking skipped on a still-open day reserves the skip and
 * shows it as unavailable, and un-marking releases it at no cost.
 */
export const current = ownedQuery({
  args: {},
  handler: async (ctx) => {
    const { from, to } = horizonRange(ctx.today);

    const rows = await dayStatsBetween(ctx, ctx.owner._id, from, to);
    const instances = await instancesBetween(ctx, ctx.owner._id, from, to);
    const holds = instances.filter(
      (instance) => instance.closedAt === null && instance.outcome === "skipped",
    ).length;

    const breakdown = computeBalance({
      today: ctx.today,
      rows: rows.map((row) => ({
        date: row.date,
        scheduled: row.scheduled,
        done: row.done,
        skipped: row.skipped,
        closed: row.closed,
      })),
      holds,
    });

    return {
      ...breakdown,
      horizonDays: HORIZON_DAYS,
      daysPerSkip: DAYS_PER_SKIP,
      /**
       * The days underneath the number, so that when it moves the owner can
       * find out which day moved it. The Balance also falls on days the owner
       * does nothing, when an all-done day ages out; this is what shows that.
       */
      days: rows.map((row) => ({
        date: row.date,
        scheduled: row.scheduled,
        done: row.done,
        skipped: row.skipped,
        allDone: row.closed && row.scheduled > 0 && row.done === row.scheduled,
      })),
    };
  },
});
