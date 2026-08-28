import { StoryMatrix } from "#storybook/matrix";
import preview from "#storybook/preview";

import { Input } from "../Input/Input.tsx";
import { Label, type LabelProps } from "./Label.tsx";

const meta = preview.meta({ component: Label });

export const Matrix = meta.story({
  render: () => (
    <StoryMatrix
      columns={[{ label: "Muted" }, { label: "Subtle" }]}
      rows={["Alone", "Bound to a control", "Disabled"]}
      cell={({ row, col }) => {
        const tone = col.toLowerCase() as LabelProps["tone"];

        if (row === "Alone") {
          return <Label tone={tone}>closing note</Label>;
        }

        return (
          <div className="flex flex-col gap-1.5">
            <Label
              tone={tone}
              htmlFor={`note-${tone}`}
              data-disabled={row === "Disabled" || undefined}
            >
              closing note
            </Label>
            <Input
              id={`note-${tone}`}
              sigil=">"
              placeholder="one line"
              disabled={row === "Disabled"}
            />
          </div>
        );
      }}
    />
  ),
});
