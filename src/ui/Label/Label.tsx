import type { VariantProps } from "class-variance-authority";

import { cva } from "class-variance-authority";

import { cn } from "#lib/cn";

const labelVariants = cva(
  "inline-flex w-fit items-center gap-1.5 text-xs tracking-wider text-muted-foreground uppercase select-none data-disabled:opacity-50",
  {
    variants: {
      tone: {
        muted: "text-muted-foreground",
        subtle: "text-subtle-foreground",
      },
    },
    defaultVariants: {
      tone: "muted",
    },
  },
);

export type LabelProps = React.ComponentProps<"label"> & VariantProps<typeof labelVariants>;

export function Label({ className, tone = "muted", ...props }: LabelProps) {
  return <label data-slot="label" className={cn(labelVariants({ tone }), className)} {...props} />;
}

export { labelVariants };
