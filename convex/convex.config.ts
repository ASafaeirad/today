import aggregate from "@convex-dev/aggregate/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();

/** Overall rate windows: one namespace per owner. */
app.use(aggregate, { name: "instancesByOwner" });
/** Per-routine rate windows: one namespace per (owner, routine). */
app.use(aggregate, { name: "instancesByRoutine" });

export default app;
