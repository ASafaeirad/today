import { defineOxlintConfig } from "@fullstacksjs/oxlint-minimal";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

const dirname =
  typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

const ignorePatterns = [".design-sync/**", "convex/_generated/**", "src/routeTree.gen.ts"];
// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [tanstackRouter(), react(), tailwindcss()],
  staged: {
    "*": ["vp check --fix", "cspell"],
  },
  fmt: {
    ignorePatterns,
    sortImports: {
      groups: [
        "type-import",
        ["value-builtin", "value-external"],
        "type-internal",
        "value-internal",
        ["type-parent", "type-sibling", "type-index"],
        ["value-parent", "value-sibling", "value-index"],
        "unknown",
      ],
    },
  },
  resolve: {
    tsconfigPaths: true,
  },
  lint: defineOxlintConfig({
    ignorePatterns,
    jsPlugins: [
      {
        name: "vite-plus",
        specifier: "vite-plus/oxlint-plugin",
      },
    ],
    rules: {
      "react/only-export-components": "off",
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    overrides: [
      {
        // A Convex mutation is one transaction and its writes are ordered.
        // Promise.all would drop that order, so awaiting in a loop is the correct shape here.
        files: ["convex/**/*.ts"],
        rules: {
          "no-await-in-loop": "off",
        },
      },
      {
        files: ["**/*.spec.ts", "**/*.spec.tsx", "**/*.stories.tsx", ".storybook/*.tsx"],
        rules: {
          "vitest/no-conditional-in-test": "off",
        },
      },
    ],
    options: {
      typeAware: true,
      typeCheck: true,
      esm: false,
    },
  }),
  test: {
    projects: [
      {
        extends: true,
        test: {
          globals: true,
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          // Runs before the browser project rather than beside it. See below.
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, ".storybook"),
          }),
        ],
        test: {
          name: "storybook",
          // Each story runs once per theme, so this project asks for twice the
          // browsers it used to. Run it after the Node project instead of
          // alongside it: sharing a machine with that many Chromium workers
          // pushed the Convex simulations past their timeouts.
          sequence: { groupOrder: 1 },
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            // The palette is chosen by `prefers-color-scheme`, so emulating it is
            // what puts a story in a theme. Both instances share one Storybook
            // setup; every story, play function and axe pass runs in each.
            instances: (["light", "dark"] as const).map((colorScheme) => ({
              browser: "chromium",
              name: colorScheme,
              provider: playwright({ contextOptions: { colorScheme } }),
            })),
          },
        },
      },
    ],
  },
});
