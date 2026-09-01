import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "#lib/cn";

const badgeVariants = cva("inline-block whitespace-nowrap uppercase", {
  variants: {
    tone: {
      /* Inherit the ambient `--tone` from the record this badge sits in. */
      inherit: "",
      neutral: "tone-neutral",
      ink: "tone-ink",
      done: "tone-done",
      missed: "tone-missed",
      skipped: "tone-skipped",
      seal: "tone-seal",
    },
    appearance: {
      text: "tone-fg",
      solid: "tone-bg px-1.25",
      outline: "tone-fg tone-border border px-1.25",
    },
    size: {
      xs: "text-xs tracking-wider",
      sm: "text-sm tracking-wider",
    },
  },
  defaultVariants: {
    tone: "inherit",
    appearance: "text",
    size: "sm",
  },
});

export type BadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    /** Types the word out a character at a time, the way a state change lands. */
    typed?: boolean;
  };

export function Badge({
  className,
  tone = "inherit",
  appearance = "text",
  size = "sm",
  typed = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ tone, appearance, size }), className)}
      {...props}
    >
      <span
        className={cn("inline-block overflow-hidden align-bottom whitespace-nowrap", {
          "animate-type": typed,
        })}
      >
        {children}
      </span>
    </span>
  );
}

export { badgeVariants };
