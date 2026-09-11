import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef } from "react";

import { api } from "#convex/_generated/api";

export interface OwnerSession {
  today: string;
  timezone: string;
  /** Instances are pinned through today, so the roster on screen is complete. */
  swept: boolean;
}

/**
 * The owner row is created on first use and its timezone frozen from the
 * browser's. Queries cannot sweep, so opening the app also runs the sweep once
 * per day the watermark is behind; the query flips `swept` as it catches up.
 */
export function useOwnerSession(): OwnerSession | undefined {
  const owner = useQuery(api.owners.current);
  const ensure = useMutation(api.owners.ensure);
  const sweep = useMutation(api.owners.sweep);
  const inFlight = useRef(false);

  const missing = owner === null;
  const behind = owner != null && owner.pinsThroughDate < owner.today;

  useEffect(() => {
    if (inFlight.current || (!missing && !behind)) return;
    inFlight.current = true;
    const write = missing
      ? ensure({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
      : sweep({});
    write
      .catch(() => {
        /* The next query update retries; nothing to say to the owner yet. */
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, [missing, behind, ensure, sweep]);

  if (owner == null) return undefined;
  return { today: owner.today, timezone: owner.timezone, swept: !behind };
}
