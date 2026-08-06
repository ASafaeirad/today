import { StoryMatrix } from "#storybook/matrix";
import preview from "#storybook/preview";

import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "./Avatar.tsx";

const meta = preview.meta({
  component: Avatar,
});

type AvatarSize = "sm" | "default" | "lg";

export const Matrix = meta.story({
  render: () => (
    <StoryMatrix
      columns={[{ label: "sm" }, { label: "default" }, { label: "lg" }]}
      rows={["Image", "Fallback", "With Badge", "Group"]}
      cell={({ row, col }) => {
        const size = col as AvatarSize;

        if (row === "Group") {
          return (
            <AvatarGroup>
              <Avatar size={size}>
                <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
              <Avatar size={size}>
                <AvatarImage src="https://github.com/maxleiter.png" alt="@maxleiter" />
                <AvatarFallback>ML</AvatarFallback>
              </Avatar>
              <Avatar size={size}>
                <AvatarImage src="https://github.com/evilrabbit.png" alt="@evilrabbit" />
                <AvatarFallback>ER</AvatarFallback>
              </Avatar>
              <AvatarGroupCount>+3</AvatarGroupCount>
            </AvatarGroup>
          );
        }

        return (
          <Avatar size={size}>
            {row !== "Fallback" && (
              <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
            )}
            <AvatarFallback>CN</AvatarFallback>
            {row === "With Badge" && <AvatarBadge className="bg-green-600 dark:bg-green-800" />}
          </Avatar>
        );
      }}
    />
  ),
});
