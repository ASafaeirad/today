import { createFileRoute } from "@tanstack/react-router";

import { SignInCard } from "#lib/auth/SignInCard.tsx";

export const Route = createFileRoute("/sign-in")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: SignInPage,
});

function SignInPage() {
  const { redirect } = Route.useSearch();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <SignInCard redirectTo={redirect} />
    </div>
  );
}
