/**
 * The knobs of the ledger, in one module.
 *
 * These are constants, never per-owner settings: every historical number would
 * otherwise depend on a mutable value, and rates are compared across years.
 */

/** The span of recent local dates the Balance is computed over. ADR-0003. */
export const HORIZON_DAYS = 30;

/** All-done days inside the horizon that mint one skip. ADR-0003. */
export const DAYS_PER_SKIP = 5;

/** Consecutive scheduled misses that raise the retirement suggestion. */
export const RETIREMENT_THRESHOLD = 5;

/**
 * The eager path's scope rule. Beyond either of these the caller must use the
 * batch path, and an oversized mutation fails rather than doing part of the work.
 */
export const MAX_EAGER_DAYS = 31;
export const MAX_EAGER_FOLDS = 400;

/** The document budget a rate answer is measured against. */
export const RATE_DOCUMENT_LIMIT = 40;
