/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as balance from "../balance.js";
import type * as days from "../days.js";
import type * as http from "../http.js";
import type * as lib_aggregates from "../lib/aggregates.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_balance from "../lib/balance.js";
import type * as lib_days from "../lib/days.js";
import type * as lib_functions from "../lib/functions.js";
import type * as lib_instances from "../lib/instances.js";
import type * as lib_owner from "../lib/owner.js";
import type * as lib_projections from "../lib/projections.js";
import type * as lib_repair from "../lib/repair.js";
import type * as lib_schedules from "../lib/schedules.js";
import type * as lib_sweep from "../lib/sweep.js";
import type * as marks from "../marks.js";
import type * as owners from "../owners.js";
import type * as rates from "../rates.js";
import type * as rebuild from "../rebuild.js";
import type * as repair from "../repair.js";
import type * as routines from "../routines.js";
import type * as schedules from "../schedules.js";
import type * as users from "../users.js";
import type * as verify from "../verify.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  balance: typeof balance;
  days: typeof days;
  http: typeof http;
  "lib/aggregates": typeof lib_aggregates;
  "lib/auth": typeof lib_auth;
  "lib/balance": typeof lib_balance;
  "lib/days": typeof lib_days;
  "lib/functions": typeof lib_functions;
  "lib/instances": typeof lib_instances;
  "lib/owner": typeof lib_owner;
  "lib/projections": typeof lib_projections;
  "lib/repair": typeof lib_repair;
  "lib/schedules": typeof lib_schedules;
  "lib/sweep": typeof lib_sweep;
  marks: typeof marks;
  owners: typeof owners;
  rates: typeof rates;
  rebuild: typeof rebuild;
  repair: typeof repair;
  routines: typeof routines;
  schedules: typeof schedules;
  users: typeof users;
  verify: typeof verify;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  instancesByOwner: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"instancesByOwner">;
  instancesByRoutine: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"instancesByRoutine">;
};
