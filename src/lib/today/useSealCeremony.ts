import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

import type { LocalDate } from "#domain/date";
import type { Outcome } from "#domain/outcome";

import { api } from "#convex/_generated/api";

import type { ReceiptView } from "./experience";

import { errorText, rowStatus } from "./console";
import { useMarkInstance, type DayView, type RosterEntry } from "./ledger";

/**
 * Resolve forces a verdict on every open line, lock is the last word, and the
 * receipt is what the lock banked. The first two are reversible and the third
 * is not a question: by the time it prints, the day is closed.
 */
export type SealStage = "resolve" | "lock" | "receipt";

export interface SealCeremony {
  /** The date under the ceremony — today, or the backlog day being resolved. */
  date: LocalDate | null;
  day: DayView | undefined;
  stage: SealStage;
  pending: RosterEntry[];
  refusal: string | null;
  locking: boolean;
  /** What the lock banked. Null until it has. */
  receipt: ReceiptView | null;
  begin: (date: LocalDate) => void;
  resolve: (outcome: Outcome) => void;
  lock: () => void;
  cancel: () => void;
}

/**
 * The seal, for whichever day is being sealed. The first two stages are
 * derived, never stored: while a line is open the ceremony is resolving, and it
 * falls through to the lock the moment the last verdict lands. Nothing is
 * written to the day until the lock, so escape at any point leaves it exactly
 * as open as it was.
 *
 * The receipt is the one stage that *is* stored, because it is the one thing
 * here the ledger cannot be asked for twice: the close reports what it banked
 * as it banks it, and a second close would bank nothing and could not say.
 */
export function useSealCeremony(onBanked: (receipt: ReceiptView) => void): SealCeremony {
  const [date, setDate] = useState<LocalDate | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptView | null>(null);

  const day = useQuery(api.days.get, date === null ? "skip" : { date });
  const mark = useMarkInstance();
  const close = useMutation(api.days.close);

  const pending = (day?.roster ?? []).filter((entry) => rowStatus(entry) === "open");
  const cancel = () => {
    setDate(null);
    setRefusal(null);
    setLocking(false);
    setReceipt(null);
  };

  return {
    date,
    day,
    stage: receipt !== null ? "receipt" : pending.length > 0 ? "resolve" : "lock",
    pending,
    refusal,
    locking,
    receipt,
    begin: (next) => {
      setRefusal(null);
      setReceipt(null);
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
        .then((result) => {
          setLocking(false);
          setReceipt(result.receipt);
          onBanked(result.receipt);
        })
        .catch((error: unknown) => {
          setRefusal(errorText(error));
          setLocking(false);
        });
    },
    cancel,
  };
}
