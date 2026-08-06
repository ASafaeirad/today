import { Link, Outlet, createRootRouteWithContext } from "@tanstack/react-router";

import { Text } from "#ui";

import type { RouterContext } from "../router-context";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: () => {
    return (
      <div>
        <Text as="p">404</Text>
        <Link to="/">Start Over</Link>
      </div>
    );
  },
});

function RootComponent() {
  return <Outlet />;
}
