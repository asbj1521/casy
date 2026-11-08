/**
 * Keeps CasyUI's colours equal to the phone's on the web (Theme.swift): every
 * token, light and dark, read from the stylesheets. A colour changed there
 * fails here until UPDATE_PARITY=1 npx vitest run src/lib/parity/theme, and
 * then fails the Swift tests until Theme.swift is changed too.
 */
import { describe, expect, it } from "vitest";

// Vitest empties a stylesheet even when asked for its text (?raw), so these are
// read from disk, Node named through a variable as the app's TypeScript has no
// types for it.
const fsModule: string = "node:fs";
const fs = (await import(/* @vite-ignore */ fsModule)) as {
  readFileSync: (path: string, encoding: "utf8") => string;
  writeFileSync: (path: string, text: string) => void;
};
const FIXTURE = "ios/Packages/CasyUI/Tests/CasyUITests/Fixtures/colors.json";
const indexCss = fs.readFileSync("src/index.css", "utf8");
const themeCss = fs.readFileSync("src/theme.css", "utf8");

type Rgb = [number, number, number];

/** A CSS variable's first value after `from` in `css`. */
function variable(css: string, name: string, from = 0): string {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(css.slice(from));
  if (!match) throw new Error(`No --${name}`);
  return match[1].trim();
}

function hslToRgb(value: string): Rgb {
  const [h, s, l] = value.split(/\s+/).map((part) => parseFloat(part));
  const saturation = s / 100;
  const lightness = l / 100;
  const a = saturation * Math.min(lightness, 1 - lightness);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [channel(0), channel(8), channel(4)];
}

const rgb = (value: string) => value.split(/\s+/).map(Number) as Rgb;

const DARK = themeCss.indexOf("@media (prefers-color-scheme: dark)");
/** The phone's own values, which win over :root on a phone (index.css). */
const PHONE = indexCss.indexOf("@media (max-width: 767.98px)");

const hsl = (name: string, phoneOwn = false) => ({
  light: hslToRgb(variable(indexCss, name, phoneOwn ? PHONE : 0)),
  dark: hslToRgb(variable(themeCss, name, DARK)),
});
const plain = (name: string) => ({
  light: rgb(variable(themeCss, name)),
  dark: rgb(variable(themeCss, name, DARK)),
});

function colors(): Record<string, { light: Rgb; dark: Rgb }> {
  const out: Record<string, { light: Rgb; dark: Rgb }> = {
    primary: hsl("primary", true),
    primaryForeground: hsl("primary-foreground"),
    cta: plain("cta"),
    background: hsl("background"),
    foreground: hsl("foreground"),
    card: hsl("card"),
    cardForeground: hsl("card-foreground"),
    secondary: hsl("secondary"),
    secondaryForeground: hsl("secondary-foreground"),
    muted: hsl("muted"),
    mutedForeground: hsl("muted-foreground"),
    border: hsl("border"),
    everyone: hsl("everyone"),
  };
  const shades: [string, number[]][] = [
    ["emerald", [50, 100, 200, 700, 800, 900]],
    ["sky", [100, 700]],
    ["amber", [50, 100, 200, 700, 800, 900]],
    ["violet", [100, 700]],
    ["rose", [100, 700]],
    ["red", [50, 200, 600, 700, 900]],
  ];
  for (const [family, list] of shades) {
    for (const shade of list) out[`${family}${shade}`] = plain(`c-${family}-${shade}`);
  }
  return out;
}

const written = `${JSON.stringify(colors(), null, 2)}\n`;

describe("the phone's colours", () => {
  it("uses the phone's deeper orange in light mode", () => {
    expect(colors().primary.light).not.toEqual(hslToRgb("20 90% 48%"));
  });

  it.runIf(import.meta.env.UPDATE_PARITY)("are written", () => {
    fs.writeFileSync(FIXTURE, written);
  });

  it.skipIf(import.meta.env.UPDATE_PARITY)("are what the Swift tests read", () => {
    expect(written === fs.readFileSync(FIXTURE, "utf8")).toBe(true);
  });
});
