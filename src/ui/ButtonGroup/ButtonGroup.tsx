import { cva, type VariantProps } from "class-variance-authority";

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

export type ButtonGroupProps = React.ComponentProps<"fieldset"> &
  VariantProps<typeof buttonGroupVariants>;

export function ButtonGroup({ className, attached = true, ...props }: ButtonGroupProps) {
  return (
    <fieldset
      data-slot="button-group"
      className={cn("m-0 min-w-0 border-0 p-0", buttonGroupVariants({ attached }), className)}
      {...props}
    />
  );
}

export { buttonGroupVariants };
