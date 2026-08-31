# Skipped is excluded from the completion denominator

The completion rate is `done / (done + missed)`. A skipped instance appears on neither side. This
is what the balance is *for*: a banked skip is currency the user spends to keep an instance out of
the rate, so charging the rate as well would mean paying twice for one decision, which is the
streak-app guilt loop the tool exists to escape.

## Considered and rejected

`done / scheduled`, with skipped in the denominator. It reads more naturally to a newcomer and
avoids an awkward edge — a day where ten of fifteen routines are skipped reports 100% on a
denominator of five, so "no data" and "a good day" look alike. That edge is real but self-limiting:
each of those ten skips costs a banked skip, and the balance is bounded by the horizon (ADR-0003),
so it cannot be sustained.
`g3-04` states the rejected formula in its own figure caption (`done / closed scheduled`); its
stored counts are fine, only the formula is wrong.

## Consequences

Rates must be computed as `done / (done + missed)` everywhere, never `done / scheduled`. The stored
per-date and per-routine counts keep `done`, `skipped` and `missed` separately, so nothing in the
schema depends on this and the other formula stays computable.
