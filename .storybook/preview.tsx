import "../src/styles.css";
import { definePreview } from "@storybook/tanstack-react";
import isChromatic from "chromatic/isChromatic";
import { sb } from "storybook/test";

sb.mock(import("@convex-dev/auth/react"));

// Chromatic pauses finite animations on their last frame, but `blink` loops forever, so a
// snapshot would catch the cursor at a random point in its cycle. Freeze it on the lit frame
// so diffs stay about the design rather than the timing.
if (isChromatic()) {
  const style = document.createElement("style");
  style.textContent = ".animate-blink { animation: none; opacity: 1; }";
  document.head.append(style);
}

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
