import { StoryMatrix } from "#storybook/matrix";
import preview from "#storybook/preview";

import { Input } from "./Input";

const meta = preview.meta({
  component: Input,
});

const stateProps = {
  Default: { placeholder: "Placeholder..." },
  "With Value": { defaultValue: "hello@example.com" },
  Disabled: { placeholder: "Disabled...", disabled: true },
  Error: { defaultValue: "invalid@", error: true },
  "Read Only": { defaultValue: "Readonly value", readOnly: true },
};

const types = ["text", "email", "password", "number", "search"] as const;

export const Matrix = meta.story({
  render: () => (
    <StoryMatrix
      columns={[{ label: "Input" }]}
      rows={Object.keys(stateProps)}
      cell={({ row }) => (
        <div className="w-48">
          <Input {...stateProps[row as keyof typeof stateProps]} />
        </div>
      )}
    />
  ),
});

export const Types = meta.story({
  render: () => (
    <StoryMatrix
      columns={[{ label: "Input" }]}
      rows={types.map((t) => t)}
      cell={({ row }) => (
        <div className="w-48">
          <Input type={row as (typeof types)[number]} placeholder={`${row}...`} />
        </div>
      )}
    />
  ),
});
