import { expect, fn, userEvent } from "storybook/test";

import preview from "#storybook/preview";

import { BackfillBar } from "./ProgressionBar";

const meta = preview.meta({
  component: BackfillBar,
  parameters: { layout: "fullscreen" },
  args: { backfill: { days: 84, experience: 1_407 }, onDismiss: fn() },
});

/**
 * The one line an owner's existing history gets. It is a summary, not a
 * ceremony: no old day is replayed, and the notice does not come back.
 */
export const Default = meta.story({
  play: async ({ args, canvas }) => {
    await expect(
      canvas.getByText(
        "84 closed days summarized · 1407 xp carried in · lv 12 WARDEN · no day-by-day replay",
      ),
    ).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "understood" }));
    await expect(args.onDismiss).toHaveBeenCalled();
  },
});

/** An owner with nothing to carry in is told nothing at all. */
export const Nothing = meta.story({
  args: { backfill: null },
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toBeEmptyDOMElement();
  },
});
