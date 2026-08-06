import type { VariantProps } from "class-variance-authority";

import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { StoryMatrix } from "#storybook/matrix";
import preview from "#storybook/preview";

import { Button, type ButtonProps, type buttonVariants } from "./Button";

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;

const meta = preview.meta({
  component: Button,
});

const variantColumns = [
  { label: "Default", variant: "default" },
  { label: "Outline", variant: "outline" },
  { label: "Secondary", variant: "secondary" },
  { label: "Ghost", variant: "ghost" },
  { label: "Destructive", variant: "destructive" },
] satisfies { label: string; variant: ButtonVariant }[];

const rowStates = {
  Large: { size: "lg" },
  Default: {},
  Small: { size: "sm" },
  Disabled: { disabled: true },
  Loading: { loading: true },
} satisfies Record<string, ButtonProps>;

export const Matrix = meta.story({
  render: () => (
    <StoryMatrix
      columns={variantColumns.map((c) => ({ label: c.label, subColumns: ["Text", "Icon"] }))}
      rows={Object.keys(rowStates)}
      cell={({ row, col, subCol }) => {
        const [loading, setLoading] = useState(false);
        const { variant } = variantColumns.find((c) => c.label === col)!;
        const stateProps = rowStates[row as keyof typeof rowStates];
        const isIcon = subCol === "Icon";
        const handleClick = () => {
          setLoading(true);
          setTimeout(() => setLoading(false), 2000);
        };

        return isIcon ? (
          <Button
            loading={loading}
            variant={variant}
            aria-label="add"
            onClick={handleClick}
            {...stateProps}
          >
            <PlusIcon />
          </Button>
        ) : (
          <Button variant={variant} loading={loading} onClick={handleClick} {...stateProps}>
            Button
          </Button>
        );
      }}
    />
  ),
});
