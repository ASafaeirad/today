import type { VariantProps } from "class-variance-authority";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva } from "class-variance-authority";

import { cn } from "#lib/cn";

export function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col", className)} {...props} />
  );
}

export function TabList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tab-list"
      className={cn(
        "no-scrollbar flex overflow-x-auto border-b border-border bg-panel data-vertical:flex-col data-vertical:border-r data-vertical:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

export function Tab({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tab"
      className={cn(
        "group/tab grid animate-cut gap-0.5 border-r border-border px-2.75 py-1.5 text-left text-base whitespace-nowrap text-muted-foreground transition-colors outline-none hover:bg-chrome hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring active:animate-flash data-selected:bg-inverted data-selected:text-inverted-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

const tabStatusVariants = cva(
  "text-xs tracking-wider uppercase group-data-selected/tab:text-inherit",
  {
    variants: {
      tone: {
        /* No verdict yet — the status reads in whatever ink the tab is wearing. */
        inherit: "",
        done: "tone-done tone-fg",
        missed: "tone-missed tone-fg",
        skipped: "tone-skipped tone-fg",
        seal: "tone-seal tone-fg",
      },
    },
    defaultVariants: {
      tone: "inherit",
    },
  },
);

export type TabStatusProps = React.ComponentProps<"span"> & VariantProps<typeof tabStatusVariants>;

export function TabStatus({ className, tone = "inherit", ...props }: TabStatusProps) {
  return (
    <span
      data-slot="tab-status"
      className={cn(tabStatusVariants({ tone }), className)}
      {...props}
    />
  );
}

export function TabPanel({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tab-panel"
      className={cn("outline-none", className)}
      {...props}
    />
  );
}

export { tabStatusVariants };
