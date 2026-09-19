import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

import type { LocalDate } from "#domain/date";
import type { Outcome } from "#domain/outcome";

import { api } from "#convex/_generated/api";

import type { ReceiptView } from "../experience";
import type { CommandResult, DayView, SealModel } from "./types";

import { useMarkMutation } from "./marks";
import { errorText, rowStatus } from "./presentation";

interface Refusal {
  phase: "resolve" | "lock";
  reason: string;
}

/** The complete browser-side Close workflow behind one discriminated state. */
export function useSealModel(onBanked: (receipt: ReceiptView) => void): SealModel {
  const [date, setDate] = useState<LocalDate | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [locking, setLocking] = useState(false);
  const [banked, setBanked] = useState<{ day: DayView; receipt: ReceiptView } | null>(null);
  const day = useQuery(api.days.get, date === null ? "skip" : { date });
  const mark = useMarkMutation();
  const close = useMutation(api.days.close);
  const pending = (day?.roster ?? []).filter((entry) => rowStatus(entry) === "open");

  const cancel = () => {
    setDate(null);
    setRefusal(null);
    setLocking(false);
    setBanked(null);
  };

  const resolve = (outcome: Outcome) => {
    const next = pending[0];
    if (day === undefined || next === undefined) return;
    setRefusal(null);
    mark({ date: day.date, routineId: next.routineId, outcome }).catch((error: unknown) => {
      setRefusal({ phase: "resolve", reason: errorText(error) });
    });
  };

  const lock = async (): Promise<CommandResult> => {
    if (day === undefined || locking) {
      return { ok: false, reason: "The Day is not ready to Close." };
    }
    setRefusal(null);
    setLocking(true);
    try {
      const result = await close({ date: day.date, seal: true, expectedRev: day.rev });
      setLocking(false);
      setBanked({ day, receipt: result.receipt });
      onBanked(result.receipt);
      return { ok: true };
    } catch (error) {
      const reason = errorText(error);
      setRefusal({ phase: "lock", reason });
      setLocking(false);
      return { ok: false, reason };
    }
  };

  let workflow: SealModel["workflow"];
  if (date === null) workflow = { state: "idle" };
  else if (banked !== null) workflow = { state: "receipt", date, ...banked };
  else if (day === undefined) workflow = { state: "loading", date };
  else if (refusal !== null) {
    workflow = { state: "refused", date, day, pending, ...refusal };
  } else if (pending.length > 0) workflow = { state: "resolving", date, day, pending };
  else if (locking) workflow = { state: "locking", date, day };
  else workflow = { state: "ready", date, day };

  return {
    workflow,
    begin: (next) => {
      setRefusal(null);
      setBanked(null);
      setDate(next);
    },
    resolve,
    lock,
    cancel,
  };
}
