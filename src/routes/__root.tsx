import { Link, Outlet, createRootRouteWithContext } from "@tanstack/react-router";

import { AppShell } from "#lib/app/AppShell.tsx";
import { Text } from "#ui";

import type { RouterContext } from "../router-context";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: () => {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <Text as="p">404</Text>
        <Link to="/">Start Over</Link>
      </div>
    );
  },
});

function RootComponent() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
