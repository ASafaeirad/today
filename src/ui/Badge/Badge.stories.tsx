import type { VariantProps } from "class-variance-authority";

import { StoryMatrix } from "#storybook/matrix";
import preview from "#storybook/preview";

import type { badgeVariants } from "./Badge.tsx";

import { Badge } from "./Badge.tsx";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const meta = preview.meta({
  component: Badge,
});

const variants = [
  "default",
  "neutral",
  "clay",
  "sage",
  "honey",
  "success",
  "warning",
  "danger",
  "info",
  "outline",
  "ghost",
] as const satisfies BadgeVariant[];

export const Matrix = meta.story({
  render: () => (
    <StoryMatrix
      columns={variants.map((v) => ({ label: v }))}
      rows={["Default", "With Dot"]}
      cell={({ row, col }) => (
        <Badge variant={col as BadgeVariant} dot={row === "With Dot"}>
          {col}
        </Badge>
      )}
    />
  ),
});
