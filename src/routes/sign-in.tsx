import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useConvexAuth, useQuery } from "convex/react";

import { api } from "#convex/_generated/api";
import { SignInCard } from "#lib/auth/SignInCard.tsx";
import { Text } from "#ui";

export const Route = createFileRoute("/sign-in")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirectTo: typeof search.redirectTo === "string" ? search.redirectTo : undefined,
  }),
  component: SignInPage,
});

/**
 * An owner who is already signed in is not bounced off this screen: the card
 * names the session it found and asks before walking them in, because the other
 * thing they may have come here to do is hand the ledger to someone else.
 */
function SignInPage() {
  const { redirectTo } = Route.useSearch();
  const navigate = useNavigate();
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.current);

  const toViewer = (u: typeof user) => (u ? { name: u.name, email: u.email } : null);

  return (
    <div className="flex h-full items-center justify-center bg-background px-5 py-7">
      <div className="flex w-full max-w-110 flex-col gap-3.5">
        <Text size="lg" tracking="brand" caps>
          today
        </Text>
        {isAuthenticated && user === undefined ? (
          <Text tone="muted" className="animate-type overflow-hidden whitespace-nowrap">
            reading the session ...
          </Text>
        ) : (
          <SignInCard
            redirectTo={redirectTo}
            viewer={toViewer(user)}
            onEnter={() => {
              void navigate({ to: redirectTo ?? "/today" });
            }}
          />
        )}
      </div>
    </div>
  );
}
