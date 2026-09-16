import { CLOSING_EXPERIENCE, LEVEL_BAND } from "./constants";
import {
  awardFor,
  bandEnds,
  closingExperience,
  heldAwardFor,
  isNoMissDay,
  levelOf,
  levelProgress,
  levelThreshold,
  pendingExperience,
  streakMultiplier,
  TITLES,
  titleFor,
  type DayCounts,
} from "./experience";

const day = (over: Partial<DayCounts> = {}): DayCounts => ({
  scheduled: 6,
  done: 6,
  skipped: 0,
  missed: 0,
  ...over,
});

describe("levels", () => {
  it("begins at one and steps by 10 · (L − 1) · L", () => {
    expect(levelThreshold(1)).toBe(0);
    expect(levelThreshold(2)).toBe(20);
    expect(levelThreshold(3)).toBe(60);
    expect(levelThreshold(4)).toBe(120);
    expect(levelThreshold(10)).toBe(900);
  });

  it("reads a total back as the level it reached, exactly at the threshold", () => {
    expect(levelOf(0)).toBe(1);
    expect(levelOf(19)).toBe(1);
    expect(levelOf(20)).toBe(2);
    expect(levelOf(59)).toBe(2);
    expect(levelOf(900)).toBe(10);
  });

  it("lands on the right side of every threshold it has", () => {
    for (let level = 1; level <= 400; level += 1) {
      expect(levelOf(levelThreshold(level))).toBe(level);
      expect(levelOf(levelThreshold(level) - 1)).toBe(level - 1 || 1);
    }
  });

  it("has no maximum", () => {
    expect(levelOf(10_000_000)).toBeGreaterThan(700);
  });

  it("measures the meter against the level's own span, not the lifetime", () => {
    const progress = levelProgress(26);
    expect(progress).toMatchObject({ level: 2, threshold: 20, next: 60, into: 6, span: 40 });
    expect(progress.percent).toBe(15);
  });
});

describe("titles", () => {
  it("changes every five levels", () => {
    expect(titleFor(1)).toBe(TITLES[0]);
    expect(titleFor(LEVEL_BAND)).toBe(TITLES[0]);
    expect(titleFor(LEVEL_BAND + 1)).toBe(TITLES[1]);
    expect(bandEnds(1)).toBe(LEVEL_BAND);
  });

  it("repeats the last title once the list runs out, rather than capping", () => {
    const last = TITLES[TITLES.length - 1];
    expect(titleFor(TITLES.length * LEVEL_BAND)).toBe(last);
    expect(titleFor(9999)).toBe(last);
    expect(bandEnds(9999)).toBeNull();
  });
});

describe("the streak multiplier", () => {
  it("is 1 at a broken streak, so a missed day still banks the base", () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(closingExperience(0)).toBe(CLOSING_EXPERIENCE);
  });

  it("grows logarithmically, so a long run never runs away with it", () => {
    expect(streakMultiplier(1)).toBeCloseTo(1.25, 5);
    expect(closingExperience(3)).toBe(15);
    expect(closingExperience(100)).toBe(27);
  });
});

describe("a day's award", () => {
  it("banks one per done instance plus the multiplied closing reward", () => {
    const award = awardFor(day({ done: 6 }), 2);
    expect(award.streak).toBe(3);
    expect(award.doneExperience).toBe(6);
    expect(award.baseExperience).toBe(CLOSING_EXPERIENCE);
    expect(award.streakExperience).toBe(5);
    expect(award.total).toBe(21);
    expect(award.reset).toBe(false);
  });

  it("keeps the base on a day with misses, and reports the reset", () => {
    const award = awardFor(day({ done: 4, missed: 2 }), 7);
    expect(award.streak).toBe(0);
    expect(award.total).toBe(4 + CLOSING_EXPERIENCE);
    expect(award.reset).toBe(true);
  });

  it("does not call a run that was already broken a reset", () => {
    expect(awardFor(day({ done: 5, missed: 1 }), 0).reset).toBe(false);
  });

  it("keeps the run through a skipped outcome", () => {
    expect(isNoMissDay(day({ done: 5, skipped: 1 }))).toBe(true);
    expect(awardFor(day({ done: 5, skipped: 1 }), 4).streak).toBe(5);
  });

  it("holds only the part that depends on the run", () => {
    const held = heldAwardFor(day({ done: 6 }));
    expect(held.streakExperience).toBe(0);
    expect(held.total).toBe(16);
    expect(held.total + awardFor(day({ done: 6 }), 2).streakExperience).toBe(
      awardFor(day({ done: 6 }), 2).total,
    );
  });

  it("counts an empty roster as no day at all", () => {
    expect(isNoMissDay(day({ scheduled: 0, done: 0 }))).toBe(false);
  });
});

describe("pending experience", () => {
  it("counts done marks and nothing else", () => {
    expect(pendingExperience({ done: 3 })).toBe(3);
    expect(pendingExperience({ done: 0 })).toBe(0);
  });
});
