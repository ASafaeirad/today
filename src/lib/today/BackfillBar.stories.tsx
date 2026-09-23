import { expect, fn, userEvent } from "storybook/test";

import preview from "#storybook/preview";

import { BackfillBar } from "./ProgressionBar";

const meta = preview.meta({
  component: BackfillBar,
  parameters: { layout: "fullscreen" },
  args: { backfill: { days: 84, experience: 1_407 }, onDismiss: fn() },
});

/** The one-time receipt for existing closed history. */
export const Default = meta.story({
  play: async ({ args, canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "We counted 84 closed days and added 1,407 XP to your total.",
    );

    await userEvent.click(canvas.getByRole("button", { name: "dismiss" }));
    await expect(args.onDismiss).toHaveBeenCalled();
  },
});

/** The notice wraps beside a thumb-sized dismissal control on a phone. */
export const Mobile = meta.story({
  globals: { viewport: { value: "mobile1" } },
  play: async ({ args, canvas, canvasElement }) => {
    const notice = canvas.getByRole("status").parentElement;
    const dismiss = canvas.getByRole("button", { name: "dismiss" });

    await expect(canvasElement.getBoundingClientRect().width).toBeLessThanOrEqual(400);
    await expect(notice).not.toBeNull();
    await expect(notice!.scrollWidth).toBeLessThanOrEqual(notice!.clientWidth);
    await expect(dismiss.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);

    await userEvent.click(dismiss);
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
