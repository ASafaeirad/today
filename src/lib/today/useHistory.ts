import { useQuery } from "convex/react";
import { useMemo } from "react";

import type { LocalDate } from "#domain/date";

import { api } from "#convex/_generated/api";

import { lookbackDates, LOG_DAYS, type DaySummary } from "./console";

export interface History {
  /** One summary per date in the window, oldest first. Undefined until read. */
  days: DaySummary[] | undefined;
  /** The oldest date the console will open. Nothing steps past it. */
  earliest: LocalDate;
  /** Whether this date is one the console can open at all. */
  covers: (date: LocalDate) => boolean;
}

/**
 * The recent past, in one read: enough of every date in the window to draw it
 * without opening it.
 *
 * The window is what bounds looking back. `days.overview` refuses more than
 * `MAX_EAGER_DAYS` dates at a time, so the span the console offers has to be
 * one it can actually summarize — the log, the strip and the step keys share
 * this one read rather than each inventing their own reach.
 */
export function useHistory(today: LocalDate, span: number = LOG_DAYS): History {
  const dates = useMemo(() => lookbackDates(today, span), [today, span]);
  const days = useQuery(api.days.overview, { dates });
  const earliest = dates[0] ?? today;

  return {
    days,
    earliest,
    covers: (date) => date >= earliest && date <= today,
  };
}
