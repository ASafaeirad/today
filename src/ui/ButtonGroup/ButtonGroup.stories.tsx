import { StoryMatrix } from "#storybook/matrix";
import preview from "#storybook/preview";

import { Button } from "../Button/Button.tsx";
import { ButtonGroup } from "./ButtonGroup.tsx";

const meta = preview.meta({ component: ButtonGroup });

export const Matrix = meta.story({
  render: () => (
    <StoryMatrix
      columns={[{ label: "Attached" }, { label: "Detached" }]}
      rows={["Small", "Default", "Large"]}
      cell={({ row, col }) => (
        <ButtonGroup attached={col === "Attached"}>
          {["done", "missed", "skipped"].map((label) => (
            <Button key={label} size={row.toLowerCase() as "sm" | "default" | "lg"}>
              {label}
            </Button>
          ))}
        </ButtonGroup>
      )}
    />
  ),
});
