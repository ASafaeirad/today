import { useAuthActions } from "@convex-dev/auth/react";
import { getInitials } from "@fullstacksjs/toolbox";
import { useHotkeys } from "@tanstack/react-hotkeys";
import { useEffect, useRef, useState } from "react";

import {
  Bar,
  Button,
  Heading,
  Kbd,
  Meter,
  MeterIndicator,
  MeterTrack,
  Panel,
  PanelBody,
  Text,
} from "#ui";

/** The handoff meter steps rather than eases, like everything else here. */
const STEP_MS = 140;
const STEP = 12;
/** The meter never claims the last stretch: GitHub, not us, closes the handoff. */
const CEILING = 96;

/** Where the card stands with the provider. The header bar prints it. */
type Stage = "idle" | "authorizing" | "denied";

const STAGE_LABEL: Record<Stage, string> = {
  idle: "WELCOME",
  authorizing: "HANDOFF",
  denied: "DENIED",
};

export interface SignInViewer {
  name?: string;
  email?: string;
}

interface Props {
  redirectTo?: string;
  /** An open session: the card confirms this one instead of opening another. */
  viewer?: SignInViewer | null;
  /** Walks the owner into the ledger once they accept the session. */
  onEnter?: () => void;
}

export function SignInCard({ redirectTo = "/", viewer, onEnter }: Props) {
  const { signIn, signOut } = useAuthActions();
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string>();
  // A handoff outlives the state that started it: the provider can still answer
  // a cancelled attempt, and a second Enter can land before the stage repaints.
  // The counter is the identity an answer has to match to be listened to.
  const attempt = useRef(0);
  const handingOff = useRef(false);

  useEffect(() => {
    if (stage !== "authorizing") return;
    const tick = setInterval(() => {
      setProgress((filled) => Math.min(CEILING, filled + STEP));
    }, STEP_MS);
    return () => clearInterval(tick);
  }, [stage]);

  const authorized = viewer != null;

  const open = async () => {
    if (handingOff.current) return;
    handingOff.current = true;
    attempt.current += 1;
    const id = attempt.current;
    setError(undefined);
    setProgress(STEP);
    setStage("authorizing");

    try {
      await signIn("github", redirectTo ? { redirectTo } : undefined);
      if (attempt.current !== id) return;
      // The browser is on its way to github.com; the meter closes behind it.
      setProgress(100);
    } catch (failure) {
      if (attempt.current !== id) return;
      handingOff.current = false;
      setError(failure instanceof Error ? failure.message : "Sign in failed");
      setStage("denied");
    }
  };

  const leave = () => {
    attempt.current += 1;
    handingOff.current = false;
    setProgress(0);
    setStage("idle");
    void signOut();
  };

  useHotkeys([
    {
      hotkey: "Enter",
      callback: open,
      options: { enabled: !authorized && stage !== "authorizing" },
    },
  ]);

  const refusal = stage === "denied" ? `! ${error}` : null;

  return (
    <Panel className="w-full max-w-110">
      <Bar variant="accent" placement="none" className="justify-between">
        <span className="px-2.5 py-1.25">SIGN IN</span>
        <span className="px-2.5 py-1.25">
          {authorized
            ? "AUTHORIZED"
            : stage === "authorizing"
              ? `${STAGE_LABEL.authorizing} · ${progress}%`
              : STAGE_LABEL[stage]}
        </span>
      </Bar>

      <PanelBody>
        <Heading as="h1" size="base" prompt>
          auth --provider github
        </Heading>
        <Text tone="muted">A record needs an owner. Open yours.</Text>

        {refusal !== null && (
          // Inside a filled tone the ink is the tone's contrast, so the words
          // inherit their color from the block rather than naming one.
          <div
            role="alert"
            className="tone-missed tone-bg mt-4 -mb-1 animate-cut px-2.25 py-2 text-xs tracking-widest uppercase"
          >
            {refusal}
          </div>
        )}

        {authorized ? (
          <Session viewer={viewer} onEnter={onEnter} onLeave={leave} />
        ) : stage === "authorizing" ? (
          <Handoff progress={progress} />
        ) : (
          <Button variant="accent" size="lg" block onClick={open}>
            <Kbd variant="hint">&#8629;</Kbd>
            CONTINUE WITH GITHUB
          </Button>
        )}
      </PanelBody>
    </Panel>
  );
}

/** The wait, while the browser is on its way to the provider. */
function Handoff({ progress }: { progress: number }) {
  return (
    <div className="mt-4 flex flex-col gap-1.5 border border-border p-2.5">
      <span className="animate-blink text-xs tracking-widest uppercase">
        handing off to github.com
      </span>
      <Meter tone="ink" value={progress} aria-label="Handing off to github.com">
        <MeterTrack>
          <MeterIndicator />
        </MeterTrack>
      </Meter>
    </div>
  );
}

interface SessionProps {
  viewer: SignInViewer;
  onEnter?: () => void;
  onLeave: () => void;
}

/** Who came back, before they are taken at their word. */
function Session({ viewer, onEnter, onLeave }: SessionProps) {
  const handle = viewer.name ?? viewer.email?.split("@")[0] ?? "owner";

  return (
    <>
      <div className="tone-done tone-tint tone-border mt-4 mb-2.5 flex items-center gap-2.5 border p-2.5">
        <span className="bg-inverted px-1.75 py-1.5 text-xs text-inverted-foreground uppercase">
          {getInitials(handle)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm">{handle}</span>
          <span className="truncate text-xs text-muted-foreground">{viewer.email}</span>
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <Button variant="accent" size="lg" block onClick={onEnter}>
          ENTER TODAY
        </Button>
        <Button variant="outline" size="lg" block onClick={onLeave}>
          sign in as someone else
        </Button>
      </div>
    </>
  );
}
