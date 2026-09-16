import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef } from "react";

import { api } from "#convex/_generated/api";

import type { ProgressionView } from "./experience";

/**
 * The banked side of progression, and the one write a read has to drive.
 *
 * Queries cannot write, so an owner whose closed history predates progression
 * arrives with nothing banked and the walk over that history is run from here,
 * a bounded chunk per call until it reports itself complete — the same shape as
 * the sweep. Every call is idempotent, so a second tab racing this one converges
 * instead of banking twice.
 */
export function useProgression(): ProgressionView | undefined {
  const progression = useQuery(api.experience.progression, {});
  const sync = useMutation(api.experience.sync);
  const inFlight = useRef(false);

  const behind = progression !== undefined && !progression.caughtUp;

  useEffect(() => {
    if (inFlight.current || !behind) return;
    inFlight.current = true;
    sync({})
      .catch(() => {
        /* The next query update retries; nothing to say to the owner yet. */
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, [behind, sync]);

  return progression;
}

/** Dismisses the one summary the backfill is allowed. It does not come back. */
export function useAcknowledgeBackfill(): () => void {
  const acknowledge = useMutation(api.experience.acknowledgeBackfill);
  return () => {
    acknowledge({}).catch(() => {
      /* Nothing to say: the banner is a notice, not a write the owner made. */
    });
  };
}
