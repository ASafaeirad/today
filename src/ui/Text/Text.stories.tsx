import { StoryMatrix } from "#storybook/matrix";
import preview from "#storybook/preview";

import { Heading, Text } from "./Text";

const meta = preview.meta({
  component: Text,
});

const sizes = ["xs", "sm", "base", "lg", "xl"] as const;
const weights = ["normal", "medium", "semibold", "bold"] as const;

export const Matrix = meta.story({
  render: () => (
    <StoryMatrix
      columns={weights.map((w) => ({ label: w }))}
      rows={sizes.map((s) => s)}
      cell={({ row, col }) => (
        <Text size={row as (typeof sizes)[number]} weight={col as (typeof weights)[number]}>
          The quick brown fox
        </Text>
      )}
    />
  ),
});

export const Headings = meta.story({
  render: () => (
    <StoryMatrix
      columns={[{ label: "Heading" }]}
      rows={["h1 / xl", "h2 / lg", "h3 / base", "h4 / sm", "h5 / xs"]}
      cell={({ row }) => {
        const [tag, size] = row.split(" / ");
        return (
          <Heading
            as={tag as "h1" | "h2" | "h3" | "h4" | "h5"}
            size={size as (typeof sizes)[number]}
          >
            Heading {row}
          </Heading>
        );
      }}
    />
  ),
});
