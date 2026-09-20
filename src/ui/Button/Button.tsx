import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "#lib/cn";

const buttonVariants = cva(
  "group/control icon-inline relative inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent whitespace-nowrap transition-colors outline-none select-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        /* The operation key: a hairline box that inverts as you press it. */
        outline:
          "border-border text-muted-foreground hover:border-muted-foreground hover:bg-panel hover:text-foreground active:bg-inverted active:text-inverted-foreground",
        /* A control inside a bordered row: the row owns the horizontal rules. */
        embedded:
          "border-x-border border-y-transparent text-muted-foreground hover:border-x-muted-foreground hover:bg-chrome hover:text-foreground active:bg-inverted active:text-inverted-foreground",
        /* Committed emphasis: ink and surface traded places. */
        solid: "bg-inverted text-inverted-foreground hover:brightness-115 active:brightness-75",
        /* The irreversible one — sealing a record. */
        accent:
          "bg-accent font-bold tracking-brand text-accent-foreground hover:brightness-115 active:brightness-75 disabled:bg-border disabled:text-subtle-foreground disabled:opacity-100",
        /* Chrome affordance: legible only once you go looking for them. */
        ghost:
          "text-muted-foreground hover:bg-panel hover:text-foreground active:bg-inverted active:text-inverted-foreground",
      },
      size: {
        sm: "min-h-6 px-2 text-xs tracking-wide",
        default: "min-h-7 px-2 py-1.25 text-sm tracking-wide",
        lg: "min-h-9 px-4 py-2.25 text-base tracking-wide",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "default",
    },
  },
);

export type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean;
    block?: boolean;
  };

export function Button({
  className,
  variant = "outline",
  size = "default",
  loading = false,
  block = false,
  children,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size }), className, {
        "pointer-events-none": loading,
        "w-full": block,
      })}
      {...props}
    >
      {loading && (
        <span aria-hidden="true" className="absolute animate-blink">
          &#9612;
        </span>
      )}
      {/* Hidden with opacity, not `visibility`: the cursor takes the label's place
          on screen, but the label has to stay the button's accessible name. */}
      <span className={cn("inline-flex items-center gap-1.5", { "opacity-0": loading })}>
        {children}
      </span>
    </ButtonPrimitive>
  );
}

export { buttonVariants };
