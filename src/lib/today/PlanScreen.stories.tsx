import { expect, fn, waitFor } from "storybook/test";

import preview from "#storybook/preview";

import type { RoutinePlan } from "./useRoutinePlan";

import { PlanScreen } from "./PlanScreen";

const add = fn<RoutinePlan["add"]>();
const remove = fn<RoutinePlan["remove"]>();
const onDone = fn();
let finishAdd: () => void;

const meta = preview.meta({
  component: PlanScreen,
  args: {
    plan: { routines: [], add, remove },
    onDone,
  },
  beforeEach: () => {
    add.mockReset();
    add.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishAdd = resolve;
        }),
    );
    remove.mockReset();
    onDone.mockReset();
  },
});

export const Empty = meta.story({
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole("textbox", { name: "new routine" });

    await userEvent.type(input, "Morning pages{Enter}");

    await expect(add).toHaveBeenCalledWith("Morning pages");
    await expect(input).toHaveAttribute("readonly");
    await expect(input).toHaveFocus();

    finishAdd();

    await waitFor(() => expect(input).toHaveValue(""));
    await expect(input).not.toHaveAttribute("readonly");
    await expect(input).toHaveFocus();
  },
});
