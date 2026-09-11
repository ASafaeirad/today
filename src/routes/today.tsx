import { createFileRoute, redirect } from "@tanstack/react-router";

import { TodayConsole } from "#lib/today/TodayConsole.tsx";
import { useOwnerSession } from "#lib/today/useOwnerSession.ts";
import { Text } from "#ui";

export const Route = createFileRoute("/today")({
  beforeLoad: ({ context, location }) => {
    if (context.auth.isLoading) {
      return;
    }
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: "/sign-in", search: { redirectTo: location.href } });
    }
  },
  component: TodayPage,
});

function TodayPage() {
  const session = useOwnerSession();

  if (session === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Text tone="muted" className="animate-type overflow-hidden whitespace-nowrap">
          opening the ledger ...
        </Text>
      </div>
    );
  }

  return <TodayConsole today={session.today} timezone={session.timezone} />;
}
