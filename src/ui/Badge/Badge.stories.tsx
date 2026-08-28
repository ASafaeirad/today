import { StoryMatrix } from "#storybook/matrix";
import preview from "#storybook/preview";

import { Badge, type BadgeProps } from "./Badge.tsx";

const meta = preview.meta({ component: Badge });

const tones = [
  "neutral",
  "ink",
  "done",
  "missed",
  "skipped",
  "seal",
] satisfies BadgeProps["tone"][];

export const Matrix = meta.story({
  render: () => (
    <StoryMatrix
      columns={[{ label: "Text" }, { label: "Solid" }, { label: "Outline" }]}
      rows={tones}
      cell={({ row, col }) => (
        <Badge
          tone={row as BadgeProps["tone"]}
          appearance={col.toLowerCase() as BadgeProps["appearance"]}
        >
          {row}
        </Badge>
      )}
    />
  ),
});

export const Typed = meta.story({
  render: () => (
    <div className="flex gap-4">
      {tones.map((tone) => (
        <Badge key={tone} tone={tone} typed>
          {tone}
        </Badge>
      ))}
    </div>
  ),
});
