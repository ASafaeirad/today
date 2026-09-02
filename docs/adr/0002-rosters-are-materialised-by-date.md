# Rosters are materialized by date, not on first touch

Every mutation sweeps rosters forward to today before it writes anything, so a roster exists for
every past date whether or not the user ever opened it. The alternative; materializing a roster
when a day is first touched; is cheaper and avoids a bulk write on the interactive path, but it
leaves the past dependent on the present: a day closed two years late would be judged against
today's routines and today's schedules rather than what was actually scheduled then.

## Consequences

The rationale originally given for dense rosters; honest denominators, so that ignoring the app
cannot flatter the numbers; does **not** hold, because only settled instances enter a rate and an
unopened day is never closed. Roster fidelity is the whole justification. The known cost is a
bounded but user-visible stall on the first write after a long absence, on the path that is
required to be instant. The sweep obligation is enforced by a shared mutation wrapper, not by the
schema; rosters are a pure function of the schedule versions, pauses and the calendar, so a missed
sweep is always repairable from immutable inputs.

The stall is bounded because the sweep is: one mutation pins at most `MAX_SWEEP_DAYS` dates or
`MAX_SWEEP_PLACEMENTS` instances, measured at a date boundary so a chunk never leaves half a
roster. A backlog past either bound is refused by the wrapper rather than half swept, because
writing against a watermark still behind today is the retroactive reshaping this decision exists
to prevent. `owners.sweep` is the way out: it is the one write path allowed to leave the watermark
behind today, it commits every chunk it pins and schedules the next, and every other mutation
works again once it reports `caughtUp`. Without the bound an owner returning after a long enough
absence would exceed the transaction limit on every mutation, with no mutation able to advance the
watermark incrementally, which is a state nothing recovers from.
