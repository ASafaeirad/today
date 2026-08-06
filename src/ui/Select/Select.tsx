import { ChevronDownIcon } from "lucide-react";

import { cn } from "#lib/cn";

type SelectProps = Omit<React.ComponentProps<"select">, "size"> & {
  size?: "sm" | "default";
  error?: boolean;
};

function Select({ className, size = "default", error, ...props }: SelectProps) {
  return (
    <div
      className={cn(
        "group/native-select relative w-fit has-[select:disabled]:opacity-50",
        className,
      )}
      data-slot="native-select-wrapper"
      data-size={size}
      data-error={error ? true : undefined}
    >
      <select
        data-slot="native-select"
        data-size={size}
        className="h-11 w-full min-w-0 appearance-none rounded-lg border border-input bg-transparent py-0 pr-10 pl-3.5 text-sm shadow-inset transition-colors outline-none select-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground ring-offset-1 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=sm]:h-9 data-[size=sm]:rounded-[min(var(--radius-md),10px)] data-[size=sm]:pl-3"
        {...props}
      />
      <ChevronDownIcon
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground select-none"
        aria-hidden="true"
        data-slot="native-select-icon"
      />
    </div>
  );
}

function SelectOption({ className, ...props }: React.ComponentProps<"option">) {
  return (
    <option
      data-slot="native-select-option"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  );
}

function SelectOptGroup({ className, ...props }: React.ComponentProps<"optgroup">) {
  return (
    <optgroup
      data-slot="native-select-optgroup"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  );
}

export { Select, SelectOptGroup, SelectOption };
