import { cn } from "#lib/cn";

export type CommandLineProps = React.ComponentProps<"button"> & {
  /** The command this line will run if you take it, printed as an inverted chip. */
  action?: React.ReactNode;
};

/**
 * The progress line, written as a command you can actually run. Reads as status
 * until you hover it, at which point it admits it is a button.
 */
export function CommandLine({ className, action, children, ...props }: CommandLineProps) {
  return (
    <button
      type="button"
      data-slot="command-line"
      className={cn(
        "group/command block w-full animate-sweep border-b border-border bg-panel px-2.5 py-1.75 text-left text-base text-muted-foreground transition-colors outline-none hover:bg-chrome focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring active:animate-flash",
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className="text-subtle-foreground">
        ${" "}
      </span>
      {children}
      {action != null && (
        <span
          data-slot="command-line-action"
          className="ml-2 bg-inverted px-1.25 text-inverted-foreground"
        >
          {action}
          <span aria-hidden="true" className="hidden animate-blink group-hover/command:inline">
            _
          </span>
        </span>
      )}
    </button>
  );
}

export function CommandLineValue({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span data-slot="command-line-value" className={cn("text-foreground", className)} {...props} />
  );
}
