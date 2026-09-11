import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

import type { LocalDate } from "#domain/date";
import type { Outcome } from "#domain/outcome";

import { api } from "#convex/_generated/api";

import { errorText, rowStatus } from "./console";
import { useMarkInstance, type DayView, type RosterEntry } from "./ledger";

/** Resolve forces a verdict on every open line; lock is the last word. */
export type SealStage = "resolve" | "lock";

export interface SealCeremony {
  /** The date under the ceremony — today, or the backlog day being resolved. */
  date: LocalDate | null;
  day: DayView | undefined;
  stage: SealStage;
  pending: RosterEntry[];
  refusal: string | null;
  locking: boolean;
  begin: (date: LocalDate) => void;
  resolve: (outcome: Outcome) => void;
  lock: () => void;
  cancel: () => void;
}

/**
 * The seal, for whichever day is being sealed. The stage is derived, never
 * stored: while a line is open the ceremony is resolving, and it falls through
 * to the lock the moment the last verdict lands. Nothing is written to the day
 * until the lock, so escape at any point leaves it exactly as open as it was.
 */
export function useSealCeremony(): SealCeremony {
  const [date, setDate] = useState<LocalDate | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);

  const day = useQuery(api.days.get, date === null ? "skip" : { date });
  const mark = useMarkInstance();
  const close = useMutation(api.days.close);

  const pending = (day?.roster ?? []).filter((entry) => rowStatus(entry) === "open");
  const cancel = () => {
    setDate(null);
    setRefusal(null);
    setLocking(false);
  };

  return {
    date,
    day,
    stage: pending.length > 0 ? "resolve" : "lock",
    pending,
    refusal,
    locking,
    begin: (next) => {
      setRefusal(null);
      setDate(next);
    },
    resolve: (outcome) => {
      const next = pending[0];
      if (day === undefined || next === undefined) return;
      setRefusal(null);
      mark({ date: day.date, routineId: next.routineId, outcome }).catch((error: unknown) =>
        setRefusal(errorText(error)),
      );
    },
    lock: () => {
      if (day === undefined || locking) return;
      setRefusal(null);
      setLocking(true);
      close({ date: day.date, seal: true, expectedRev: day.rev })
        .then(cancel)
        .catch((error: unknown) => {
          setRefusal(errorText(error));
          setLocking(false);
        });
    },
    cancel,
  };
}
