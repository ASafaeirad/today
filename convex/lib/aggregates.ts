import { TableAggregate } from "@convex-dev/aggregate";
import { range as generateRange, isEmpty } from "@fullstacksjs/toolbox";

import type { LocalDate } from "#domain/date";
import type { Outcome } from "#domain/outcome";

import type { DataModel, Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

import { components } from "../_generated/api";

/**
 * The counting component owns no facts, only counts over Instances. Dropping it
 * costs no migration: the recount that verifies it is the fallback that
 * replaces it.
 *
 * The sort key is `[state, localDate]`. `state` is the settled Outcome, or
 * `pending` while the day is not yet closed, because only settled Instances
 * count. Bounding on `[state, from] .. [state, to]` therefore counts exactly
 * one outcome over one inclusive date range.
 */
export type InstanceState = Outcome | "pending";
export type InstanceKey = [InstanceState, LocalDate];

export function instanceState(doc: Doc<"instances">): InstanceState {
  return doc.closedAt === null ? "pending" : doc.outcome;
}

function sortKey(doc: Doc<"instances">): InstanceKey {
  return [instanceState(doc), doc.date];
}

export function routineNamespace(ownerId: Id<"owners">, routineId: Id<"routines">): string {
  return `${ownerId}:${routineId}`;
}

interface InstanceAggregateType {
  Namespace: string;
  Key: InstanceKey;
  DataModel: DataModel;
  TableName: "instances";
}

/** Overall windows: week, rolling month, month, year, year over year. */
export const instancesByOwner = new TableAggregate<InstanceAggregateType>(
  components.instancesByOwner,
  { namespace: (doc) => doc.ownerId, sortKey },
);

/** Arbitrary per-routine spans, which no rollup could serve without a scan. */
export const instancesByRoutine = new TableAggregate<InstanceAggregateType>(
  components.instancesByRoutine,
  {
    namespace: (doc) => routineNamespace(doc.ownerId, doc.routineId),
    sortKey,
  },
);

const aggregates = [instancesByOwner, instancesByRoutine];

/**
 * Every write to `instances` goes through these three functions.
 *
 * `tolerateDrift` is for the repair path only. On the hot path a key that is
 * already missing, or already present, means a writer bypassed the resolver,
 * and the throw is the alarm. Repair is the one path that is *supposed* to meet
 * a tree disagreeing with the facts, so it converges on the right entry instead
 * of falling over. A tree that disagrees under some third key is not repaired
 * cell by cell: it owns no facts, so `rebuild.aggregates` folds the whole thing
 * back from the Instances.
 */
export async function aggregateInsert(
  ctx: MutationCtx,
  doc: Doc<"instances">,
  tolerateDrift = false,
) {
  for (const aggregate of aggregates) {
    await (tolerateDrift ? aggregate.insertIfDoesNotExist(ctx, doc) : aggregate.insert(ctx, doc));
  }
}

export async function aggregateReplace(
  ctx: MutationCtx,
  oldDoc: Doc<"instances">,
  newDoc: Doc<"instances">,
  tolerateDrift = false,
) {
  for (const aggregate of aggregates) {
    if (tolerateDrift) {
      await aggregate.deleteIfExists(ctx, oldDoc);
      await aggregate.insertIfDoesNotExist(ctx, newDoc);
    } else {
      await aggregate.replace(ctx, oldDoc, newDoc);
    }
  }
}

export async function aggregateDelete(
  ctx: MutationCtx,
  doc: Doc<"instances">,
  tolerateDrift = false,
) {
  for (const aggregate of aggregates) {
    await (tolerateDrift ? aggregate.deleteIfExists(ctx, doc) : aggregate.delete(ctx, doc));
  }
}

export interface StateRange {
  state: InstanceState;
  from: LocalDate;
  to: LocalDate;
}

/**
 * Count several states over their inclusive local-date ranges, in one call.
 *
 * Batching is what keeps a rate answer inside the document budget: the ranges
 * of one answer share the top of the tree, and the component reads those nodes
 * once for the batch instead of once per count. An empty range is answered
 * without asking.
 */
export async function countStates(
  ctx: QueryCtx | MutationCtx,
  scope: {
    aggregate: TableAggregate<InstanceAggregateType>;
    namespace: string;
  },
  ranges: readonly StateRange[],
): Promise<number[]> {
  const asked = ranges
    .map((range, index) => ({ range, index }))
    .filter(({ range }) => range.from <= range.to);

  const counts = generateRange(ranges.length).fill(0);
  if (isEmpty(asked)) return counts;

  const answers = await scope.aggregate.countBatch(
    ctx,
    asked.map(({ range }) => ({
      namespace: scope.namespace,
      bounds: {
        lower: { key: [range.state, range.from] as InstanceKey, inclusive: true },
        upper: { key: [range.state, range.to] as InstanceKey, inclusive: true },
      },
    })),
  );

  asked.forEach(({ index }, position) => {
    counts[index] = answers[position]!;
  });
  return counts;
}

/**
 * A rate answer asks five ranges of one tree, so the depth it walks is what the
 * document budget is spent on. Wide nodes buy depth back: measured over 1,356
 * Instances, a year-wide count reads 58 documents at the component's default of
 * 16 and 34 at 128, against a limit of 40. The usual price of a wide node is
 * write contention, and this ledger has one owner writing from one device at a
 * time, so there is nobody to contend with.
 *
 * See the adoption gate in `convex/agreement.test.ts` for the measurement. This
 * is a knob, not a decision: if a real history reads over the limit even here,
 * the answer is to drop the component and serve rates from `rates.recount`.
 */
export const MAX_NODE_SIZE = 128;

/**
 * Creates one namespace's tree at the size above. Called when the namespace's
 * subject is created - an owner, or a routine - so the tree it clears is always
 * an empty one.
 */
export async function initNamespace(ctx: MutationCtx, namespace: string) {
  const aggregate = namespace.includes(":") ? instancesByRoutine : instancesByOwner;
  await aggregate.clear(ctx, { namespace, maxNodeSize: MAX_NODE_SIZE });
}

/**
 * The tree is disposable: it owns no facts, only counts over Instances. Scoped
 * to one owner, so rebuilding one owner's counts cannot drop another's.
 */
export async function clearOwnerAggregates(
  ctx: MutationCtx,
  ownerId: Id<"owners">,
  routineIds: readonly Id<"routines">[],
) {
  await instancesByOwner.clear(ctx, {
    namespace: ownerId,
    maxNodeSize: MAX_NODE_SIZE,
  });
  for (const routineId of routineIds) {
    await instancesByRoutine.clear(ctx, {
      namespace: routineNamespace(ownerId, routineId),
      maxNodeSize: MAX_NODE_SIZE,
    });
  }
}
