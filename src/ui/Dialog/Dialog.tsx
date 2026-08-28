import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { cn } from "#lib/cn";

import { Bar, type BarProps } from "../Bar/Bar.tsx";
import { Heading } from "../Text/Text.tsx";

export function Dialog(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

export function DialogTrigger(props: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

export function DialogClose(props: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

export function DialogPortal(props: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

export function DialogBackdrop({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-backdrop"
      className={cn(
        "fixed inset-0 z-50 bg-overlay data-open:animate-cut data-closed:animate-blackout",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The ceremony takes the whole terminal: there is nothing else to look at while
 * a day is being sealed.
 */
export function DialogContent({ className, children, ...props }: DialogPrimitive.Popup.Props) {
  return (
    <DialogPortal>
      <DialogBackdrop />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed inset-0 z-50 grid grid-terminal bg-background text-base text-foreground outline-none data-open:animate-sweep data-closed:animate-blackout",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

export function DialogHeader({ className, ...props }: BarProps) {
  return (
    <Bar
      data-slot="dialog-header"
      variant="accent"
      placement="none"
      className={cn("flex-wrap items-center justify-between gap-2.5", className)}
      {...props}
    />
  );
}

export function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("max-w-prose overflow-auto px-2.5 py-4.5", className)}
      {...props}
    />
  );
}

export function DialogFooter({ className, ...props }: BarProps) {
  return (
    <Bar
      data-slot="dialog-footer"
      variant="chrome"
      placement="bottom"
      className={cn("items-stretch", className)}
      {...props}
    />
  );
}

export type DialogTitleProps = DialogPrimitive.Title.Props & {
  /** Print the title as a shell prompt. */
  prompt?: boolean;
};

export function DialogTitle({ className, prompt = true, ...props }: DialogTitleProps) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      render={<Heading as="h2" prompt={prompt} />}
      className={cn("mb-3.5", className)}
      {...props}
    />
  );
}

export function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-base text-muted-foreground", className)}
      {...props}
    />
  );
}
