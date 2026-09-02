/**
 * The Balance is a rolling allowance, recomputed from the days inside the
 * horizon every time it is read. No stored number is ever the authority.
 * ADR-0003.
 */

import { DAYS_PER_SKIP, HORIZON_DAYS } from "./constants";
import { addDays, type LocalDate } from "./date";

export interface HorizonRow {
  date: LocalDate;
  scheduled: number;
  done: number;
  skipped: number;
  closed: boolean;
}

export interface BalanceBreakdown {
  from: LocalDate;
  to: LocalDate;
  allDoneDays: number;
  minted: number;
  spent: number;
  held: number;
  balance: number;
  available: number;
}

/** The last `HORIZON_DAYS` local dates, ending today inclusive. */
export function horizonRange(today: LocalDate): { from: LocalDate; to: LocalDate } {
  return { from: addDays(today, -(HORIZON_DAYS - 1)), to: today };
}

/**
 * An all-done day is a closed row with `scheduled > 0` and `done == scheduled`;
 * a day with no scheduled routines counts toward nothing, so an empty Sunday
 * cannot farm currency.
 */
export function isAllDone(row: HorizonRow): boolean {
  return row.closed && row.scheduled > 0 && row.done === row.scheduled;
}

/**
 * Holds are not deductions. Marking skipped on a still-open day reserves the
 * skip and shows it as unavailable; the deduction is real only at close, and
 * un-marking costs nothing.
 */
export function computeBalance(input: {
  today: LocalDate;
  rows: readonly HorizonRow[];
  holds: number;
}): BalanceBreakdown {
  const { from, to } = horizonRange(input.today);
  const inHorizon = input.rows.filter((row) => row.date >= from && row.date <= to);

  const allDoneDays = inHorizon.filter(isAllDone).length;
  const minted = Math.floor(allDoneDays / DAYS_PER_SKIP);
  const spent = inHorizon
    .filter((row) => row.closed)
    .reduce((total, row) => total + row.skipped, 0);
  const balance = Math.max(0, minted - spent);

  return {
    from,
    to,
    allDoneDays,
    minted,
    spent,
    held: input.holds,
    balance,
    available: Math.max(0, balance - input.holds),
  };
}

/**
 * Whether a date is one of the dates the Balance is computed over. A skip on a
 * date outside the horizon cannot be charged: no row outside the window is
 * summed into `spent`, so the spend would evaporate while the rate exclusion it
 * bought stayed forever. ADR-0003 says days outside the horizon no longer shape
 * the Balance; this is the other half of that sentence.
 */
export function withinHorizon(today: LocalDate, date: LocalDate): boolean {
  const { from, to } = horizonRange(today);
  return date >= from && date <= to;
}

/**
 * A skip is bought, not merely declared. ADR-0001 excludes skipped Instances
 * from the completion denominator precisely because each one costs a banked
 * skip and the horizon bounds the bank; an unpaid skip would be a free exclusion
 * from the rate, which is the failure that ADR argues cannot be sustained.
 */
export function canAfford(breakdown: BalanceBreakdown, skips: number): boolean {
  return skips <= breakdown.available;
}
