import { cn } from "#lib/cn";

/**
 * A bordered region of the console. Elevation here is drawn with a line, not a
 * shadow — compose a `Bar` at the top or bottom for the title and the controls.
 */
export function Panel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="panel"
      className={cn(
        "flex animate-cut flex-col overflow-hidden rounded-md border border-border bg-panel text-base",
        className,
      )}
      {...props}
    />
  );
}

export function PanelBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="panel-body"
      className={cn("flex flex-col gap-3 overflow-auto px-2.5 py-4.5", className)}
      {...props}
    />
  );
}
