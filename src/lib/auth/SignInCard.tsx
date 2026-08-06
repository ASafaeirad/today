import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Text } from "#ui";

interface Props {
  redirectTo?: string;
}

export function SignInCard({ redirectTo = "/" }: Props) {
  const { signIn } = useAuthActions();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Welcome to Today.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          loading={pending}
          block
          onClick={() => {
            setError(undefined);
            setPending(true);
            signIn("github", redirectTo ? { redirectTo } : undefined)
              .catch((signInError) => {
                setError(signInError instanceof Error ? signInError.message : "Sign in failed");
              })
              .finally(() => {
                setPending(false);
              });
          }}
        >
          Sign in with GitHub
        </Button>
        {error ? (
          <Text className="mt-2 block text-destructive" size="sm">
            {error}
          </Text>
        ) : null}
      </CardContent>
    </Card>
  );
}
