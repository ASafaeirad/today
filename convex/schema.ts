import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/** done | skipped | missed. There is no fourth value. */
export const outcomeValidator = v.union(
  v.literal("done"),
  v.literal("skipped"),
  v.literal("missed"),
);

/** A Mark may be an Unset, which clears the previous one without deleting it. */
export const markOutcomeValidator = v.union(outcomeValidator, v.null());

export default defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    timezone: v.optional(v.string()),
  }).index("email", ["email"]),

  /** The single user every routine, day and mark belongs to. */
  owners: defineTable({
    userId: v.id("users"),
    /** Frozen: every local date in the ledger is a date in this zone. */
    timezone: v.string(),
    /** Sweep watermark. Moves only forward, so a re-run writes nothing. */
    pinsThroughDate: v.string(),
  }).index("by_user", ["userId"]),

  /** Named latest-wins: renaming renames it everywhere, closed history included. */
  routines: defineTable({
    ownerId: v.id("owners"),
    name: v.string(),
  }).index("by_owner", ["ownerId"]),

  /**
   * The interval log. One row states one routine's day-of-week mask over one
   * dated range. Immutable below today; never rewritten, only closed and opened.
   */
  scheduleVersions: defineTable({
    ownerId: v.id("owners"),
    routineId: v.id("routines"),
    seq: v.number(),
    dowMask: v.number(),
    activeFrom: v.string(),
    activeUntil: v.union(v.string(), v.null()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_owner_routine_seq", ["ownerId", "routineId", "seq"]),

  days: defineTable({
    ownerId: v.id("owners"),
    date: v.string(),
    /** The seal. Written once at close, never changed. */
    closedAt: v.union(v.number(), v.null()),
    /** Bumped by every resolution; stamped into `outcomeRev` and `sourceRev`. */
    rev: v.number(),
    /** Idempotency token of the close that sealed the day. */
    closeKey: v.union(v.string(), v.null()),
    sealed: v.optional(v.boolean()),
    closingNote: v.optional(v.string()),
  }).index("by_owner_date", ["ownerId", "date"]),

  /**
   * The fact table, and the only table anything counts. An Instance exists for
   * every (Routine, Date) the schedule placed, whether or not the owner ever
   * opened that day, and it cites the schedule version that placed it so a 2027
   * edit cannot reshape 2025.
   */
  instances: defineTable({
    ownerId: v.id("owners"),
    date: v.string(),
    routineId: v.id("routines"),
    scheduleVersionId: v.id("scheduleVersions"),
    outcome: outcomeValidator,
    resolvedFromMarkId: v.union(v.id("marks"), v.null()),
    outcomeRev: v.number(),
    closedAt: v.union(v.number(), v.null()),
  })
    .index("by_owner_date", ["ownerId", "date"])
    .index("by_owner_routine_date", ["ownerId", "routineId", "date"])
    .index("by_owner_routine_outcome_date", ["ownerId", "routineId", "outcome", "date"]),

  /** Append-only. The audit log; nothing counts them. */
  marks: defineTable({
    ownerId: v.id("owners"),
    date: v.string(),
    routineId: v.id("routines"),
    outcome: markOutcomeValidator,
    actorId: v.id("users"),
    serverAt: v.number(),
  }).index("by_owner_date_routine_serverAt", ["ownerId", "date", "routineId", "serverAt"]),

  /** The sole projection. Deletable and rebuildable by the fold that wrote it. */
  dayStats: defineTable({
    ownerId: v.id("owners"),
    date: v.string(),
    scheduled: v.number(),
    done: v.number(),
    skipped: v.number(),
    missed: v.number(),
    closed: v.boolean(),
    /** Commits to the inputs of the fold, never to its counts. */
    digest: v.string(),
    /** The fact revision folded into this row. Evidence, not invalidation. */
    sourceRev: v.number(),
  }).index("by_owner_date", ["ownerId", "date"]),

  /**
   * The evidence behind progression: one row per eligible local date, written
   * when that day closes and frozen from then on. A later Amendment to a closed
   * day does not rewrite what it banked.
   *
   * `settled` is the only field that ever moves, and only once: a day closed
   * over an older awaiting-review day banks what does not depend on the run and
   * waits for the streak part, which lands when the gap is reviewed.
   */
  dayAwards: defineTable({
    ownerId: v.id("owners"),
    date: v.string(),
    /** The outcome counts the award was computed from, as they stood at close. */
    scheduled: v.number(),
    done: v.number(),
    skipped: v.number(),
    missed: v.number(),
    doneExperience: v.number(),
    baseExperience: v.number(),
    streakExperience: v.number(),
    /** False while an older awaiting-review day still gates the streak part. */
    settled: v.boolean(),
    /** Where this day left the No-Miss Seal Streak. Null until settled. */
    streak: v.union(v.number(), v.null()),
    multiplier: v.union(v.number(), v.null()),
    total: v.number(),
    bankedAt: v.number(),
  }).index("by_owner_date", ["ownerId", "date"]),

  /**
   * The owner-level rollup of the rows above, so reading a level never scans an
   * unbounded history. Rebuildable from `dayAwards`, which holds the facts.
   */
  progression: defineTable({
    ownerId: v.id("owners"),
    /** Lifetime banked Experience. Never resets and never falls. */
    experience: v.number(),
    /**
     * The watermark: every eligible day through this date has a final streak
     * position. Null before the first day is banked.
     */
    settledThrough: v.union(v.string(), v.null()),
    /**
     * The backfill's watermark: every closed day through this date has an award
     * row. Null until the walk over existing history starts.
     */
    bankedThrough: v.union(v.string(), v.null()),
    /** The No-Miss Seal Streak as it stands at the watermark. */
    streak: v.number(),
    /** What the backfill carried in, reported once and then acknowledged. */
    backfilledDays: v.number(),
    backfilledExperience: v.number(),
    /** When the walk over existing history first reached today. */
    backfilledAt: v.union(v.number(), v.null()),
    /** When the owner dismissed the summary of it. */
    acknowledgedAt: v.union(v.number(), v.null()),
  }).index("by_owner", ["ownerId"]),

  /** Holds no counts at all. Delete every row and you lose progress, nothing else. */
  batchRuns: defineTable({
    ownerId: v.id("owners"),
    runId: v.string(),
    scope: v.union(v.literal("repair"), v.literal("verify")),
    from: v.string(),
    to: v.string(),
    reason: v.string(),
    cursor: v.union(v.string(), v.null()),
    chunksDone: v.number(),
    chunkCount: v.number(),
    appliedChunks: v.array(v.number()),
    state: v.union(v.literal("running"), v.literal("done"), v.literal("failed")),
    startedAt: v.number(),
    endedAt: v.union(v.number(), v.null()),
    findings: v.optional(v.array(v.string())),
  })
    .index("by_owner_runId", ["ownerId", "runId"])
    .index("by_owner_scope_state", ["ownerId", "scope", "state"]),
});
