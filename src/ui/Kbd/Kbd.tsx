import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "#lib/cn";

const kbdVariants = cva("font-mono whitespace-nowrap", {
  variants: {
    variant: {
      /* A key you press: an inverted block, the way the footer legend prints it. */
      key: "border text-subtle-foreground border-subtle-foreground px-1",
      /* A key printed inside a control, dimmed until the control is engaged. */
      hint: "text-subtle-foreground group-hover/control:text-current group-data-pressed/control:text-current",
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
