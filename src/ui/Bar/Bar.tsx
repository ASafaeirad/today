import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "#lib/cn";

const barVariants = cva("no-scrollbar flex items-stretch overflow-x-auto whitespace-nowrap", {
  variants: {
    variant: {
      /* Window furniture: the strip a terminal keeps at its edges. */
      chrome: "bg-chrome text-muted-foreground",
      /* A surface the record sits on rather than a boundary. */
      panel: "bg-panel text-muted-foreground",
      /* Reserved for the ceremony — the only bar that raises its voice. */
      accent: "bg-accent font-bold tracking-brand text-accent-foreground",
      /* An annotation carried by the record itself. */
      note: "tone-seal tone-tint tone-fg",
    },
    placement: {
      top: "border-b border-border",
      bottom: "border-t border-border",
      none: "",
    },
  },
  defaultVariants: {
    variant: "chrome",
    placement: "top",
  },
});

export type BarProps = React.ComponentProps<"div"> & VariantProps<typeof barVariants>;

export function Bar({ className, variant = "chrome", placement = "top", ...props }: BarProps) {
  return (
    <div
      data-slot="bar"
      className={cn(barVariants({ variant, placement }), className)}
      {...props}
    />
  );
}

export function BarBrand({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="bar-brand"
      className={cn(
        "bg-inverted px-2.5 py-1.25 font-bold tracking-brand text-inverted-foreground",
        className,
      )}
      {...props}
    />
  );
}

const barItemVariants = cva("flex items-center gap-1 px-2.5 py-1.25", {
  variants: {
    tone: {
      ink: "tone-ink",
      muted: "tone-muted",
      done: "tone-done",
      missed: "tone-missed",
      skipped: "tone-skipped",
      seal: "tone-seal",
    },
    divided: {
      true: "border-r border-border",
      false: "",
    },
  },
  defaultVariants: {
    tone: "ink",
    divided: true,
  },
});

export type BarItemProps = React.ComponentProps<"span"> &
  VariantProps<typeof barItemVariants> & {
    /** The dim key printed before the value, e.g. `day`. */
    label?: React.ReactNode;
  };

export function BarItem({
  className,
  tone = "ink",
  divided = true,
  label,
  children,
  ...props
}: BarItemProps) {
  return (
    <span
      data-slot="bar-item"
      className={cn(barItemVariants({ tone, divided }), className)}
      {...props}
    >
      {label != null && <span data-slot="bar-item-label">{label}</span>}
      <span data-slot="bar-item-value" className="tone-fg">
        {children}
      </span>
    </span>
  );
}

export function BarSpacer({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="bar-spacer" className={cn("flex-1", className)} {...props} />;
}
