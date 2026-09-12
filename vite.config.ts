/// <reference types="vitest/config" />
import { defineOxlintConfig } from "@fullstacksjs/oxlint-config";
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
    ignorePatterns: [".design-sync/**", "convex/_generated/**", "src/routeTree.gen.ts"],
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
    ignorePatterns: [".design-sync/**", "convex/_generated/**", "src/routeTree.gen.ts"],
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
        files: ["**/*.spec.ts", "**/*.spec.tsx"],
        rules: {
          "max-lines-per-function": "off",
          // Installing Vitest directly exposes rules that conflict with the existing suite's style.
          "vitest/consistent-test-it": "off",
          "vitest/expect-expect": "off",
          "vitest/no-conditional-in-test": "off",
          "vitest/prefer-describe-function-title": "off",
          "vitest/prefer-expect-resolves": "off",
          "vitest/prefer-todo": "off",
        },
      },
      {
        files: ["**/*.stories.tsx", ".storybook/*.tsx"],
        rules: {
          "react-hooks/rules-of-hooks": "off",
          "react/only-export-components": "off",
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
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [
              {
                browser: "chromium",
              },
            ],
          },
        },
      },
    ],
  },
});
