import { defineMain } from "@storybook/tanstack-react/node";

export default defineMain({
  framework: "@storybook/tanstack-react",
  stories: ["../src/**/*.stories.tsx"],
  addons: ["@storybook/addon-vitest", "@storybook/addon-a11y"],
});
