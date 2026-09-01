import { ConvexAuthProvider as ConvexAuthProviderBase } from "@convex-dev/auth/react";

import { createConvexClient } from "./convex-client";

const convex = createConvexClient();

export function ConvexAuthProvider({ children }: { children: React.ReactNode }) {
  return <ConvexAuthProviderBase client={convex}>{children}</ConvexAuthProviderBase>;
}
