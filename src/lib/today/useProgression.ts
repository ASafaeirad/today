import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";

import { api } from "#convex/_generated/api";

import type { ProgressionView } from "./experience";

/** How long a failed chunk waits before the walk is offered again. */
const RETRY_MS = 4_000;

/**
 * The banked side of progression, and the one write a read has to drive.
 *
 * Queries cannot write, so an owner whose closed history predates progression
 * arrives with nothing banked and the walk over that history is run from here,
 * a bounded chunk per call until it reports itself complete — the same shape as
 * the sweep. Every call is idempotent, so a second tab racing this one converges
 * instead of banking twice.
 *
 * A failed chunk is retried on a timer rather than left to the next query
 * update. Nothing else in the app drives this walk, and a failure does not move
 * the row the query is watching, so `behind` would stay true without ever
 * changing — and an owner who lost the network for one moment would sit on an
 * empty level for the rest of the session.
 */
export function useProgression(): ProgressionView | undefined {
  const progression = useQuery(api.experience.progression, {});
  const sync = useMutation(api.experience.sync);
  const inFlight = useRef(false);
  const retry = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [attempt, setAttempt] = useState(0);

  const behind = progression !== undefined && !progression.caughtUp;

  useEffect(() => () => clearTimeout(retry.current), []);

  useEffect(() => {
    if (inFlight.current || !behind) return;
    // Nothing to say to the owner when a chunk fails: the walk is catching
    // history up, not recording anything they just did.
    const again = () => setAttempt((count) => count + 1);
    inFlight.current = true;
    sync({})
      .catch(() => {
        retry.current = setTimeout(again, RETRY_MS);
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, [attempt, behind, sync]);

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
