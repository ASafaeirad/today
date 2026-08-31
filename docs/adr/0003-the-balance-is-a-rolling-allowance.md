# The balance is a rolling allowance, not a savings account

The balance is computed over a **horizon** of the last 30 local dates: one skip for every 5
all-done days inside it, less the skips spent inside it, floored at zero. Days older than the
horizon still shape the record and the rates, but no longer shape the balance. There is no cap,
because the horizon is the ceiling: the bank cannot exceed what 30 days can mint.

## Considered and rejected

**A cap, clamped at read**: `clamp(Σ minted − Σ spent, 0, CAP)`, which is what this project
carried until now. It is the simplest arithmetic available and completely order-independent, but
it does not do the job. An owner who mints 60 skips and spends 5 still has 55, so the clamp shows a
ceiling the owner never actually hits. Overflow was documented as *hidden, not destroyed*; the
consequence nobody costed is that a hidden overflow is a bank, and after any good run skipping
becomes free. It also cannot be explained by pointing at days: no day accounts for a displayed 5
when the totals are 60 and 10.

**A cap, applied in date order**: fold the days ascending, `b ← max(0, min(CAP, b + minted) −
spent)`. This makes the cap bite and stays exactly recomputable; the stated objection that
destroying overflow is order-dependent confuses write order with date order, and date order is
stable. It composes into one small record per year, so it is not expensive either. It was rejected
because closing an old backlog day inserts a spend at that old date, so today's balance can move by
something other than one. That breaks the promise **Hold** makes to the owner about what a spend
will cost.

**Limiting the spend rate instead**: keep a true lifetime total, allow at most one spend per seven
local dates. This preserves *banked skips never expire* and stops a large bank being dumped at
once, which is the failure the cap was aimed at. Rejected because the bank still grows without
limit, and a balance reading 60 tells the owner a skip is free whatever the rate limit says.

## Consequences

**One parent constraint is withdrawn.** *Banked skips do not expire* is no longer true: they age
out. That constraint and the cap were two attempts at one goal, and they could not both be kept.

**The balance stops being a fold over all history.** It is a count over the days inside the
horizon, so it costs the same to read in year one and year ten. The per-year balance projection
that the store design was converging on is unnecessary and should not be built.

**A correction to an old day cannot move the balance.** The founding worry of the store design;
month fourteen, an old day is corrected, the balance moves and nobody can say why; is now
structurally impossible. Only corrections inside the horizon affect it, and those are recent enough
to be recognized.

**The balance moves on days the owner does nothing.** When an all-done day ages out, the balance
falls without any action. This is a small instance of exactly what the tool exists to avoid. It is
predictable and it drills down to days, but it is the real price of this decision and it should not
be discovered later as a surprise.

**30 and 5 are knobs, not decisions.** The horizon length and the days-per-skip ratio are
configuration. A perfect month yields 6 skips; a month that is 60 percent all-done yields 3.
