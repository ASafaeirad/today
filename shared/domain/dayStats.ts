/**
 * The sole projection: one folded row per closed local date, plus a digest that
 * commits to the *inputs* of the fold and never to its counts. Committing to
 * the output would let a wrong fold agree with itself.
 */

import type { LocalDate } from "./date";
import type { Outcome } from "./outcome";

export interface InstanceLeaf {
  routineId: string;
  scheduleVersionId: string;
  outcome: Outcome;
  outcomeRev: number;
}

export interface DayFold {
  scheduled: number;
  done: number;
  skipped: number;
  missed: number;
  closed: boolean;
  digest: string;
}

const FNV_OFFSET_BASIS = 0xcbf2_9ce4_8422_2325n;
const FNV_PRIME = 0x0000_0100_0000_01b3n;
const MASK_64 = 0xffff_ffff_ffff_ffffn;

/**
 * Not a security hash and does not need to be: the failure being detected is a
 * bug, not an attack, and the canonical string is the contract rather than the
 * hash function.
 */
export function fnv1a64(input: string): string {
  let hash = FNV_OFFSET_BASIS;
  for (const byte of new TextEncoder().encode(input)) {
    hash = ((hash ^ BigInt(byte)) * FNV_PRIME) & MASK_64;
  }
  return hash.toString(16).padStart(16, "0");
}

/**
 * `outcomeRev` inside the leaf is load-bearing: without it the digest only
 * catches days whose outcome changed; with it, a re-tap landing on the same
 * outcome still moves the leaf, so a projection that agrees with the facts by
 * luck is reported as agreeing by luck.
 */
export function dayDigest(date: LocalDate, instances: readonly InstanceLeaf[]): string {
  const leaves = [...instances]
    .sort((a, b) => (a.routineId < b.routineId ? -1 : a.routineId > b.routineId ? 1 : 0))
    .map(
      (instance) =>
        `${instance.routineId}:${instance.scheduleVersionId}:${instance.outcome}:${instance.outcomeRev}`,
    );
  return fnv1a64(`${date}|${leaves.join(" ")}`);
}

export function foldDay(
  date: LocalDate,
  instances: readonly InstanceLeaf[],
  closed: boolean,
): DayFold {
  let done = 0;
  let skipped = 0;
  let missed = 0;
  for (const instance of instances) {
    if (instance.outcome === "done") done += 1;
    else if (instance.outcome === "skipped") skipped += 1;
    else missed += 1;
  }
  return {
    scheduled: instances.length,
    done,
    skipped,
    missed,
    closed,
    digest: dayDigest(date, instances),
  };
}
