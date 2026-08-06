import { createFileRoute, redirect } from "@tanstack/react-router";

import { SignInCard } from "#lib/auth/SignInCard.tsx";

export const Route = createFileRoute("/sign-in")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirectTo: typeof search.redirectTo === "string" ? search.redirectTo : undefined,
  }),
  beforeLoad: ({ context, search }) => {
    if (context.auth.isLoading) {
      return;
    }
    if (context.auth.isAuthenticated) {
      throw redirect({ to: search.redirectTo ?? "/today" });
    }
  },
  component: SignInPage,
});

function SignInPage() {
  const { redirectTo } = Route.useSearch();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <SignInCard redirectTo={redirectTo} />
    </div>
  );
}
