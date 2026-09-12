import { expect } from "storybook/test";

import preview from "#storybook/preview";

import { AppShell } from "./AppShell";

const meta = preview.meta({
  component: AppShell,
  args: {
    children: <div className="p-2.5">Screen content</div>,
    version: "a1b2c3d4e5f67890",
  },
  parameters: {
    layout: "fullscreen",
  },
});

export const Default = meta.story({
  play: async ({ canvas }) => {
    await expect(canvas.getByText("version a1b2c3d")).toBeVisible();
  },
});
