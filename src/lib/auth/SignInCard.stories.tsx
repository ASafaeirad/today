import { type ConvexAuthActionsContext, useAuthActions } from "@convex-dev/auth/react";
import { expect, fn, mocked } from "storybook/test";

import preview from "#storybook/preview";

import { SignInCard } from "./SignInCard";

const signIn = fn<ConvexAuthActionsContext["signIn"]>();
const signOut = fn<ConvexAuthActionsContext["signOut"]>();
const onEnter = fn();

/** A handoff the provider never answers, the way a redirect never comes back. */
const pending = () => new Promise<never>(() => {});

const viewer = {
  name: "Vigil Owner",
  email: "owner@example.com",
};

const meta = preview.meta({
  component: SignInCard,
  args: { redirectTo: "/today", onEnter },
  beforeEach: () => {
    signIn.mockReset();
    signOut.mockReset();
    onEnter.mockReset();
    mocked(useAuthActions).mockReturnValue({ signIn, signOut });
  },
});

const openButton = { name: /continue with github/i };

export const Default = meta.story({
  play: async ({ canvas }) => {
    await expect(canvas.getByText("WELCOME")).toBeInTheDocument();
    await expect(canvas.getByRole("button", openButton)).toBeEnabled();
  },
});

export const HandingOff = meta.story({
  beforeEach: () => {
    signIn.mockImplementationOnce(pending);
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", openButton));

    await expect(await canvas.findByText("handing off to github.com")).toBeInTheDocument();
    await expect(canvas.getByRole("meter")).toHaveAttribute("aria-valuenow");
    await expect(signIn).toHaveBeenCalledWith("github", { redirectTo: "/today" });
  },
});

export const KeyboardHandoff = meta.story({
  beforeEach: () => {
    signIn.mockImplementation(pending);
  },
  play: async ({ canvas, userEvent }) => {
    // Return opens the door whether or not the button holds focus, so the
    // button's own activation must not open a second handoff behind the key's.
    canvas.getByRole("button", openButton).focus();
    await userEvent.keyboard("{Enter}");

    await expect(await canvas.findByText("handing off to github.com")).toBeInTheDocument();
    await expect(signIn).toHaveBeenCalledTimes(1);
  },
});

export const RejectedSignIn = meta.story({
  beforeEach: () => {
    signIn.mockRejectedValueOnce(new Error("GitHub sign-in is unavailable"));
  },
  play: async ({ canvas, userEvent }) => {
    const button = canvas.getByRole("button", openButton);
    await userEvent.click(button);

    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "! GitHub sign-in is unavailable",
    );
    await expect(canvas.getByText("DENIED")).toBeInTheDocument();
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
    await userEvent.click(canvas.getByRole("button", openButton));

    await expect(await canvas.findByRole("alert")).toHaveTextContent("! Could not start sign-in");
  },
});

export const UnknownFailure = meta.story({
  beforeEach: () => {
    signIn.mockRejectedValueOnce("provider failed");
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", openButton));

    await expect(await canvas.findByRole("alert")).toHaveTextContent("! Sign in failed");
  },
});

/** A session is already open: the card names it rather than opening another. */
export const Authorized = meta.story({
  args: { viewer },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText("AUTHORIZED")).toBeInTheDocument();
    await expect(canvas.getByText("VO")).toBeInTheDocument();
    await expect(canvas.getByText(viewer.name)).toBeInTheDocument();
    await expect(canvas.getByText(viewer.email)).toBeInTheDocument();
    await expect(canvas.queryByRole("button", openButton)).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "ENTER TODAY" }));

    await expect(onEnter).toHaveBeenCalledTimes(1);
  },
});

/** The email stands in for a name the provider never sent. */
export const AuthorizedWithoutName = meta.story({
  args: { viewer: { email: "owner@example.com" } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("owner")).toBeInTheDocument();
    await expect(canvas.getByText("O")).toBeInTheDocument();
  },
});

export const SwitchesOwner = meta.story({
  args: { viewer },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "sign in as someone else" }));

    await expect(signOut).toHaveBeenCalledTimes(1);
  },
});
