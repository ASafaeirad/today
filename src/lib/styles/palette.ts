/**
 * Resolves the palette that `styles.css` declares so it can be measured.
 *
 * The stylesheet is the single source of the theme: the hues live there and the
 * scale steps are written as relative colors off them. Nothing here re-states a
 * color — it reads the declarations back out and does the arithmetic the browser
 * would do, so a contrast check runs against the palette that actually ships.
 */

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export type Palette = Record<string, Hsl>;

const DECLARATION = /^\s*(--[\w-]+)\s*:\s*([^;]+);/gm;

/** Pulls one flat rule's custom properties out of the stylesheet, in source order. */
export function readBlock(css: string, selector: string): Map<string, string> {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`no rule for \`${selector}\``);

  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  const body = css.slice(open + 1, close);

  return new Map(
    Array.from(body.matchAll(DECLARATION), ([, name, value]) => [name!, value!.trim()]),
  );
}

const ABSOLUTE = /^hsl\(\s*(-?[\d.]+)\s*,?\s*(-?[\d.]+)%\s*,?\s*(-?[\d.]+)%\s*\)$/;
const RELATIVE =
  /^hsl\(\s*from\s+var\((--[\w-]+)\)\s+(\S+)\s+(\S+|calc\([^)]*\))\s+(\S+|calc\([^)]*\))\s*\)$/;
const ALIAS = /^var\((--[\w-]+)\)$/;
const CHANNEL = /^(?:calc\(\s*([hsl])\s*([+-])\s*(-?[\d.]+)\s*\)|([hsl])|(-?[\d.]+))$/;

/** `l`, `calc(l + 2)` or a literal, against the color being derived from. */
function channel(token: string, from: Hsl): number {
  const match = CHANNEL.exec(token);
  if (!match) throw new Error(`unreadable channel \`${token}\``);

  const [, ref, sign, amount, passthrough, literal] = match;
  if (literal !== undefined) return Number(literal);
  if (passthrough !== undefined) return from[passthrough as keyof Hsl];

  const delta = Number(amount) * (sign === "-" ? -1 : 1);
  return from[ref as keyof Hsl] + delta;
}

/**
 * Resolves every color-valued custom property in a rule, following `var()`
 * aliases and `hsl(from …)` derivations against what came before them.
 */
export function resolve(declarations: Map<string, string>, inherited: Palette = {}): Palette {
  const palette: Palette = { ...inherited };

  for (const [name, value] of declarations) {
    const absolute = ABSOLUTE.exec(value);
    if (absolute) {
      palette[name] = { h: Number(absolute[1]), s: Number(absolute[2]), l: Number(absolute[3]) };
      continue;
    }

    const alias = ALIAS.exec(value);
    if (alias) {
      const target = palette[alias[1]!];
      if (target) palette[name] = target;
      continue;
    }

    const relative = RELATIVE.exec(value);
    if (relative) {
      const [, base, h, s, l] = relative;
      const from = palette[base!];
      if (!from) throw new Error(`\`${name}\` derives from unresolved \`${base}\``);
      palette[name] = { h: channel(h!, from), s: channel(s!, from), l: channel(l!, from) };
    }
  }

  return palette;
}

export type Rgb = [number, number, number];

const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value));

export function toRgb({ h, s, l }: Hsl): Rgb {
  const hue = ((h % 360) + 360) % 360;
  const saturation = clamp(s, 100) / 100;
  const lightness = clamp(l, 100) / 100;

  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const sector = hue / 60;
  const x = chroma * (1 - Math.abs((sector % 2) - 1));
  const base = lightness - chroma / 2;
  const [r, g, b] = [
    [chroma, x, 0],
    [x, chroma, 0],
    [0, chroma, x],
    [0, x, chroma],
    [x, 0, chroma],
    [chroma, 0, x],
  ][Math.floor(sector) % 6]!;

  return [r!, g!, b!].map((channelValue) =>
    clamp(Math.round((channelValue + base) * 255), 255),
  ) as Rgb;
}

/** `color-mix(in srgb, top <alpha>, transparent)` laid over `bottom`. */
export const composite = (top: Rgb, bottom: Rgb, alpha: number): Rgb =>
  top.map((value, index) => Math.round(value * alpha + bottom[index]! * (1 - alpha))) as Rgb;

const linear = (value: number) => {
  const channelValue = value / 255;
  return channelValue <= 0.04045 ? channelValue / 12.92 : ((channelValue + 0.055) / 1.055) ** 2.4;
};

const luminance = ([r, g, b]: Rgb) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);

/** WCAG 2.x relative-luminance contrast, always >= 1. */
export function contrast(a: Rgb, b: Rgb): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}

export const hex = (rgb: Rgb) =>
  `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
