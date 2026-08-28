import type { VariantProps } from "class-variance-authority";

import { mergeProps, useRender } from "@base-ui/react";
import { cva } from "class-variance-authority";

import { cn } from "#lib/cn";

const textVariants = cva("", {
  variants: {
    size: {
      xs: "text-xs",
      sm: "text-sm",
      base: "text-base",
      lg: "text-lg",
      xl: "text-xl",
    },
    tone: {
      default: "text-foreground",
      muted: "text-muted-foreground",
      subtle: "text-subtle-foreground",
      accent: "text-accent",
      /* Paints from the ambient `--tone` set by an enclosing record. */
      record: "tone-fg",
      /* The console's only true emphasis: swap ink and surface. */
      inverted: "bg-inverted px-1.25 text-inverted-foreground",
    },
    tracking: {
      normal: "",
      wide: "tracking-wide",
      wider: "tracking-wider",
      widest: "tracking-widest",
      brand: "tracking-brand",
    },
    weight: {
      normal: "font-normal",
      bold: "font-bold",
    },
    caps: {
      true: "uppercase",
      false: "",
    },
  },
  defaultVariants: {
    size: "base",
    tone: "default",
    tracking: "normal",
    weight: "normal",
    caps: false,
  },
});

export type TextProps = useRender.ComponentProps<"span"> &
  VariantProps<typeof textVariants> & {
    as?: Extract<keyof React.JSX.IntrinsicElements, "span" | "p" | "div" | "code">;
  };

export function Text({
  className,
  as = "span",
  size = "base",
  tone = "default",
  tracking = "normal",
  weight = "normal",
  caps = false,
  render,
  ...props
}: TextProps) {
  return useRender({
    defaultTagName: as,
    props: mergeProps<"span">(
      { className: textVariants({ size, tone, tracking, weight, caps, className }) },
      props,
    ),
    render,
    state: { slot: "text" },
  });
}

const headingVariants = cva("font-normal", {
  variants: {
    size: {
      base: "text-base",
      lg: "text-lg",
      xl: "text-xl",
    },
  },
  defaultVariants: {
    size: "lg",
  },
});

export type HeadingProps = React.ComponentProps<"h2"> &
  VariantProps<typeof headingVariants> & {
    as?: Extract<keyof React.JSX.IntrinsicElements, "h1" | "h2" | "h3" | "h4" | "h5" | "h6">;
    /** Frames the heading as a shell prompt: a sigil in front, a caret behind. */
    prompt?: boolean;
  };

export function Heading({
  className,
  as: Tag = "h2",
  size = "lg",
  prompt = false,
  children,
  ...props
}: HeadingProps) {
  return (
    <Tag
      data-slot="heading"
      className={cn(headingVariants({ size }), "tracking-wide", className)}
      {...props}
    >
      {prompt && (
        <span aria-hidden="true" className="text-accent">
          {"> "}
        </span>
      )}
      {children}
      {prompt && (
        <span aria-hidden="true" className="animate-blink">
          _
        </span>
      )}
    </Tag>
  );
}

export { headingVariants, textVariants };
