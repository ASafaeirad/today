import { useQuery } from "convex/react";
import { useMemo } from "react";

import type { LocalDate } from "#domain/date";

import { api } from "#convex/_generated/api";

import type { DayView, Loadable } from "./types";

import {
  LOG_DAYS,
  lookbackDates,
  nudgeDates,
  type BalanceView,
  type DaySummary,
} from "./presentation";

export interface ConsoleReads {
  day: Loadable<DayView>;
  history: Loadable<DaySummary[]>;
  backlog: Loadable<DaySummary | null>;
  balance: Loadable<BalanceView>;
  earliest: LocalDate;
}

/** All browser reads for the console, normalized into explicit loading states. */
export function useConsoleReads(today: LocalDate, date: LocalDate): ConsoleReads {
  const dates = useMemo(() => lookbackDates(today, LOG_DAYS), [today]);
  const history = useQuery(api.days.overview, { dates });
  const day = useQuery(api.days.get, { date });
  const backlogDates = useQuery(api.days.backlog);
  const asked = useMemo(() => nudgeDates(backlogDates ?? []), [backlogDates]);
  const backlog = useQuery(api.days.overview, asked.length === 0 ? "skip" : { dates: asked });
  const balance = useQuery(api.balance.current, {});

  return {
    day: day === undefined ? { status: "loading" } : { status: "ready", value: day },
    history: history === undefined ? { status: "loading" } : { status: "ready", value: history },
    backlog:
      backlogDates === undefined || (asked.length > 0 && backlog === undefined)
        ? { status: "loading" }
        : { status: "ready", value: backlog?.[0] ?? null },
    balance: balance === undefined ? { status: "loading" } : { status: "ready", value: balance },
    earliest: dates[0] ?? today,
  };
}
