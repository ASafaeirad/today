import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "#lib/cn";

function Tabs({ className, orientation = "horizontal", ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn("group/tabs flex gap-2 data-horizontal:flex-col", className)}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex items-center rounded-full p-1 text-muted-foreground group-data-vertical/tabs:flex-col",
  {
    variants: {
      variant: {
        default: "gap-1 bg-muted shadow-inset w-fit",
        dimmed: "gap-2 bg-transparent border-b rounded-none p-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={tabsListVariants({ variant, className })}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex font-semibold transition-all px-4 py-2 text-sm items-center justify-center whitespace-nowrap rounded-full",
        "gap-1.5 group-data-[variant=dimmed]:px-2 group-data-[variant=dimmed]:py-1.5 group-data-[variant=dimmed]:rounded",
        "group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start group-data-vertical/tabs:rounded-lg",
        "hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring",
        "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
        "has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none",
        "data-active:bg-card data-active:text-foreground data-active:shadow-sm",
        "group-data-[variant=dimmed]:data-active:bg-transparent group-data-[variant=dimmed]:data-active:shadow-none group-data-[variant=dimmed]:data-active:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-[variant=dimmed]:group-data-horizontal/tabs:after:inset-x-0 group-data-[variant=dimmed]:group-data-horizontal/tabs:after:-bottom-1.25 group-data-[variant=dimmed]:group-data-horizontal/tabs:after:h-0.5 group-data-[variant=dimmed]:data-active:after:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
