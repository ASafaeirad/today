import type { VariantProps } from "class-variance-authority";

import { cva } from "class-variance-authority";

import { cn } from "#lib/cn";

const buttonGroupVariants = cva("flex items-stretch", {
  variants: {
    /* Attached controls read as one instrument; detached ones as separate choices. */
    attached: {
      true: "joined",
      false: "gap-2 flex-wrap",
    },
  },
  defaultVariants: {
    attached: true,
  },
});

export type ButtonGroupProps = React.ComponentProps<"div"> &
  VariantProps<typeof buttonGroupVariants>;

export function ButtonGroup({ className, attached = true, ...props }: ButtonGroupProps) {
  return (
    <div
      role="group"
      data-slot="button-group"
      className={cn(buttonGroupVariants({ attached }), className)}
      {...props}
    />
  );
}

export { buttonGroupVariants };
