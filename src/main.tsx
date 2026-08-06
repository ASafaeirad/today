import "./styles.css";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import { useEffect } from "react";
import ReactDOM from "react-dom/client";

import { ConvexAuthProvider } from "#lib/convex/ConvexAuthProvider.tsx";

import type { RouterContext } from "./router-context";

import { routeTree } from "./routeTree.gen";

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultStaleTime: 5000,
  scrollRestoration: true,
  context: {
    auth: {
      isAuthenticated: false,
      isLoading: true,
    },
  } satisfies RouterContext,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function RouterWithAuth() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  useEffect(() => {
    void router.invalidate();
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return <RouterProvider router={router} context={{ auth: { isAuthenticated, isLoading } }} />;
}

const rootElement = document.getElementById("app")!;

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <ConvexAuthProvider>
      <RouterWithAuth />
    </ConvexAuthProvider>,
  );
}
