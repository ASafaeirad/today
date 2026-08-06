import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "#lib/cn";

export function Input({
  className,
  type,
  error,
  ...props
}: React.ComponentProps<"input"> & { error?: boolean }) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      data-error={error ? true : undefined}
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-3.5 py-0 ring-offset-1 text-base shadow-inset transition-colors outline-none file:inline-flex file:h-9 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}
