import { StoryMatrix } from "#storybook/matrix";
import preview from "#storybook/preview";

import { Checkbox } from "./Checkbox.tsx";

const meta = preview.meta({
  component: Checkbox,
});

const stateProps = {
  Default: {},
  Checked: { defaultChecked: true },
  Indeterminate: { indeterminate: true },
  Disabled: { disabled: true },
  "Disabled Checked": { disabled: true, defaultChecked: true },
  Invalid: { "aria-invalid": true as const },
};

export const Matrix = meta.story({
  render: () => (
    <StoryMatrix
      columns={[{ label: "Checkbox" }]}
      rows={Object.keys(stateProps)}
      cell={({ row }) => <Checkbox {...stateProps[row as keyof typeof stateProps]} />}
    />
  ),
});
