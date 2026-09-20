import { useState } from "react";
import { expect, fn, screen, waitFor } from "storybook/test";

import preview from "#storybook/preview";

import type { CommandResult, PlanModel, RoutineView } from "./console";

import { PlanScreen } from "./PlanScreen";

const add = fn<(name: string) => Promise<void>>();
const remove = fn<(routine: RoutineView) => Promise<void>>();
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

function PlanHarness({ routines }: { routines: RoutineView[] }) {
  const [workflow, setWorkflow] = useState<PlanModel["workflow"]>({ state: "idle" });

  const plan: PlanModel = {
    routines: { status: "ready", value: routines },
    workflow,
    add: async (name): Promise<CommandResult> => {
      setWorkflow({ state: "adding" });
      try {
        await add(name);
        setWorkflow({ state: "idle" });
        return { ok: true };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        setWorkflow({ state: "refused", operation: "add", reason });
        return { ok: false, reason };
      }
    },
    requestRetirement: (routine) => setWorkflow({ state: "confirming", routine }),
    cancelRetirement: () => setWorkflow({ state: "idle" }),
    confirmRetirement: async (): Promise<CommandResult> => {
      if (workflow.state !== "confirming" && workflow.state !== "refused") {
        return { ok: false, reason: "No Routine is awaiting retirement." };
      }
      if (workflow.state === "refused" && workflow.operation !== "retire") {
        return { ok: false, reason: workflow.reason };
      }
      const { routine } = workflow;
      setWorkflow({ state: "retiring", routine });
      try {
        await remove(routine);
        setWorkflow({ state: "idle" });
        return { ok: true };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        setWorkflow({ state: "refused", operation: "retire", routine, reason });
        return { ok: false, reason };
      }
    },
  };

  return <PlanScreen plan={plan} onDone={onDone} />;
}

const meta = preview.meta({
  component: PlanHarness,
  args: { routines: [] },
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
    finishAdd();
    await waitFor(() => expect(input).toHaveValue(""));
    await expect(input).not.toHaveAttribute("readonly");
  },
});

export const WithRoutine = meta.story({
  args: { routines: [morningPages] },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "remove" }));
    await expect(screen.findByRole("dialog")).resolves.toHaveTextContent(
      'Retire "Morning pages" after today?',
    );
    await expect(remove).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await userEvent.click(canvas.getByRole("button", { name: "remove" }));
    await userEvent.click(await screen.findByRole("button", { name: "remove routine" }));
    await expect(remove).toHaveBeenCalledWith(morningPages);
    await expect(screen.getByRole("button", { name: "remove routine" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    finishRemove();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  },
});

export const RemovalRefused = meta.story({
  args: { routines: [morningPages] },
  play: async ({ canvas, userEvent }) => {
    remove.mockRejectedValueOnce(new Error("Routine could not be retired"));
    await userEvent.click(canvas.getByRole("button", { name: "remove" }));
    await userEvent.click(await screen.findByRole("button", { name: "remove routine" }));
    await expect(screen.findByRole("alert")).resolves.toHaveTextContent(
      "Routine could not be retired",
    );
    await expect(screen.getByRole("dialog")).toBeVisible();
  },
});

export const PhoneWithRoutine = meta.story({
  globals: { viewport: { value: "mobile2" } },
  args: { routines: [morningPages] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Morning pages")).toBeInTheDocument();
    await expect(canvas.getByText("daily")).not.toBeVisible();
    await expect(canvas.getByRole("button", { name: "remove" })).toBeInTheDocument();
  },
});
