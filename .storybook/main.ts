import { defineMain } from "@storybook/tanstack-react/node";

export default defineMain({
  framework: "@storybook/tanstack-react",
  stories: ["../src/ui/**/*.stories.tsx"],
  addons: [],
});
