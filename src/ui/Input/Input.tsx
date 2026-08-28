import type { VariantProps } from "class-variance-authority";

import { Input as InputPrimitive } from "@base-ui/react/input";
import { cva } from "class-variance-authority";

import { cn } from "#lib/cn";

const inputVariants = cva(
  "flex items-center rounded-md border border-input bg-panel text-foreground focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-ring data-invalid:tone-missed data-invalid:tone-border has-data-invalid:tone-missed has-data-invalid:tone-border data-disabled:cursor-not-allowed data-disabled:bg-chrome data-disabled:opacity-50 has-data-disabled:cursor-not-allowed has-data-disabled:bg-chrome has-data-disabled:opacity-50",
);

const inputControlVariants = cva(
  "min-w-0 flex-1 bg-transparent outline-none placeholder:text-subtle-foreground disabled:cursor-not-allowed",
  {
    variants: {
      size: {
        default: "px-2 py-1.25 text-base",
        lg: "px-2 py-2.25 text-lg",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

export type InputProps = Omit<InputPrimitive.Props, "size"> &
  VariantProps<typeof inputControlVariants> & {
    /** The prompt character printed in front of the field, e.g. `>`. */
    sigil?: React.ReactNode;
    invalid?: boolean;
    wrapperClassName?: string;
  };

export function Input({
  className,
  wrapperClassName,
  size = "default",
  sigil,
  invalid = false,
  disabled,
  ...props
}: InputProps) {
  return (
    <div
      data-slot="input"
      data-invalid={invalid || undefined}
      data-disabled={disabled || undefined}
      className={cn(inputVariants(), wrapperClassName)}
    >
      {sigil != null && (
        <span
          data-slot="input-sigil"
          aria-hidden="true"
          className="flex items-center self-stretch border-r border-border px-2 text-accent"
        >
          {sigil}
        </span>
      )}
      <InputPrimitive
        data-slot="input-control"
        aria-invalid={invalid || undefined}
        disabled={disabled}
        className={cn(inputControlVariants({ size }), className)}
        {...props}
      />
    </div>
  );
}

export { inputControlVariants, inputVariants };
