import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "#lib/cn";

const kbdVariants = cva("font-mono whitespace-nowrap", {
  variants: {
    variant: {
      /* A key you press: an inverted block, the way the footer legend prints it. */
      key: "border border-current px-1",
      /* A key printed inside a control, dimmed until the control is engaged. */
      hint: "opacity-50 group-hover/control:opacity-100 group-data-pressed/control:opacity-100",
    },
  },
  defaultVariants: {
    variant: "key",
  },
});

export type KbdProps = React.ComponentProps<"kbd"> & VariantProps<typeof kbdVariants>;

export function Kbd({ className, variant = "key", ...props }: KbdProps) {
  return <kbd data-slot="kbd" className={cn(kbdVariants({ variant }), className)} {...props} />;
}

export { kbdVariants };
