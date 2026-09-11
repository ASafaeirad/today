import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";

import { Bar, Button, Heading, Panel, PanelBody, Text } from "#ui";

interface Props {
  redirectTo?: string;
}

export function SignInCard({ redirectTo = "/" }: Props) {
  const { signIn } = useAuthActions();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  return (
    <Panel className="mx-auto w-full max-w-sm">
      <Bar variant="accent" placement="none" className="justify-between">
        <span className="px-2.5 py-1.25">SIGN IN</span>
        <span className="px-2.5 py-1.25">TODAY</span>
      </Bar>
      <PanelBody>
        <Heading as="h1" size="base" prompt>
          auth --provider github
        </Heading>
        <Text tone="muted">A record needs an owner. Open yours.</Text>
        <Button
          variant="accent"
          size="lg"
          block
          loading={pending}
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
          <Text tone="record" className="tone-missed" size="sm">
            ! {error}
          </Text>
        ) : null}
      </PanelBody>
    </Panel>
  );
}
