import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";

import { api } from "#convex/_generated/api";

import type { ProgressionView } from "../experience";
import type { Loadable } from "./types";

const RETRY_MS = 4_000;

/** Owns the full browser lifecycle for bounded Experience catch-up. */
export function useProgressionRead(): {
  progression: Loadable<ProgressionView>;
  acknowledgeBackfill: () => void;
} {
  const value = useQuery(api.experience.progression, {});
  const sync = useMutation(api.experience.sync);
  const acknowledge = useMutation(api.experience.acknowledgeBackfill);
  const inFlight = useRef(false);
  const retry = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [attempt, setAttempt] = useState(0);
  const behind = value !== undefined && !value.caughtUp;

  useEffect(() => () => clearTimeout(retry.current), []);

  useEffect(() => {
    if (inFlight.current || !behind) return;
    const tryAgain = () => setAttempt((count) => count + 1);
    inFlight.current = true;
    sync({})
      .catch(() => {
        retry.current = setTimeout(tryAgain, RETRY_MS);
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, [attempt, behind, sync]);

  return {
    progression: value === undefined ? { status: "loading" } : { status: "ready", value },
    acknowledgeBackfill: () => {
      acknowledge({}).catch(() => {
        /* This dismisses a notice rather than recording an owner command. */
      });
    },
  };
}
