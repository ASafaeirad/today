import { useQuery } from "convex/react";
import { useMemo } from "react";

import type { LocalDate } from "#domain/date";

import { api } from "#convex/_generated/api";

import { countBacklog, stripDates, visibleDates, type DaySummary } from "./console";

export interface DayStrip {
  /** The dates with a slot, newest first. The selected date always keeps its slot. */
  dates: LocalDate[];
  summaries: ReadonlyMap<LocalDate, DaySummary>;
  today: DaySummary | undefined;
  backlog: number;
}

/**
 * The recent window plus the open history, summarized. Both queries are live,
 * so a mark on any day moves its slot without a refetch.
 */
export function useDayStrip(today: LocalDate, selected: LocalDate): DayStrip {
  const backlog = useQuery(api.days.backlog);
  const asked = useMemo(() => stripDates(today, backlog ?? []), [today, backlog]);
  const overview = useQuery(api.days.overview, { dates: asked });

  const summaries = useMemo(
    () => new Map<LocalDate, DaySummary>((overview ?? []).map((row) => [row.date, row])),
    [overview],
  );

  const dates = useMemo(() => {
    const visible = visibleDates(asked, summaries, today);
    if (visible.includes(selected) || !asked.includes(selected)) return visible;
    return [...visible, selected].sort((a, b) => (a > b ? -1 : 1));
  }, [asked, summaries, today, selected]);

  return {
    dates,
    summaries,
    today: summaries.get(today),
    backlog: countBacklog(summaries.values(), today),
  };
}
