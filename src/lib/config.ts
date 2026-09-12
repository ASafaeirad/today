import { removeTrailingSlashes } from "@fullstacksjs/toolbox";
import * as v from "valibot";

const configSchema = v.object({
  convexUrl: v.pipe(v.string(), v.nonEmpty(), v.url()),
  version: v.pipe(v.string(), v.nonEmpty()),
});

export const config = v.parse(configSchema, {
  convexUrl: removeTrailingSlashes(import.meta.env.VITE_CONVEX_URL),
  version: import.meta.env.VITE_APP_VERSION ?? "dev",
});
