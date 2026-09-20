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
  // `system` leaves `data-theme` off so the stylesheet's `prefers-color-scheme`
  // branch decides. That is what lets the browser emulation in the test run pick
  // the palette, and it keeps Chromatic rendering the one mode it always has.
  initialGlobals: { theme: "system" },
  globalTypes: {
    theme: {
      description: "Palette the story is painted in",
      toolbar: {
        title: "Theme",
        icon: "contrast",
        dynamicTitle: true,
        items: [
          { value: "system", title: "System", icon: "browser" },
          { value: "light", title: "Light", icon: "sun" },
          { value: "dark", title: "Dark", icon: "moon" },
        ],
      },
    },
  },
  decorators: [
    (Story, { globals }) => {
      const root = document.documentElement;

      if (globals.theme === "light" || globals.theme === "dark") {
        root.setAttribute("data-theme", globals.theme);
      } else {
        root.removeAttribute("data-theme");
      }

      return <Story />;
    },
  ],
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
        // Deliberately below WCAG AA, which asks 4.5:1 of normal-size text. The
        // console trades some of that back for a quieter ink scale; `large` is
        // left where WCAG puts it, and at this type scale almost nothing is large.
        //
        // `axe.configure` replaces a check's options rather than merging them, so
        // every one of axe's defaults has to be restated here. Dropping any of
        // them is silent: without `largeTextPt` the size test reads every node as
        // large text and quietly checks the whole app at 3:1.
        checks: [
          {
            id: "color-contrast",
            options: {
              ignoreUnicode: true,
              ignoreLength: false,
              ignorePseudo: false,
              boldValue: 700,
              boldTextPt: 14,
              largeTextPt: 18,
              contrastRatio: { normal: { expected: 4 }, large: { expected: 3 } },
              pseudoSizeThreshold: 0.25,
              shadowOutlineEmMax: 0.2,
              textStrokeEmMin: 0.03,
            },
          },
        ],
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
