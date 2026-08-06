import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "#lib/cn";

const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-all outline-none select-none focus-visible:ring-offset-1 focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/85 hover:shadow-md",
        outline:
          "border-border bg-background shadow-xs hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground focus-visible:ring-secondary",
        ghost:
          "hover:bg-primary-subtle hover:text-foreground focus-within:bg-primary-subtle aria-expanded:bg-primary-subtle aria-expanded:text-foreground",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20  focus-visible:ring-destructive/20",
      },
      size: {
        default:
          "h-11 gap-2 px-4 has-data-[icon=inline-end]:pr-3.5 has-data-[icon=inline-start]:pl-3.5",
        xs: "h-7 gap-1 rounded px-2.5 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 rounded px-3.5 text-sm in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-13 gap-2.5 px-6 text-base has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-10 px-0",
        "icon-sm": "size-8 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean;
    block?: boolean;
  };

function Button({
  className,
  variant = "default",
  size = "default",
  block,
  loading,
  children,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, className }), {
        "pointer-events-none cursor-progress": loading,
        "w-full": block,
      })}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute h-1 w-full px-4 rounded-full container-inline-size overflow-clip max-w-22",
            { "px-2 w-8": size === "icon" },
          )}
        >
          <span
            className={cn("w-full block h-full rounded-full bg-current/20", {
              "w-4": size === "icon",
            })}
          />
          <span
            className={cn(
              "absolute w-1/4 top-0 left-4 h-1 rounded-full bg-current animate-btn-tide",
              { "w-2 left-2": size === "icon" },
            )}
          />
        </span>
      )}
      <span className={cn("inline-flex gap-2 items-center", { invisible: loading })}>
        {children}
      </span>
    </ButtonPrimitive>
  );
}

export { Button, buttonVariants };
