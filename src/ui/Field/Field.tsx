import { Field as FieldPrimitive } from "@base-ui/react/field";

import { cn } from "#lib/cn";

import { labelVariants } from "../Label/Label.tsx";

export function Field({ className, ...props }: FieldPrimitive.Root.Props) {
  return (
    <FieldPrimitive.Root
      data-slot="field"
      className={cn("group/field flex w-full flex-col gap-1.5", className)}
      {...props}
    />
  );
}

export function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn("flex w-full flex-col gap-4", className)}
      {...props}
    />
  );
}

export function FieldLabel({ className, ...props }: FieldPrimitive.Label.Props) {
  return (
    <FieldPrimitive.Label
      data-slot="field-label"
      className={cn(labelVariants(), className)}
      {...props}
    />
  );
}

export function FieldDescription({ className, ...props }: FieldPrimitive.Description.Props) {
  return (
    <FieldPrimitive.Description
      data-slot="field-description"
      className={cn("text-sm text-muted-foreground data-disabled:opacity-50", className)}
      {...props}
    />
  );
}

export function FieldError({ className, ...props }: FieldPrimitive.Error.Props) {
  return (
    <FieldPrimitive.Error
      data-slot="field-error"
      className={cn("tone-missed tone-fg text-sm data-disabled:opacity-50", className)}
      {...props}
    />
  );
}
