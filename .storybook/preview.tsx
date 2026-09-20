import "../src/styles.css";
import a11y from "@storybook/addon-a11y";
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
  addons: [a11y()],
  parameters: {
    layout: "centered",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /date$/i,
      },
    },
    a11y: {
      config: {
        rules: [
          // A story is an isolated fragment, not a page: the landmark rules would
          // fire on every one of them for a reason the app itself does not have.
          { id: "region", enabled: false },
          { id: "landmark-one-main", enabled: false },
          { id: "page-has-heading-one", enabled: false },
          // WCAG 1.4.3 exempts text that belongs to an inactive control, which is
          // exactly what the `data-disabled:opacity-50` treatment marks. axe cannot
          // read that intent off a `<label>` or `<p>`, so scope the rule past it.
          {
            id: "color-contrast",
            selector:
              "*:not([data-disabled]:not([data-disabled='false']) *):not([data-disabled]:not([data-disabled='false']))",
          },
        ],
      },
      // Violations fail the Vitest run rather than only reporting in the panel.
      test: "error",
    },
  },
});
