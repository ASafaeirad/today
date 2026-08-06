import { StoryMatrix } from "#storybook/matrix";
import preview from "#storybook/preview";

import { Textarea } from "./Textarea.tsx";

const meta = preview.meta({
  component: Textarea,
});

const stateProps = {
  Default: { placeholder: "Type something..." },
  "With Value": { defaultValue: "Some existing content." },
  Disabled: { placeholder: "Disabled...", disabled: true },
  Error: { placeholder: "Invalid input", "aria-invalid": true as const },
  "Read Only": { defaultValue: "Cannot be edited.", readOnly: true },
};

export const Matrix = meta.story({
  render: () => (
    <StoryMatrix
      columns={[{ label: "Textarea" }]}
      rows={Object.keys(stateProps)}
      cell={({ row }) => (
        <div className="w-56">
          <Textarea {...stateProps[row as keyof typeof stateProps]} />
        </div>
      )}
    />
  ),
});
