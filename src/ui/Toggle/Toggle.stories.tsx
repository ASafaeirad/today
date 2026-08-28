import { useState } from "react";

import { StoryMatrix } from "#storybook/matrix";
import preview from "#storybook/preview";

import { Kbd } from "../Kbd/Kbd.tsx";
import { Toggle, ToggleGroup, type ToggleProps } from "./Toggle.tsx";

const meta = preview.meta({ component: Toggle });

const tones = ["ink", "done", "missed", "skipped", "seal"] satisfies ToggleProps["tone"][];

export const Matrix = meta.story({
  render: () => (
    <StoryMatrix
      columns={[{ label: "Interactive" }, { label: "Pressed" }, { label: "Disabled" }]}
      rows={tones}
      cell={({ row, col }) => {
        const [pressed, setPressed] = useState(false);
        const tone = row as ToggleProps["tone"];

        if (col === "Pressed") {
          return (
            <Toggle tone={tone} pressed>
              {row}
            </Toggle>
          );
        }

        if (col === "Disabled") {
          return (
            <Toggle tone={tone} disabled>
              {row}
            </Toggle>
          );
        }

        return (
          <Toggle tone={tone} pressed={pressed} onPressedChange={setPressed}>
            {row}
          </Toggle>
        );
      }}
    />
  ),
});

const OPS = [
  { value: "done", key: "D" },
  { value: "missed", key: "M" },
  { value: "skipped", key: "S" },
] as const;

export const Operations = meta.story({
  render: () => {
    const [value, setValue] = useState<string[]>([]);

    return (
      <ToggleGroup value={value} onValueChange={setValue}>
        {OPS.map((op) => (
          <Toggle key={op.value} value={op.value} tone={op.value} aria-label={op.value}>
            <Kbd variant="hint">{op.key}</Kbd>
            {op.value}
          </Toggle>
        ))}
      </ToggleGroup>
    );
  },
});
