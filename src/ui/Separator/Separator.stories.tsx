import { StoryMatrix } from "#storybook/matrix";
import preview from "#storybook/preview";

import { Separator } from "./Separator.tsx";

const meta = preview.meta({
  component: Separator,
});

export const Matrix = meta.story({
  render: () => (
    <StoryMatrix
      columns={[{ label: "Horizontal" }, { label: "Vertical" }]}
      rows={["In context"]}
      cell={({ col }) =>
        col === "Horizontal" ? (
          <div className="flex w-48 flex-col gap-2 text-sm">
            <span>Above</span>
            <Separator orientation="horizontal" />
            <span>Below</span>
          </div>
        ) : (
          <div className="flex h-5 items-center gap-3 text-sm">
            <span>Blog</span>
            <Separator orientation="vertical" />
            <span>Docs</span>
            <Separator orientation="vertical" />
            <span>Source</span>
          </div>
        )
      }
    />
  ),
});
