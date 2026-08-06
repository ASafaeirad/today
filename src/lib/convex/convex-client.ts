import { ConvexReactClient } from "convex/react";

import { config } from "#lib/config.ts";

export const createConvexClient = () => new ConvexReactClient(config.convexUrl);
