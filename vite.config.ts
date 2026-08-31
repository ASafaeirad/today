import { defineOxlintConfig } from "@fullstacksjs/oxlint-config";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [tanstackRouter(), react(), tailwindcss()],
  staged: {
    "*": ["vp check --fix", "cspell"],
  },
  fmt: {
    ignorePatterns: ["convex/_generated/**", "src/routeTree.gen.ts"],
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
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
  lint: defineOxlintConfig({
    ignorePatterns: ["convex/_generated/**", "src/routeTree.gen.ts"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true, esm: false },
  }),
});
