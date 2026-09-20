import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

import {
  composite,
  contrast,
  hex,
  readBlock,
  resolve,
  toRgb,
  type Palette,
  type Rgb,
} from "./palette.ts";

const css = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../../styles.css"),
  "utf8",
);

/**
 * Deliberately below WCAG AA's 4.5:1 for normal text: the console buys a quieter
 * ink scale with it. Kept in step with the axe threshold in `.storybook/preview`.
 */
const MIN_CONTRAST = 4;

/** Every rule that states the palette. Light is declared twice and must not drift. */
const THEMES = {
  dark: [":root {"],
  light: [':root[data-theme="light"] {', ':root:not([data-theme="dark"]) {'],
};

const paletteFor = (selector: string): Palette => resolve(readBlock(css, selector));

/** `tone-tint` and `tone-hatch` lay the tone over whatever surface is behind it. */
const OVERLAYS = { tint: 0.1, hatch: 0.13 };
const TONES = ["--done", "--missed", "--skipped", "--seal"];

/**
 * Every background a run of text can end up on: the surface scale, and each
 * record tone laid over the two surfaces a record is ever drawn on.
 */
function canvases(palette: Palette): [string, Rgb][] {
  const at = (name: string) => toRgb(palette[name]!);
  const bases: [string, Rgb][] = [
    ["surface", at("--surface")],
    ["panel", at("--surface-panel")],
    ["chrome", at("--surface-chrome")],
  ];
  const overlaid = TONES.flatMap((tone) =>
    Object.entries(OVERLAYS).flatMap(([overlay, alpha]) =>
      bases
        .slice(0, 2)
        .map(([base, rgb]): [string, Rgb] => [
          `${tone.slice(2)}-${overlay} on ${base}`,
          composite(at(tone), rgb, alpha),
        ]),
    ),
  );

  return [...bases, ...overlaid];
}

/** The lowest ratio `ink` reaches anywhere it can be drawn. */
const worst = (palette: Palette, ink: string) =>
  Math.min(
    ...canvases(palette).map(([, background]) => contrast(toRgb(palette[ink]!), background)),
  );

const belowMinimum = (palette: Palette, ink: string) =>
  canvases(palette)
    .map(([name, background]) => [name, contrast(toRgb(palette[ink]!), background)] as const)
    .filter(([, ratio]) => ratio < MIN_CONTRAST)
    .map(([name, ratio]) => `${hex(toRgb(palette[ink]!))} on ${name}: ${ratio.toFixed(2)}`);

describe.each(Object.entries(THEMES))("%s palette", (_theme, selectors) => {
  const palette = paletteFor(selectors[0]!);

  it("is stated identically by every rule that declares it", () => {
    const restated = selectors.slice(1).map((selector) => [selector, paletteFor(selector)]);

    expect(restated).toStrictEqual(selectors.slice(1).map((selector) => [selector, palette]));
  });

  // The ink scale and the record tones are all used as body text, at sizes well
  // under the large-text threshold, so every one of them owes the full 4.5:1.
  it.each(["--ink", "--ink-dim", "--ink-dimmer", ...TONES])(
    "reads %s against every surface it lands on",
    (ink) => {
      expect(belowMinimum(palette, ink)).toStrictEqual([]);
    },
  );

  it.each(TONES)("reads its contrast ink on a solid %s fill", (tone) => {
    expect(contrast(toRgb(palette["--on-vivid"]!), toRgb(palette[tone]!))).toBeGreaterThanOrEqual(
      MIN_CONTRAST,
    );
  });

  it("reads the inverted surface on the inverted fill", () => {
    expect(contrast(toRgb(palette["--surface"]!), toRgb(palette["--ink"]!))).toBeGreaterThanOrEqual(
      MIN_CONTRAST,
    );
  });

  it("keeps the ink scale a scale", () => {
    // Three steps, each still clear of the one below, rather than three names for
    // one grey once the faintest is dragged down to the floor. The margin is
    // narrow because dark has little room: its body ink only reaches 9.10:1.
    expect(worst(palette, "--ink-dim")).toBeGreaterThan(worst(palette, "--ink-dimmer") * 1.15);
    expect(worst(palette, "--ink")).toBeGreaterThan(worst(palette, "--ink-dim") * 1.15);
  });

  it(`holds every ink at or above ${MIN_CONTRAST}:1`, () => {
    expect(
      Math.min(worst(palette, "--ink-dimmer"), ...TONES.map((tone) => worst(palette, tone))),
    ).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });
});
