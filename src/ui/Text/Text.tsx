import type { VariantProps } from "class-variance-authority";

import { mergeProps, useRender } from "@base-ui/react";
import { cva } from "class-variance-authority";

import { cn } from "#lib/styles/cn.ts";

const textVariants = cva("", {
  variants: {
    size: {
      xs: "text-xs",
      sm: "text-sm",
      base: "text-base",
      lg: "text-lg",
      xl: "text-xl",
    },
    weight: {
      normal: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
    },
  },
  defaultVariants: {
    size: "base",
    weight: "normal",
  },
});

export type TextProps = useRender.ComponentProps<"span"> &
  VariantProps<typeof textVariants> & {
    as?: Extract<keyof React.JSX.IntrinsicElements, "span" | "p" | "div">;
  };

export function Text({
  className,
  as = "span",
  size = "base",
  weight = "normal",
  render,
  ...props
}: TextProps) {
  return useRender({
    defaultTagName: as,
    props: mergeProps<"span">({ className: textVariants({ size, weight, className }) }, props),
    render,
    state: {
      slot: "text",
    },
  });
}

export type HeadingProps = useRender.ComponentProps<"h1"> &
  Omit<VariantProps<typeof textVariants>, "weight">;

export function Heading({
  className,
  as,
  size,
  render,
  ...props
}: HeadingProps & {
  as: Extract<keyof React.JSX.IntrinsicElements, "h1" | "h2" | "h3" | "h4" | "h5" | "h6">;
}) {
  return useRender({
    defaultTagName: as,
    props: mergeProps<"h1">(
      { className: cn(textVariants({ size, weight: "semibold" }), "font-display", className) },
      props,
    ),
    render,
    state: {
      slot: "heading",
    },
  });
}
