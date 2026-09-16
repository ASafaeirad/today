/**
 * Progression: the lifetime Experience a closed day banks, the Level that total
 * reaches, and the No-Miss Seal Streak that multiplies the closing reward.
 *
 * Every function here is arithmetic over counts a day already has. Experience
 * never touches the skip economy: nothing here mints, spends or holds, and the
 * multiplier reaches the closing reward only — a done mark is worth one point
 * on a hundred-day run and on the first day back.
 */

import { CLOSING_EXPERIENCE, DONE_EXPERIENCE, LEVEL_BAND } from "./constants";

/** The outcome counts of one day, which is all an award is computed from. */
export interface DayCounts {
  scheduled: number;
  done: number;
  skipped: number;
  missed: number;
}

/**
 * The total Experience a Level begins at: `10 · (L − 1) · L`. Level 1 begins at
 * zero, level 2 at 20, level 3 at 60, level 10 at 900, and it does not stop.
 */
export function levelThreshold(level: number): number {
  return 10 * (level - 1) * level;
}

/**
 * The Level a lifetime total has reached. The inverse of the threshold above,
 * corrected rather than trusted: `sqrt` lands on the wrong side of an exact
 * threshold often enough that a level-up would be off by one at the boundary,
 * which is the one place anybody is looking.
 */
export function levelOf(experience: number): number {
  const estimate = Math.floor((1 + Math.sqrt(1 + 0.4 * Math.max(0, experience))) / 2);
  let level = Math.max(1, estimate);
  while (levelThreshold(level + 1) <= experience) level += 1;
  while (level > 1 && levelThreshold(level) > experience) level -= 1;
  return level;
}

/**
 * Provisional title bands, five Levels each. The last one repeats forever: an
 * exhausted list must not cap a Level that has no maximum.
 */
export const TITLES = [
  "WATCHKEEPER",
  "LOGKEEPER",
  "WARDEN",
  "SENTINEL",
  "ARCHIVIST",
  "QUARTERMASTER",
  "OVERSEER",
] as const;

/** Which band a Level falls in, counted from one. */
function bandOf(level: number): number {
  return Math.min(Math.ceil(level / LEVEL_BAND), TITLES.length);
}

export function titleFor(level: number): string {
  return TITLES[bandOf(level) - 1]!;
}

/**
 * The last Level this title covers, or null once the list has run out and the
 * final title carries every Level above it.
 */
export function bandEnds(level: number): number | null {
  const band = bandOf(level);
  return band === TITLES.length ? null : band * LEVEL_BAND;
}

export interface LevelProgress {
  level: number;
  title: string;
  /** The total this Level began at, and the one the next begins at. */
  threshold: number;
  next: number;
  /** How far into the Level the owner is, out of how far it runs. */
  into: number;
  span: number;
  /** The meter's reading, 0 to 100. */
  percent: number;
}

export function levelProgress(experience: number): LevelProgress {
  const level = levelOf(experience);
  const threshold = levelThreshold(level);
  const next = levelThreshold(level + 1);
  const span = next - threshold;
  const into = experience - threshold;
  return {
    level,
    title: titleFor(level),
    threshold,
    next,
    into,
    span,
    percent: Math.round((into / span) * 100),
  };
}

/**
 * The factor the No-Miss Seal Streak applies to the closing reward. Logarithmic
 * on purpose: a week doubles nothing, and a year cannot either — at streak 100
 * this is still ×2.69, so a long run is worth returning to without making a
 * broken one unrecoverable.
 */
export function streakMultiplier(streak: number): number {
  return 1 + Math.log2(streak + 1) / 4;
}

/** The reward for closing a non-empty day, at the streak that close produces. */
export function closingExperience(streak: number): number {
  return Math.round(CLOSING_EXPERIENCE * streakMultiplier(streak));
}

/**
 * A day qualifies for the streak when it was non-empty and nothing on it was
 * missed. Skipped keeps the run: the skip was paid for out of the balance, and
 * charging it twice is what the skip economy exists to prevent.
 */
export function isNoMissDay(counts: DayCounts): boolean {
  return counts.scheduled > 0 && counts.missed === 0;
}

/**
 * Whether a day is worth an award at all. An empty roster banks nothing and
 * neither advances nor breaks the streak: there was nothing to do, which is not
 * the same fact as nothing done.
 */
export function isEligible(counts: DayCounts): boolean {
  return counts.scheduled > 0;
}

export interface DayAward {
  /** One point per done Instance, whatever the streak is. */
  doneExperience: number;
  baseExperience: number;
  /** What the multiplier added on top of the base. Zero at streak 1. */
  streakExperience: number;
  /** Where this day left the run, and the factor that came with it. */
  streak: number;
  multiplier: number;
  /** A run that was going and ended here. Reported, never punished. */
  reset: boolean;
  total: number;
}

/**
 * What one day banks, given the streak standing before it.
 *
 * A day with misses still banks its base: facing a bad record has to be worth
 * more than leaving it awaiting review, which is the whole point of the reward.
 */
export function awardFor(counts: DayCounts, priorStreak: number): DayAward {
  const streak = isNoMissDay(counts) ? priorStreak + 1 : 0;
  const multiplier = streakMultiplier(streak);
  const closing = closingExperience(streak);
  return {
    doneExperience: counts.done * DONE_EXPERIENCE,
    baseExperience: CLOSING_EXPERIENCE,
    streakExperience: closing - CLOSING_EXPERIENCE,
    streak,
    multiplier,
    reset: streak === 0 && priorStreak > 0,
    total: counts.done * DONE_EXPERIENCE + closing,
  };
}

/**
 * What a day banks while an older day is still awaiting review: everything that
 * does not depend on where the run stands. The streak part is held rather than
 * guessed, so the same settled history banks the same total whatever order the
 * backlog was reviewed in.
 */
export function heldAwardFor(counts: DayCounts): Omit<DayAward, "streak" | "multiplier"> {
  return {
    doneExperience: counts.done * DONE_EXPERIENCE,
    baseExperience: CLOSING_EXPERIENCE,
    streakExperience: 0,
    reset: false,
    total: counts.done * DONE_EXPERIENCE + CLOSING_EXPERIENCE,
  };
}

/**
 * The Experience an open day is showing but has not banked. Done marks only,
 * and it survives nothing: changing the mark takes the point back with it.
 */
export function pendingExperience(counts: Pick<DayCounts, "done">): number {
  return counts.done * DONE_EXPERIENCE;
}
