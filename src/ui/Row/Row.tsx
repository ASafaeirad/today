import type { VariantProps } from "class-variance-authority";

import { cva } from "class-variance-authority";

import { cn } from "#lib/cn";

import { Badge, type BadgeProps } from "../Badge/Badge.tsx";

const rowGrid = "grid grid-record sm:grid-record-full items-center px-2.5";

export function RowHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="row-header"
      className={cn(
        rowGrid,
        "sticky top-0 z-1 border-b border-border bg-background py-0.75 text-xs tracking-widest text-subtle-foreground uppercase",
        className,
      )}
      {...props}
    />
  );
}

const rowVariants = cva(
  "group/row relative animate-cut border-b border-border transition-colors before:absolute before:inset-y-0 before:left-0 before:w-0.75 data-current:bg-panel data-current:outline-2 data-current:-outline-offset-2 data-current:outline-ring",
  {
    variants: {
      /* The verdict on this record. It sets `--tone` for every part below. */
      status: {
        open: "tone-neutral before:hidden hover:bg-panel",
        done: "tone-done tone-tint before:tone-rail",
        missed: "tone-missed tone-tint before:tone-rail",
        /* Skipped is deliberate absence: hatched, never filled. */
        skipped: "tone-skipped tone-hatch before:tone-rail-dashed",
      },
    },
    defaultVariants: {
      status: "open",
    },
  },
);

export type RowProps = React.ComponentProps<"div"> &
  VariantProps<typeof rowVariants> & {
    /** The record the block cursor is parked on. */
    current?: boolean;
  };

export function Row({ className, status = "open", current = false, ...props }: RowProps) {
  return (
    <div
      data-slot="row"
      data-status={status}
      aria-current={current || undefined}
      className={cn(rowGrid, rowVariants({ status }), "min-h-7.5", className)}
      {...props}
    />
  );
}

export function RowIndex({ className, children, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="row-index"
      className={cn("text-subtle-foreground tabular-nums", className)}
      {...props}
    >
      <span
        aria-hidden="true"
        className="absolute left-0.75 hidden animate-blink text-foreground group-data-current/row:inline"
      >
        &#9656;
      </span>
      {children}
    </span>
  );
}

export function RowName({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="row-name"
      className={cn("truncate pr-1 group-data-missed/row:line-through", className)}
      {...props}
    />
  );
}

export function RowStatus({ className, ...props }: BadgeProps) {
  return (
    <Badge
      data-slot="row-status"
      className={cn("col-start-2 sm:col-start-3", className)}
      {...props}
    />
  );
}

export function RowActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="row-actions"
      className={cn(
        "col-span-full my-0.75 justify-self-stretch sm:col-auto sm:my-0 sm:justify-self-end",
        className,
      )}
      {...props}
    />
  );
}

export { rowVariants };
