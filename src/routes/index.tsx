import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: ({ context }) => {
    if (context.auth.isLoading) {
      return;
    }
    throw redirect({
      to: context.auth.isAuthenticated ? "/today" : "/sign-in",
    });
  },
});
