import "../src/styles.css";
import { definePreview } from "@storybook/tanstack-react";

export default definePreview({
  addons: [],
  parameters: {
    layout: "centered",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /date$/i,
      },
    },
  },
});
