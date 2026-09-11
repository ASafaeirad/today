import { useQuery } from "convex/react";

import { api } from "#convex/_generated/api";

import type { BalanceView } from "./console";

/**
 * The Balance, as the console needs it. Recomputed from the horizon on every
 * read, so a mark that spends or releases a skip moves this line with it and
 * the figure on screen is the figure the next skip is charged against.
 */
export function useBalance(): BalanceView | undefined {
  return useQuery(api.balance.current, {});
}
