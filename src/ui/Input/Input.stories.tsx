import { StoryMatrix } from "#storybook/matrix";
import preview from "#storybook/preview";

import { Input } from "./Input.tsx";

const meta = preview.meta({ component: Input });

export const Matrix = meta.story({
  render: () => (
    <StoryMatrix
      columns={[{ label: "Plain" }, { label: "With sigil" }]}
      rows={["Default", "Large", "Filled", "Invalid", "Disabled"]}
      cell={({ row, col }) => (
        <Input
          className="w-56"
          sigil={col === "With sigil" ? ">" : undefined}
          size={row === "Large" ? "lg" : "default"}
          defaultValue={row === "Filled" ? "Ran late, still got the walk in." : undefined}
          invalid={row === "Invalid"}
          disabled={row === "Disabled"}
          placeholder="closing note"
        />
      )}
    />
  ),
});
