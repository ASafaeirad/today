import { expect, screen, waitFor } from "storybook/test";

import preview from "#storybook/preview";

import { useStoryConsoleModel } from "./console/storyAdapter";
import { TodayConsoleView } from "./TodayConsole";

function StoryConsole() {
  return <TodayConsoleView model={useStoryConsoleModel()} />;
}

const meta = preview.meta({
  component: StoryConsole,
  parameters: { layout: "fullscreen" },
});

export const CrossModeNavigation = meta.story({
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "previous day" }));
    await expect(canvas.getByText(/looking back/u)).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "next day" }));
    await waitFor(() => expect(canvas.queryByText(/looking back/u)).not.toBeInTheDocument());
    const log = canvas.getByRole("button", { name: "log" });
    await userEvent.click(log);
    await expect(log).toHaveAttribute("aria-pressed", "true");
    await userEvent.keyboard("J");
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByText(/looking back/u)).toBeInTheDocument();
    await userEvent.keyboard("T");
    await waitFor(() => expect(canvas.queryByText(/looking back/u)).not.toBeInTheDocument());
  },
});

export const CloseHotkeyOnlyWorksInTrackMode = meta.story({
  play: async ({ userEvent }) => {
    await userEvent.keyboard("P");
    await userEvent.keyboard("Z");
    await expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    await userEvent.keyboard("Z");
    await expect(screen.getByRole("dialog")).toBeInTheDocument();
  },
});

export const OptimisticRefusal = meta.story({
  play: async ({ canvas, userEvent }) => {
    const skipped = canvas.getAllByRole("button", { name: "skipped" })[0]!;
    await userEvent.click(skipped);
    await expect(skipped).toHaveAttribute("aria-pressed", "true");
    await expect(canvas.findByRole("alert")).resolves.toHaveTextContent("No skip is available.");
    await waitFor(() => expect(skipped).toHaveAttribute("aria-pressed", "false"));
  },
});

export const BacklogClose = meta.story({
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "resolve" }));
    await expect(screen.getByRole("dialog")).toBeInTheDocument();
    await expect(screen.getByText(/RESOLVE/u)).toBeInTheDocument();
  },
});

export const BackfillAcknowledgment = meta.story({
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText(/4 closed days summarized/u)).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "understood" }));
    await waitFor(() =>
      expect(canvas.queryByText(/4 closed days summarized/u)).not.toBeInTheDocument(),
    );
  },
});
