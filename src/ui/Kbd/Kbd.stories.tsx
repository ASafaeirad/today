import { StoryMatrix } from "#storybook/matrix";
import preview from "#storybook/preview";

import { Button } from "../Button/Button.tsx";
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
