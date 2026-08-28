import { StoryMatrix } from "#storybook/matrix";
import preview from "#storybook/preview";

import { Heading, Text, type TextProps } from "./Text.tsx";

const meta = preview.meta({ component: Text });

const tones = [
  { label: "Default", tone: "default" },
  { label: "Muted", tone: "muted" },
  { label: "Subtle", tone: "subtle" },
  { label: "Accent", tone: "accent" },
  { label: "Inverted", tone: "inverted" },
] satisfies { label: string; tone: TextProps["tone"] }[];

const sizes = ["xs", "sm", "base", "lg", "xl"] satisfies TextProps["size"][];

export const Matrix = meta.story({
  render: () => (
    <StoryMatrix
      columns={tones.map((t) => ({ label: t.label }))}
      rows={sizes}
      cell={({ row, col }) => {
        const { tone } = tones.find((t) => t.label === col)!;
        return (
          <Text size={row as TextProps["size"]} tone={tone}>
            resolve --day
          </Text>
        );
      }}
    />
  ),
});

export const Tracking = meta.story({
  render: () => (
    <StoryMatrix
      columns={[{ label: "Sample" }]}
      rows={["normal", "wide", "wider", "widest", "brand"]}
      cell={({ row }) => (
        <Text tracking={row as TextProps["tracking"]} caps>
          sealed
        </Text>
      )}
    />
  ),
});

export const Headings = meta.story({
  render: () => (
    <div className="flex flex-col gap-4">
      <Heading as="h1" size="xl">
        record locked
      </Heading>
      <Heading as="h2" size="lg" prompt>
        recap --all
      </Heading>
      <Heading as="h3" size="base" prompt>
        note --one-line
      </Heading>
    </div>
  ),
});
