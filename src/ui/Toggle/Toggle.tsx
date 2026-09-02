import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "#lib/cn";

import { buttonVariants } from "../Button/Button.tsx";
import { buttonGroupVariants } from "../ButtonGroup/ButtonGroup.tsx";

const toggleVariants = cva(
  "data-pressed:tone-bg data-pressed:tone-border disabled:pointer-events-none data-pressed:disabled:opacity-100",
  {
    variants: {
      /* Which meaning this key commits the record to once it is pressed. */
      tone: {
        ink: "tone-ink",
        done: "tone-done",
        missed: "tone-missed",
        skipped: "tone-skipped",
        seal: "tone-seal",
      },
    },
    defaultVariants: {
      tone: "ink",
    },
  },
);

export type ToggleProps = TogglePrimitive.Props &
  VariantProps<typeof toggleVariants> &
  Pick<VariantProps<typeof buttonVariants>, "size">;

export function Toggle({ className, tone = "ink", size = "default", ...props }: ToggleProps) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(
        buttonVariants({ variant: "outline", size }),
        toggleVariants({ tone }),
        className,
      )}
      {...props}
    />
  );
}

export type ToggleGroupProps = ToggleGroupPrimitive.Props &
  VariantProps<typeof buttonGroupVariants>;

export function ToggleGroup({ className, attached = true, ...props }: ToggleGroupProps) {
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      className={cn(buttonGroupVariants({ attached }), className)}
      {...props}
    />
  );
}

export { toggleVariants };
