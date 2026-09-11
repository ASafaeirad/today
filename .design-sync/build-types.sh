#!/usr/bin/env sh
# Emits the UI kit's declaration tree (src/ui -> dist/types) plus the root
# index.d.ts entry the design-sync converter reads to enumerate components.
# Both outputs are gitignored build products; re-run via cfg.buildCmd.
set -e
cd "$(dirname "$0")/.."
npx tsc -p .design-sync/tsconfig.dts.json
printf 'export * from "./dist/types/ui/index";\n' > index.d.ts
