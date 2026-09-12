import { expect, fn, screen, waitFor } from "storybook/test";

import preview from "#storybook/preview";

import type { RoutineView } from "./ledger";
import type { RoutinePlan } from "./useRoutinePlan";

import { PlanScreen } from "./PlanScreen";

const add = fn<RoutinePlan["add"]>();
const remove = fn<RoutinePlan["remove"]>();
const onDone = fn();
let finishAdd: () => void;
let finishRemove: () => void;

const morningPages: RoutineView = {
  _id: "routine-morning-pages" as RoutineView["_id"],
  name: "Morning pages",
  state: "active",
  planned: "active",
  days: [0, 1, 2, 3, 4, 5, 6],
  scheduleVersionId: "schedule-morning-pages" as RoutineView["scheduleVersionId"],
};

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
    remove.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishRemove = resolve;
        }),
    );
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

export const WithRoutine = meta.story({
  args: {
    plan: { routines: [morningPages], add, remove },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "remove" }));

    await expect(screen.getByRole("dialog")).toHaveTextContent(
      'Retire "Morning pages" after today?',
    );
    await expect(remove).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(remove).not.toHaveBeenCalled();

    await userEvent.click(canvas.getByRole("button", { name: "remove" }));
    await userEvent.click(screen.getByRole("button", { name: "remove routine" }));

    await expect(remove).toHaveBeenCalledOnce();
    await expect(remove).toHaveBeenCalledWith(morningPages);
    await expect(screen.getByRole("button", { name: "remove routine" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await expect(screen.getByRole("button", { name: "cancel" })).toBeDisabled();

    finishRemove();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  },
});

export const RemovalRefused = meta.story({
  args: {
    plan: { routines: [morningPages], add, remove },
  },
  play: async ({ canvas, userEvent }) => {
    remove.mockRejectedValueOnce(new Error("Routine could not be retired"));

    await userEvent.click(canvas.getByRole("button", { name: "remove" }));
    await userEvent.click(screen.getByRole("button", { name: "remove routine" }));

    await expect(screen.findByRole("alert")).resolves.toHaveTextContent(
      "Routine could not be retired",
    );
    await expect(screen.getByRole("dialog")).toBeVisible();
    await expect(screen.getByRole("button", { name: "cancel" })).toBeEnabled();
  },
});
