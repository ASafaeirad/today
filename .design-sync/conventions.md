## VIGIL — how to build with it

A console design system. Everything cuts, nothing fades: elevation is drawn
with 1px lines, never shadow; emphasis inverts ink and surface, never rounds.
`--radius` is `0rem` by contract — square is a design decision, so don't add
rounding. Type is monospace everywhere (the sans stack resolves to
`--font-mono`), sizes run small (base is 12px), and caps + letter-spacing carry
hierarchy instead of weight.

### Setup

No provider, no theme context — components read CSS custom properties, so
nothing needs wrapping. Link `_ds/<folder>/styles.css` once and render
components directly.

Theme is an attribute on the root element:

```jsx
// dark is the default; `data-theme` pins a mode against the OS preference
<html data-theme="dark">   // or "light", or omit to follow prefers-color-scheme
```

Set a page background and foreground yourself — the DS styles components, not
your document: `<div className="bg-background text-foreground font-mono">`.

### The styling idiom: tones, not colors

Status color is a **channel**, not a per-element class. Set ONE `tone-*` on a
container; every part below paints itself from `--tone` / `--tone-contrast`:

| Family | Names |
|---|---|
| Set the tone | `tone-neutral` `tone-muted` `tone-ink` `tone-done` `tone-missed` `tone-skipped` `tone-seal` |
| Paint from it | `tone-fg` (ink) `tone-bg` (fill + contrast ink) `tone-border` `tone-tint` (wash) `tone-hatch` (stripes) `tone-rail` |

Five components carry the tone as a prop — Badge, Meter, Toggle (`"done" |
"missed" | "skipped" | "seal" | "ink"`), plus Text and Label with their own
typographic unions. **Prefer the prop** where it exists; the unions differ per
component, so check the `.d.ts`. Row is the exception worth memorizing: it
takes `status` (`"done" | "missed" | "skipped" | "open"`) and `current`, not a
tone. Reach for `tone-*` classes only on your own layout wrappers.

Surfaces and ink, as utilities: `bg-background` `bg-panel` `bg-chrome`
`bg-inverted` `bg-overlay` `border-border` · `text-foreground`
`text-muted-foreground` `text-subtle-foreground` `text-inverted-foreground`
`text-accent`.

Type: `text-xs` `text-sm` `text-base` `text-lg` `text-xl` ·
`tracking-wide` `tracking-wider` `tracking-widest` `tracking-brand` ·
`uppercase` `font-mono`.

Layout helpers: `grid-record` (index + name columns) · `grid-terminal`
(header / body / footer rows) · `joined` (controls sharing one 1px line —
collapses the seam between adjacent buttons) · `icon-inline` (an icon measures
like a character) · `no-scrollbar`.

Motion is stepped, never eased: `animate-cut` `animate-blink` `animate-fill`.

### ⚠ The stylesheet is pre-compiled — unlisted classes do nothing

There is no Tailwind runtime here: `_ds_bundle.css` contains only the classes
the DS source actually used. Anything else silently does **nothing** — no
error, just unstyled output. `bg-done`, `text-missed`, `p-4` and `rounded-sm`
all fail this way (status color goes through `tone-*`, and the system is
square).

Standard Tailwind utilities are a partial set: `flex`, `grid`,
`items-center`, `gap-1`/`gap-2` and `px-2` ship because the DS used them,
while most spacing scales don't. **Grep `_ds_bundle.css` before relying on a
utility that isn't in the tables above** — and for layout glue of your own,
just use `style`, which always works:

```jsx
<div style={{ padding: "0.5rem", borderBottom: "1px solid var(--border)" }}>
```

Tokens: `--background` `--foreground` `--panel` `--chrome` `--border`
`--ring` `--muted-foreground` `--subtle-foreground` `--inverted`
`--inverted-foreground` `--accent` `--overlay` · status `--done` `--missed`
`--skipped` `--seal` (each with a `-foreground` twin) · `--tone`
`--tone-contrast`.

### Where the truth lives

Read before styling: `_ds/<folder>/styles.css` and the `_ds_bundle.css` it
imports (the authoritative class list), plus
`components/ui/<Name>/<Name>.prompt.md` and `.d.ts` for each component's real
props.

### An idiomatic build

```jsx
const { Panel, PanelBody, Row, RowHeader, RowIndex, RowName, RowStatus, Button } = window.Vigil;

<Panel className="bg-panel">
  <PanelBody>
    <RowHeader>
      <span>#</span>
      <span>routine</span>
      <span>state</span>
    </RowHeader>
    {routines.map((r, i) => (
      <Row key={r.id} status={r.status} current={i === cursor}>
        <RowIndex>{String(i + 1).padStart(2, "0")}</RowIndex>
        <RowName>{r.name}</RowName>
        <RowStatus typed>{r.status}</RowStatus>
      </Row>
    ))}
  </PanelBody>
  <div className="joined" style={{ display: "flex", borderTop: "1px solid var(--border)" }}>
    <Button variant="outline" size="sm">done</Button>
    <Button variant="accent" size="sm">seal</Button>
  </div>
</Panel>
```
