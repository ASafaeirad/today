import { defineConfig } from "cspell";

export default defineConfig({
  version: "0.2",
  words: [
    "vite",
    "fullstacksjs",
    "ASafaeirad",
    "unreviewed",
    "rebuildable",
    "recomputable",
    "disciplinarily",
    "endable",
    "lookback",
  ],
  dictionaries: ["project-words"],
  ignorePaths: [
    "node_modules",
    "*.svg",
    "pnpm-workspace.yaml",
    "pnpm-lock.yaml",
    "dist/",
    "vite-hooks/",
  ],
});
