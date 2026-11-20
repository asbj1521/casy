/**
 * The web's icons for the native screens (#281): the lucide icons the web draws
 * (lucide-react, the version in package.json), written as SVG image assets into
 * CasyUI, so a Swift screen shows the very same drawing as its web screen, not
 * an SF Symbol that looks like it (docs/native-visual-parity.md, rule 1).
 *
 *   node scripts/native/lucide-icons.mjs          # write the assets
 *
 * Each asset is `lucide.<name>` (`lucide.<name>.<stroke>` for another stroke
 * width), a template image drawn as lucide draws it: 24 x 24, no fill, round
 * ends and joins, the stroke scaling with the size as lucide-react's does.
 * In Swift: `LucideIcon("layers", size: 20)`. A Vitest test
 * (src/lib/parity/lucideIcons.test.ts) fails when the assets differ from what
 * this writes, so a lucide update or a new icon is written here first.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
export const CATALOG = join(ROOT, "ios/Packages/CasyUI/Sources/CasyUI/Resources/Icons.xcassets");

/** The icons the native screens use: the lucide name, and the stroke widths drawn (2 by default). */
export const ICONS = {
  "arrow-right": [2],
  ban: [2],
  bell: [2],
  "book-user": [2],
  "bell-ring": [2],
  "calendar-check": [2],
  "calendar-days": [2],
  "calendar-heart": [2],
  "calendar-plus": [2],
  "calendar-range": [2],
  "calendar-search": [2],
  "calendar-x": [2],
  bus: [2],
  camera: [2],
  check: [2, 2.5, 3],
  "chevron-down": [2],
  "chevron-left": [2],
  "chevron-right": [2],
  "circle-arrow-up": [1.5],
  "circle-check": [2],
  "circle-question-mark": [2],
  "circle-x": [2],
  clock: [2, 3],
  contact: [2],
  copy: [2],
  database: [2],
  diff: [2],
  download: [2],
  "eye-off": [2],
  ellipsis: [2],
  "face-neutral": [2, 2.5, 3],
  "file-text": [2],
  globe: [2],
  flag: [2],
  hand: [2],
  hourglass: [2],
  image: [2],
  info: [2],
  "key-round": [2],
  languages: [2],
  layers: [2],
  "link-2": [2],
  "list-checks": [2],
  "life-buoy": [2],
  "loader-circle": [2],
  lock: [2],
  mail: [2],
  "map-pin": [2],
  "log-in": [2],
  "log-out": [2],
  "message-square": [2],
  "message-square-plus": [2],
  mic: [2],
  minus: [2, 3],
  monitor: [2],
  moon: [2],
  pencil: [2],
  plane: [2],
  plus: [2, 2.25],
  "qr-code": [2],
  "refresh-cw": [2],
  search: [2],
  "rotate-ccw": [2],
  settings: [2],
  share: [2],
  "shield-check": [2],
  sparkles: [2],
  smartphone: [2],
  star: [2],
  "sticky-note": [2],
  sun: [2],
  timer: [2],
  trash: [2],
  "train-front": [2],
  "triangle-alert": [2],
  user: [2],
  "user-plus": [2],
  "user-x": [2],
  users: [2],
  vote: [2],
  x: [2, 2.5, 3],
};

/**
 * The calendar providers' marks the web draws from react-icons (#281,
 * src/components/calendarProviders.tsx): `brand.<name>`, filled, in their
 * own viewBox. In Swift: `LucideIcon(brand: "google", size: 16)`.
 */
export const BRANDS = {
  apple: ["si", "SiApple"],
  google: ["si", "SiGoogle"],
  microsoft: ["fa6", "FaMicrosoft"],
};

/** The asset's name for an icon at a stroke width. */
export function assetName(icon, stroke) {
  return stroke === 2 ? `lucide.${icon}` : `lucide.${icon}.${stroke}`;
}

