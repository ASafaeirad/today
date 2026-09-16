# A held streak bonus makes review order irrelevant

Closing a non-empty day banks one Experience per done Instance plus a base reward of 10, and the
No-Miss Seal Streak multiplies the closing reward only. The streak is a chronological fact, so a
day cannot know its own place in the run while an **older** non-empty day is still awaiting review.

The close banks what it knows and holds what it does not. A day closed over such a gap writes its
done Experience and the base 10 immediately and records `settled: false`; the multiplied part lands
later, when the gap is reviewed and a forward walk over the calendar settles every award it passes
in date order. The same settled history therefore comes to the same lifetime total whatever order
the owner worked through the backlog in.

Two watermarks carry this, because the two walks have to stop in different places. `settledThrough`
is the last date whose place in the run is final; it stops at the first eligible day with no award.
`bankedThrough` is how far the walk over pre-existing closed history has written awards; it steps
over gaps, because a gap holds the multiplier and not the base.

## Considered and rejected

**Award the streak at close from the streak as it stands.** One number, no second phase, and the
receipt is complete the moment it prints. Rejected because it makes review order load-bearing:
resolving Monday after Tuesday gives Tuesday a streak of 1, and resolving it before gives Tuesday a
streak of 2, for the same history. An owner who cleared a backlog newest-first would be permanently
poorer than one who cleared it oldest-first, for no reason they could see.

**Recompute the whole run on every close.** Correct, order-independent and trivially explained: fold
every eligible day from the beginning and take the total. Rejected on cost. It is a scan over
unbounded history on the hot path, and the ledger's existing rule is that no read may grow with the
age of the account — the same rule that made the balance a rolling window (ADR-0003).

**Refuse to close a day over an older awaiting-review one.** This would make the gap impossible and
the arithmetic exact. Rejected because it inverts the whole point of the reward: the feature exists
to get an owner who has fallen behind to close _today_, and a refusal that says "resolve last
Tuesday first" is the wall they already walked into.

**Guess the bonus and reconcile later.** Show the streak the day would probably land on, then
correct it when the gap settles. Rejected because a number that goes down is worse than a number
that arrives late, and the lifetime total is the one thing in this ledger that must never fall.

## Consequences

**A receipt can be incomplete, and says so.** A held day prints `held` where the streak line would
be, and the console carries a `BONUS HELD · nD` chip for as long as the gap stands. This is a real
cost: the owner is told they are owed something without being told how much, because how much is
not knowable yet.

**Settling one old day can bank a large amount at once.** The receipt for the day that closes the
gap reports the released Experience on its own line. An owner who left a fortnight open and then
resolved it gets that fortnight's multipliers in one reading rather than fourteen.

**Awards are frozen; the rollup is not.** `dayAwards` is the evidence and is written once per owner
and local date, which is what makes banking idempotent under a retried close. The `progression` row
is a sum over it and is rebuildable by `rebuild.progression`. An Amendment to an already-closed day
changes the record and not the award, so progression cannot be farmed by re-marking history.

**The walks are bounded and resumable.** Both stop after `MAX_PROGRESSION_DAYS` dates and commit
the watermark they reached, so an owner arriving with years of closed history converges in chunks
rather than failing in one transaction — the same shape as the sweep (ADR-0002).
