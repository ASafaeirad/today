import { StoryMatrix } from "#storybook/matrix";
import preview from "#storybook/preview";

import { Button, type ButtonProps } from "../Button/Button.tsx";
import { ButtonGroup } from "./ButtonGroup.tsx";

const meta = preview.meta({ component: ButtonGroup });

const rows = {
  Small: { size: "sm" },
  Default: {},
  Large: { size: "lg" },
} satisfies Record<string, ButtonProps>;

export const Matrix = meta.story({
  render: () => (
    <StoryMatrix
      columns={[{ label: "Attached" }, { label: "Detached" }]}
      rows={Object.keys(rows)}
      cell={({ row, col }) => (
        <ButtonGroup attached={col === "Attached"}>
          {["done", "missed", "skipped"].map((label) => (
            <Button key={label} {...rows[row as keyof typeof rows]}>
              {label}
            </Button>
          ))}
        </ButtonGroup>
      )}
    />
  ),
});
