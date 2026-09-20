import { useState } from "react";
import { expect, within } from "storybook/test";

import { StoryMatrix } from "#storybook/matrix";
import preview from "#storybook/preview";

import { Button, type ButtonProps } from "./Button.tsx";

const meta = preview.meta({ component: Button });

const variants = [
  "outline",
  "embedded",
  "solid",
  "accent",
  "ghost",
] satisfies ButtonProps["variant"][];

const rows = {
  Large: { size: "lg" },
  Default: {},
  Small: { size: "sm" },
  Disabled: { disabled: true },
  Loading: { loading: true },
} satisfies Record<string, ButtonProps>;

export const Matrix = meta.story({
  render: () => (
    <StoryMatrix
      columns={variants.map((variant) => ({ label: variant }))}
      rows={Object.keys(rows)}
      cell={({ row, col }) => {
        const [busy, setBusy] = useState(false);

        return (
          <Button
            variant={col as ButtonProps["variant"]}
            loading={busy}
            onClick={() => {
              setBusy(true);
              setTimeout(() => setBusy(false), 1500);
            }}
            {...rows[row as keyof typeof rows]}
          >
            seal
          </Button>
        );
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The loading state hides the label to make room for the cursor. It has to
    // hide it on screen only: a busy button still has to announce what it does.
    const busy = canvas
      .getAllByRole("button", { name: "seal" })
      .filter((button) => button.hasAttribute("aria-busy"));

    await expect(busy).toHaveLength(variants.length);
  },
});
