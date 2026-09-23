import {
  backfillLine,
  bandNote,
  closeProjection,
  heldLine,
  levelView,
  logExperience,
  markAnnouncement,
  pendingLine,
  streakLine,
  type AwardView,
} from "./experience";

const award = (over: Partial<AwardView> = {}): AwardView => ({
  total: 23,
  doneExperience: 6,
  baseExperience: 10,
  streakExperience: 7,
  held: false,
  streak: 6,
  multiplier: 1.7,
  ...over,
});

it("the bar reads the lifetime total as a level and a distance into it", () => {
  const level = levelView(126);
  expect(level.plate).toBe("04");
  expect(level.title).toBe("WATCHKEEPER");
  expect(level.spanLine).toBe("6/80 to lv 5");
  expect(level.lifetimeLine).toBe("126 XP");
  expect(level.percent).toBe(8);
});

it("the run is printed with the factor it is worth, never alone", () => {
  expect(streakLine(3, 1.5)).toBe("NO-MISS 3D ×1.50");
  expect(streakLine(0, 1)).toBe("NO-MISS 0D ×1.00");
  expect(heldLine(2)).toBe("BONUS HELD · 2D");
  expect(pendingLine(4)).toBe("+4 XP PENDING");
});

describe("the close projection", () => {
  it("counts the day's done marks plus the reward the run would multiply", () => {
    expect(closeProjection({ scheduled: 6, done: 6, missed: 0 }, 2)).toBe(
      "close banks +21 xp (×1.50)",
    );
  });

  it("drops the multiplier the moment the day has a miss on it", () => {
    expect(closeProjection({ scheduled: 6, done: 5, missed: 1 }, 2)).toBe(
      "close banks +15 xp (×1.00)",
    );
  });

  it("says so rather than projecting a reward an empty day cannot pay", () => {
    expect(closeProjection({ scheduled: 0, done: 0, missed: 0 }, 3)).toBe("empty day · no xp");
  });
});

describe("the log's experience column", () => {
  it("marks a day whose streak part an older one is still holding", () => {
    expect(logExperience(award(), true)).toBe("+23");
    expect(logExperience(award({ held: true, total: 16 }), true)).toBe("+16 •");
  });

  it("tells a lapse apart from a day that has simply not banked yet", () => {
    expect(logExperience(null, true)).toBe("—");
    expect(logExperience(null, false)).toBe("·");
  });
});

it("names the level the title band runs out at, and says when it never does", () => {
  expect(bandNote(4)).toBe("title band holds through lv 5");
  expect(bandNote(200)).toBe("OVERSEER is the last title — it holds from here on");
});

it("summarizes counted history without repeating the current level", () => {
  expect(backfillLine(84, 1407)).toBe(
    "We counted 84 closed days and added 1,407 XP to your total.",
  );
  expect(backfillLine(1, 12)).toBe("We counted 1 closed day and added 12 XP to your total.");
});

describe("what a mark says to whoever is listening", () => {
  it("says the point is pending rather than banked", () => {
    expect(markAnnouncement("done", false)).toContain("pending");
    expect(markAnnouncement("done", false)).toContain("banks when you close the day");
  });

  it("says the preview went with the mark that earned it", () => {
    expect(markAnnouncement(null, true)).toBe(
      "done mark removed. its pending experience was removed too.",
    );
  });

  it("does not offer a reward for an outcome that has none", () => {
    expect(markAnnouncement("missed", false)).toBe(
      "marked missed. no experience for this outcome.",
    );
    expect(markAnnouncement("skipped", false)).toBe(
      "marked skipped. no experience for this outcome.",
    );
  });
});