/** An icon's drawing, from lucide-react's own module (its exported `__iconData`). */
async function iconNode(icon) {
  const file = join(ROOT, "node_modules/lucide-react/dist/esm/icons", `${icon}.mjs`);
  const { __iconData } = await import(pathToFileURL(file).href);
  return __iconData.node;
}

const escape = (value) => String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/** The SVG for an icon, drawn black: the asset is a template, tinted where it is used. */
export async function svg(icon, stroke) {
  const parts = (await iconNode(icon)).map(([tag, attrs]) => {
    const list = Object.entries(attrs)
      .filter(([key]) => key !== "key")
      .map(([key, value]) => `${key}="${escape(value)}"`)
      .join(" ");
    return `  <${tag} ${list}/>`;
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">`,
    ...parts,
    "</svg>",
    "",
  ].join("\n");
}

/** A brand mark's SVG, from react-icons' own module (its GenIcon tree), drawn black. */
export function brandSvg(brand) {
  const [set, name] = BRANDS[brand];
  const source = readFileSync(join(ROOT, `node_modules/react-icons/${set}/index.mjs`), "utf8");
  const start = source.indexOf(`export function ${name} (props)`);
  const call = source.slice(start).match(/GenIcon\((\{.*\})\)\(props\)/);
  if (start < 0 || !call) throw new Error(`react-icons has no ${name}`);
  const tree = JSON.parse(call[1]);
  const paths = tree.child.map((child) => `  <path d="${escape(child.attr.d)}"/>`);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="${tree.attr.viewBox}" fill="#000000">`,
    ...paths,
    "</svg>",
    "",
  ].join("\n");
}

/** An image set's Contents.json: a vector template, tinted where it is used. */
const contents = (name) =>
  JSON.stringify(
    {
      images: [{ filename: `${name}.svg`, idiom: "universal" }],
      info: { author: "xcode", version: 1 },
      properties: {
        "preserves-vector-representation": true,
        "template-rendering-intent": "template",
      },
    },
    null,
    2,
  ) + "\n";

/** Every file of the catalog, by its path inside it. */
export async function catalogFiles() {
  const files = {
    "Contents.json": JSON.stringify({ info: { author: "xcode", version: 1 } }, null, 2) + "\n",
  };
  for (const [icon, strokes] of Object.entries(ICONS)) {
    for (const stroke of strokes) {
      const name = assetName(icon, stroke);
      files[`${name}.imageset/${name}.svg`] = await svg(icon, stroke);
      files[`${name}.imageset/Contents.json`] = contents(name);
    }
  }
  for (const brand of Object.keys(BRANDS)) {
    const name = `brand.${brand}`;
    files[`${name}.imageset/${name}.svg`] = brandSvg(brand);
    files[`${name}.imageset/Contents.json`] = contents(name);
  }
  // The logo (#269), LogoMark.tsx's Danish letters as shapes: the welcome's intro (#282).
  files["brand.logo.imageset/brand.logo.svg"] = logoSvg();
  files["brand.logo.imageset/Contents.json"] = contents("brand.logo");
  return files;
}

/** LogoMark's two paths, as they stand in src/components/ui/LogoMark.tsx, drawn black. */
export function logoSvg() {
  const tsx = readFileSync(
    new URL("../../src/components/ui/LogoMark.tsx", import.meta.url),
    "utf8",
  );
  const paths = [...tsx.matchAll(/<path\s+d="([^"]+)"\s+transform="([^"]+)"/g)]
    .map(([, d, t]) => `<path fill="#000" d="${d}" transform="${t}"/>`)
    .join("");
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="102.4 97.28 819.2 829.44" width="819.2" height="829.44">' +
    paths +
    "</svg>\n"
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = await catalogFiles();
  rmSync(CATALOG, { recursive: true, force: true });
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(CATALOG, path)), { recursive: true });
    writeFileSync(join(CATALOG, path), text);
  }
  console.log(`lucide-icons: ${Object.keys(files).length} files in ${CATALOG}`);
}
