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

/**
 * The Experience one done Instance banks when its day closes, and the reward
 * for closing a non-empty day at all. The closing reward is the larger of the
 * two on purpose: the day is finished by reviewing it, not by marking it.
 */
export const DONE_EXPERIENCE = 1;
export const CLOSING_EXPERIENCE = 10;

/** How many Levels one title band covers. */
export const LEVEL_BAND = 5;

/**
 * The progression walk's scope rule, in the same shape as the sweep's. The walk
 * over the calendar that settles awards is bounded per transaction and resumes
 * from the watermark it commits, so an owner arriving with years of closed
 * history converges in chunks instead of failing forever.
 */
export const MAX_PROGRESSION_DAYS = 120;

/** The document budget a rate answer is measured against. */
export const RATE_DOCUMENT_LIMIT = 40;

/**
 * The sweep's scope rule, in the same shape as the eager one above. A backlog
 * past either bound is pinned in committed chunks by `owners.sweep` rather than
 * in the one transaction a normal mutation gets, which an owner returning after
 * a long absence would overrun with no way to make progress.
 */
export const MAX_SWEEP_DAYS = 31;
export const MAX_SWEEP_PLACEMENTS = 400;
