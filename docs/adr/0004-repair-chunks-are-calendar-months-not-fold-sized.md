# Repair chunks are calendar months, not fold-sized

`repair.range` refuses a scope over `MAX_EAGER_DAYS` (31) or `MAX_EAGER_FOLDS` (400) and names
`repair.start` as the way through, but the batch path it points at splits only on month boundaries
and repairs each whole month in one mutation. The two are not the same bound, so a chunk can carry
more folds than the eager path just refused: 13 daily routines put a 31-day chunk over 400. We are
keeping month chunks, and recording why so that nobody reads the gap as an oversight and closes it
the wrong way.

The expected scale of this project is a handful of routines, not dozens. At six daily routines a
31-day chunk is 186 folds, under half the budget, and a whole month is under the eager limit anyway,
so `repair.range` would accept the same span directly. No chunk the batch path builds is larger
than what the eager path already runs on ordinary calls, which is the actual safety argument: the
batch path is not doing anything the interactive path is not doing constantly. The tripwire is 13
daily routines, and it is worth re-reading this ADR before the routine count reaches double digits.

## Considered and rejected

**Subdividing chunks by expected folds as well as by dates.** The obvious fix, and it breaks the
invariant `runChunk` rests on. Chunk identity is positional: every invocation recomputes
`monthChunks(run.from, run.to)` and records progress as an index in `appliedChunks`. That is sound
only because `monthChunks` is a pure function of two stored dates. Fold counts are not pure, because
repair itself places and removes Instances, so a fold-aware split recomputed between chunks can
shift the indices underneath the run and cost the guarantee that a retry of `(runId, chunk)` does
nothing.

**Persisting the chunk list on the `batchRuns` row at `start`.** This one does work. The split is
computed once, can be fold-aware, and stays stable for the life of the run whatever repair does to
the Instances underneath it. Rejected only because nothing needs it at current scale; it costs one
schema field and it is the way in if the tripwire is ever hit.

**Raising `MAX_EAGER_FOLDS` so the two paths agree.** The eager bound is what keeps the interactive
path inside one transaction. Moving it to make a batch-path arithmetic problem disappear spends the
wrong budget.

## Consequences

**A chunk that fails must stay failed, and the failure has to be seen from outside.** Nothing writes
`state: "failed"` today: the literal is in the schema with no writer. A throw inside `runChunk`
rolls its own writes back, but leaves the row `running` with no continuation scheduled and no cancel
path, so the `inFlight` banner stays up until somebody edits the row by hand. This is independent of
routine count and it is the more likely of the two failures to actually bite. When it is fixed, the
chunk must keep throwing: catching around `repairRange` and patching `state: "failed"` turns the
throw into a commit, which lands the partial chunk and destroys the very invariant the in-transaction
cursor exists to protect. The shape that works is to store the scheduled job id on the run at
`start` and read `ctx.db.system.get("_scheduled_functions", id)` from the banner query or a sweep.

**The fold budget is not a document count.** Each resolved fold touches the Marks for the cell, the
Instance, and the aggregate tree, on top of the per-date `ensureDay` and `rewriteDayStats`. 400 is
calibrated with that multiplier already in it, so it cannot be reasoned about linearly if it is ever
moved.

**`days.close` carries a looser version of the same asymmetry.** It refuses a date whose roster is
over `MAX_EAGER_FOLDS` and tells the caller to use "the batch path", but its count is per-date, so
it fires only at 401 routines scheduled on one day, and there is no batched close to send that
caller to. The instruction is dangling rather than wrong, and at this scale it is unreachable.
