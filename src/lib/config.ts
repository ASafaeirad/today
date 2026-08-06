import * as v from "valibot";

const configSchema = v.object({
  convexUrl: v.pipe(v.string(), v.nonEmpty(), v.url()),
});

export const config = v.parse(configSchema, {
  convexUrl: import.meta.env.VITE_CONVEX_URL,
});
