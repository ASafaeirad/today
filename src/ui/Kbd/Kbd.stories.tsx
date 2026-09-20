import { expect } from "storybook/test";

import { StoryMatrix } from "#storybook/matrix";
import preview from "#storybook/preview";

import { Button, type ButtonProps } from "../Button/Button.tsx";
import { Kbd } from "./Kbd.tsx";

const meta = preview.meta({ component: Kbd });

export const Matrix = meta.story({
  render: () => (
    <StoryMatrix
      columns={[{ label: "Key" }, { label: "Hint" }]}
      rows={["Alone", "In a legend", "Inside a control"]}
      cell={({ row, col }) => {
        const variant = col === "Key" ? "key" : "hint";

        if (row === "Alone") {
          return <Kbd variant={variant}>d</Kbd>;
        }

        if (row === "In a legend") {
          return (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Kbd variant={variant}>h l</Kbd>
              day
            </span>
          );
        }

        return (
          <Button>
            <Kbd variant={variant}>D</Kbd>
            done
          </Button>
        );
      }}
    />
  ),
});

const buttonVariants = ["outline", "solid", "accent", "ghost"] satisfies ButtonProps["variant"][];

export const InButtons = meta.story({
  render: () => (
    <StoryMatrix
      columns={buttonVariants.map((variant) => ({ label: variant }))}
      rows={["Key", "Hint"]}
      cell={({ row, col }) => (
        <Button variant={col as ButtonProps["variant"]}>
          <Kbd variant={row === "Key" ? "key" : "hint"}>D</Kbd>
          done
        </Button>
      )}
    />
  ),
  play: async ({ canvasElement }) => {
    const view = canvasElement.ownerDocument.defaultView;

    await Promise.all(
      Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-slot="button"]')).map(
        async (button) => {
          const kbd = button.querySelector<HTMLElement>('[data-slot="kbd"]');

          await expect(kbd).not.toBeNull();
          await expect(view?.getComputedStyle(kbd!).color).toBe(
            view?.getComputedStyle(button).color,
          );
        },
      ),
    );
  },
});
