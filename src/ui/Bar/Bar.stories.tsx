import preview from "#storybook/preview";

import { Button } from "../Button/Button.tsx";
import { Kbd } from "../Kbd/Kbd.tsx";
import { Bar, BarBrand, BarItem, BarSpacer, type BarProps } from "./Bar.tsx";

const meta = preview.meta({
  component: Bar,
  parameters: { layout: "fullscreen" },
});

const variants = ["chrome", "panel", "accent", "note"] satisfies BarProps["variant"][];

export const Matrix = meta.story({
  render: () => (
    <div className="flex flex-col gap-8">
      {variants.map((variant) => (
        <div key={variant}>
          <p className="px-2.5 py-1.25 text-xs tracking-widest text-subtle-foreground uppercase">
            {variant}
          </p>
          {variant === "accent" || variant === "note" ? (
            <Bar variant={variant}>
              <span className="px-2.5 py-1.25">seal 2026-08-28</span>
              <BarSpacer />
              <span className="px-2.5 py-1.25">stage 1/3 · resolve</span>
            </Bar>
          ) : (
            <Bar variant={variant}>
              <BarBrand>VIGIL</BarBrand>
              <BarItem label="day">2026-08-28</BarItem>
              <BarItem label="res" tone="done">
                6/8
              </BarItem>
              <BarItem label="backlog" tone="seal">
                2
              </BarItem>
              <BarSpacer />
              <BarItem label="mode" divided={false}>
                RW
              </BarItem>
            </Bar>
          )}
        </div>
      ))}
    </div>
  ),
});

export const Footer = meta.story({
  render: () => (
    <Bar placement="bottom">
      {[
        ["h l", "day"],
        ["j k", "routine"],
        ["d", "done"],
        ["m", "missed"],
        ["s", "skipped"],
      ].map(([key, action]) => (
        <BarItem key={key} tone="muted" label={<Kbd>{key}</Kbd>}>
          {action}
        </BarItem>
      ))}
      <BarSpacer />
      <Button variant="accent" size="lg" className="border-l border-border">
        Z · SEAL
      </Button>
    </Bar>
  ),
});
