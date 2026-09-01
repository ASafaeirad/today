# Routine Day Ledger

A single-user routine tracker where skipping a routine is a resource that has to be earned.
This glossary fixes the language of the ledger: routines, the days they land on, the marks
that record what happened, and the skip balance those marks produce.

## Routines and scheduling

**Routine**:
A recurring commitment the user has taken on, identified once and named latest-wins. renaming it
renames it everywhere, including in closed history.
_Avoid_: Habit, task, item

**Schedule**:
The set of weekdays a routine lands on. Edits are today-forward and never reshape a past day.
_Avoid_: Recurrence, frequency, cadence

**Schedule Version**:
One immutable statement of a routine's schedule over a dated range. A schedule edit ends the
current version and begins the next; the past keeps pointing at the version that produced it.
_Avoid_: Revision, generation

**Scheduled**:
Said of a routine on a date when an active, unpaused schedule version places it there. A paused or
lapsed routine is not scheduled. It cannot be missed and cannot block a mint.
_Avoid_: Due, assigned, planned

**Instance**:
The occurrence of one routine on one day, existing because the routine was scheduled that date.
_Avoid_: Entry, item, occurrence, todo

**Roster**:
The complete set of instances on one local date, fixed against the schedule versions in force on
that date. A roster exists for every past date, whether or not the user ever opened it.
_Avoid_: Schedule, list, lineup

**Pause**:
A dated range, today-forward and endable early, during which a routine is not scheduled. Paused
days generate no instances and do not advance the retirement counter.
_Avoid_: Snooze, suspend, hold

**Lapse**:
A stretch of dates with no active schedule version at all; the routine did not exist then. A lapse
is distinct from a run of zeroes: there was nothing to do, not nothing done.
_Avoid_: Gap, inactive period

**Retirement**:
The end of a routine's current active range, offered by the tool after a run of consecutive
scheduled misses and always confirmed by the user. A retired routine can return later as a new
active range under the same identity.
_Avoid_: Deletion, archiving, disabling

## Days and marks

**Local Date**:
The identity of a day, a calendar date string in the owner's timezone, assigned once and never
recomputed. Changing the timezone moves only which date counts as today from then on.
_Avoid_: Timestamp, date key

**Day**:
Everything that happened on one local date: the instances scheduled then and their marks.
_Avoid_: Entry, log, session

**Mark**:
One tap recording an outcome for one instance. Marks are append-only and ordered by the time the
server accepted them, never by the device clock; the latest one is authoritative.
_Avoid_: Record, event, log entry

**Unset**:
An explicit mark that clears a previous one, leaving the instance with no outcome. Nothing is ever
deleted to clear a mark.
_Avoid_: Clear, null, delete, undo

**Outcome**:
What a mark says happened: **done**, **skipped**, or **missed**. There is no fourth value.
_Avoid_: Status, state, result

**Skipped**:
The outcome bought with a banked skip: a deliberate decision not to do something, which leaves the
completion rate untouched. It is the only outcome the user pays for, and the payment is what
distinguishes it from a miss.
_Avoid_: Excused, deferred, passed, escaped

**Awaiting Review**:
The state of a _day_ whose date has passed but which has not been closed. Days stay here forever if
the user never returns; nothing closes them in the background. Instances are never awaiting review; an instance has an outcome or it has none yet.
_Avoid_: Pending, stale, overdue, unreviewed

**Settled**:
Said of an instance whose day has been closed, and which therefore has a final outcome. Only
settled instances count toward rates; instances on open or unreviewed days are excluded from both
sides of every rate.
_Avoid_: Closed instance, finalized, resolved, counted

**Close**:
The user's deliberate act of settling a day. Every unset instance becomes missed. Closing is
one-way and idempotent: a second close changes nothing and never mints twice.
_Avoid_: Finalize, submit, lock, commit

**Amendment**:
Changing a mark on an already-closed day, by appending a new mark. It happens in place, with no
reopening and no expiry.
_Avoid_: Reopen, edit history, revision

## Rates

**Completion Rate**:
Done settled instances over done plus missed, across a chosen window. Skipped instances are on
neither side: spending a skip is what buys an instance out of the rate.
_Avoid_: Adherence, success rate, score, streak

**Window**:
The span of local dates a rate is computed over. Comparing a partial period against a previous one
clips both to the same elapsed slice of settled dates, never a partial period against a whole one.
_Avoid_: Period, range, timeframe

## The skip economy

**Horizon**:
The span of recent local dates the balance is computed over. Days older than the horizon shape the
record and the rates, but no longer shape the balance.
_Avoid_: Window, lookback, period, retention

**Balance**:
The number of skips currently available, recomputed from the days inside the horizon every time it
is read. No stored number is ever the authority.
_Avoid_: Credits, points, budget, savings

**Mint**:
The earning of one skip by a fixed number of all-done days inside the horizon. A day containing any
skip or miss counts toward nothing, and so does a day with no scheduled routines.
_Avoid_: Earn, award, grant, accrue

**Spend**:
The consumption of one banked skip, at close, by an instance marked skipped; the purchase that
keeps that instance out of the completion rate. A backlog day spends the balance as it stands now,
not as it stood on the date under review.
_Avoid_: Deduct, use, redeem

**Age Out**:
The passing of an all-done day beyond the horizon, which lowers the balance by the share of a skip
that day was contributing. A spend ages out the same way, so the balance is self-limiting in both
directions.
_Avoid_: Expire, decay, lapse, reset

**Hold**:
A skip reserved by marking an instance skipped on a day that is still open, shown as unavailable
but not yet spent. Un-marking releases it at no cost.
_Avoid_: Reserve, pending spend, lock

## Ownership

**Owner**:
The single user every routine, day and mark belongs to. Nothing is shared, observed, or visible
across owners.
_Avoid_: User, account, tenant
