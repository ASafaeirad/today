# design-sync notes — VIGIL (src/ui)

Repo-specific findings for syncing this design system to claude.ai/design.
Read this before touching anything; every bullet is a debugging cycle you
don't have to repeat.

## Shape

- Storybook shape. `.storybook/main.ts` at repo root, stories under
  `src/ui/**/*.stories.tsx` (17 components, 27 stories).
- pnpm workspace; install with `pnpm i --frozen-lockfile`.
- The reference storybook must be built before the converter runs:
  `npx storybook build -c .storybook -o "$(git rev-parse --show-toplevel)/.design-sync/sb-reference"`.

## Fixes applied

- `[GENERAL]` **No declaration tree existed, so the converter found 0
  components.** This is an app repo, not a published package: there is no
  library build and `package.json` has no `types`, so the converter's `.d.ts`
  export enumeration (which is how components are discovered at all) came back
  empty and every storybook title was dropped as `[TITLE_UNMAPPED]`.
  Fix: `.design-sync/build-types.sh` emits `src/ui` declarations to
  `dist/types/` via `.design-sync/tsconfig.dts.json` and writes the root
  `index.d.ts` entry the converter reads (`pkgJson.types` is absent, so it
  falls back to `<repoRoot>/index.d.ts`). Both outputs are gitignored build
  products — **re-run `sh .design-sync/build-types.sh` before every converter
  run**, or the component count silently drops to 0.
- `[GENERAL]` **Stories use Storybook CSF *factories*** — `definePreview(...)`
  → `preview.meta({component})` → `meta.story({...})`, with no default export.
  The converter's inert `@storybook/*` stub has no `definePreview` own
  property, and esbuild's CJS interop copies named imports from own enumerable
  props only, so `definePreview` resolved to `undefined` and all 17 previews
  died with `TypeError: definePreview is not a function`.
  Fix: forked `lib/story-imports.mjs` → `.design-sync/overrides/story-imports.mjs`
  (declared in `cfg.libOverrides`), adding a real factory chain that returns
  plain CSF objects with preview→meta→story precedence pre-merged. Pre-merging
  matters: the generated wrapper's `compose()` reads meta from `S.default`,
  which CSF factories never export, so meta-level args/parameters/decorators
  would otherwise be dropped.
- `[GRID_OVERFLOW]` Meter (`cardMode: "single"`, `primaryStory: "Matrix"`) and
  Row (`cardMode: "column"`) — presentation-only overrides; grades carry.

## Non-issues (don't go chasing these)

- **No webfonts.** `--font-mono`/`--font-sans` are the `ui-monospace` system
  stack; nothing from `@fontsource-*` reaches `src/`. `[FONT_MISSING]` is not a
  risk here, and both compare panels legitimately render the same system mono.
- **No CSS dist sidecar.** Tailwind v4 builds the CSS through vite, so the
  converter takes the `[CSS_FROM_STORYBOOK]` path and scrapes the compiled
  stylesheet out of `sb-reference`. That is the intended route, not a fallback
  to fix.
- **Previews render in light mode.** The DS defaults to dark
  (`color-scheme: dark`) but headless chromium reports
  `prefers-color-scheme: light`, so both compare panels show the light theme.
  Consistent on both sides — not a mismatch.

## Re-sync risks

- `dist/types/` + root `index.d.ts` are gitignored and regenerated. A fresh
  clone that skips `build-types.sh` produces a **silently empty** sync (0
  components, build still exits 0). Check the build log's
  `exported PascalCase symbols:` line — it must not be 0.
- The `story-imports.mjs` fork tracks Storybook's CSF-factory semantics. If
  this repo upgrades Storybook (currently 10.5.7 / `@storybook/tanstack-react`)
  and the factory shape changes, previews break at the stub, not at the DS.
  Re-check the fork against `node_modules/@storybook/tanstack-react/dist/index.js`.
- `dist/` is also the app's vite build output; `vp build` wipes `dist/types/`.
  Re-run `build-types.sh` after any app build.
- **Dialog is verified trigger-only.** All three Dialog stories render just
  their trigger button in storybook too (the dialog is interaction-opened), so
  the open overlay, its backdrop, and its portal stacking have never been
  verified by the compare oracle. If Dialog's open state regresses, no grade
  here will catch it.

## Defined in source but absent from the build

Tailwind v4 emits only the utilities the DS source actually uses, so
`_ds_bundle.css` is a partial set. These are declared in
`src/lib/styles/variants.css` but never used, so they do **not** ship and must
not be named in `conventions.md`:

- `tone-rail-dashed`
- `grid-record-full`

Same rule bites standard utilities: `gap-1`/`gap-2`, `px-2`, `flex`, `grid`,
`items-center` ship (the DS used them) while `p-4`, `p-2` and `rounded-sm`
don't. If a component starts using one of the absent ones, re-check
`conventions.md` — its "unlisted classes do nothing" section names specific
examples that must stay true.
