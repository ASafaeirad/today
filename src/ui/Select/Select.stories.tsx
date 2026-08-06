import { StoryMatrix } from "#storybook/matrix";
import preview from "#storybook/preview";

import { Select, SelectOption } from "./Select";

const meta = preview.meta({
  component: Select,
});

function Opts() {
  return (
    <>
      <SelectOption value="">Choose...</SelectOption>
      <SelectOption value="a">Option A</SelectOption>
      <SelectOption value="b">Option B</SelectOption>
      <SelectOption value="c">Option C</SelectOption>
    </>
  );
}

const stateProps = {
  Default: {},
  Disabled: { disabled: true },
  Error: { error: true },
};

export const Matrix = meta.story({
  render: () => (
    <StoryMatrix
      columns={[{ label: "sm" }, { label: "default" }]}
      rows={Object.keys(stateProps)}
      cell={({ row, col }) => (
        <Select size={col as "sm" | "default"} {...stateProps[row as keyof typeof stateProps]}>
          <Opts />
        </Select>
      )}
    />
  ),
});
