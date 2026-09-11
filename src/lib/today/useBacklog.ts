import { useQuery } from "convex/react";
import { useMemo } from "react";

import { api } from "#convex/_generated/api";

import { nudgeDates, type DaySummary } from "./console";

/**
 * The one day the console nags about: the oldest past date that was never
 * closed. Sealing it reveals the next, so the nudge empties itself from the
 * far end of the history rather than the near one.
 */
export function useBacklog(): DaySummary | undefined {
  const backlog = useQuery(api.days.backlog);
  const asked = useMemo(() => nudgeDates(backlog ?? []), [backlog]);
  const overview = useQuery(api.days.overview, asked.length === 0 ? "skip" : { dates: asked });

  // A past day with nothing on its roster has nothing to resolve and nothing
  // worth sealing: it is history, not a nag.
  return overview?.find((summary) => summary.scheduled > 0);
}
