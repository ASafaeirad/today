import { type ConvexAuthActionsContext, useAuthActions } from "@convex-dev/auth/react";
import { expect, fn, mocked } from "storybook/test";

import preview from "#storybook/preview";

import { SignInCard } from "./SignInCard";

const signIn = fn<ConvexAuthActionsContext["signIn"]>();
const signOut = fn<ConvexAuthActionsContext["signOut"]>();

const meta = preview.meta({
  component: SignInCard,
  args: { redirectTo: "/today" },
  beforeEach: () => {
    signIn.mockReset();
    signOut.mockReset();
    mocked(useAuthActions).mockReturnValue({ signIn, signOut });
  },
});

export const Default = meta.story({});

export const RejectedSignIn = meta.story({
  beforeEach: () => {
    signIn.mockRejectedValueOnce(new Error("GitHub sign-in is unavailable"));
  },
  play: async ({ canvas, userEvent }) => {
    const button = canvas.getByRole("button", { name: "Sign in with GitHub" });
    await userEvent.click(button);

    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "! GitHub sign-in is unavailable",
    );
    await expect(button).toBeEnabled();
    await expect(signIn).toHaveBeenCalledWith("github", { redirectTo: "/today" });
  },
});

export const SynchronousFailure = meta.story({
  beforeEach: () => {
    signIn.mockImplementationOnce(() => {
      throw new Error("Could not start sign-in");
    });
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Sign in with GitHub" }));

    await expect(await canvas.findByRole("alert")).toHaveTextContent("! Could not start sign-in");
  },
});

export const UnknownFailure = meta.story({
  beforeEach: () => {
    signIn.mockRejectedValueOnce("provider failed");
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Sign in with GitHub" }));

    await expect(await canvas.findByRole("alert")).toHaveTextContent("! Sign in failed");
  },
});
