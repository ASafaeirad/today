import type { VariantProps } from "class-variance-authority";

import { cva } from "class-variance-authority";

import { cn } from "#lib/cn";

export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <table
      data-slot="table"
      className={cn("w-full border-collapse text-base", className)}
      {...props}
    />
  );
}

export function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn(className)} {...props} />;
}

export function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn(className)} {...props} />;
}

export function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr data-slot="table-row" className={cn("animate-cut", className)} {...props} />;
}

export function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "border-b border-border px-1.5 py-1 text-left text-xs tracking-widest text-subtle-foreground uppercase",
        className,
      )}
      {...props}
    />
  );
}

const tableCellVariants = cva("border-b border-border px-1.5 py-1", {
  variants: {
    tone: {
      inherit: "",
      neutral: "tone-neutral tone-fg",
      done: "tone-done tone-fg",
      missed: "tone-missed tone-fg",
      skipped: "tone-skipped tone-fg",
      seal: "tone-seal tone-fg",
    },
    align: {
      start: "text-left",
      /* The verdict column: right-aligned and spaced out, like a ledger. */
      end: "text-right tracking-wider",
    },
  },
  defaultVariants: {
    tone: "inherit",
    align: "start",
  },
});

export type TableCellProps = Omit<React.ComponentProps<"td">, "align"> &
  VariantProps<typeof tableCellVariants>;

export function TableCell({
  className,
  tone = "inherit",
  align = "start",
  ...props
}: TableCellProps) {
  return (
    <td
      data-slot="table-cell"
      className={cn(tableCellVariants({ tone, align }), className)}
      {...props}
    />
  );
}

export { tableCellVariants };
