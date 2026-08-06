import { useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Text } from "#ui";

interface Props {
  redirectTo?: any;
}

export function SignInCard({ redirectTo = "/" }: Props) {
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const router = useRouter();

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
            router.navigate(redirectTo);
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
