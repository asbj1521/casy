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
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
export const CATALOG = join(ROOT, "ios/Packages/CasyUI/Sources/CasyUI/Resources/Icons.xcassets");

/** The icons the native screens use: the lucide name, and the stroke widths drawn (2 by default). */
export const ICONS = {
  bell: [2],
  "calendar-check": [2],
  "calendar-heart": [2],
  "calendar-search": [2],
  camera: [2],
  check: [2],
  "chevron-left": [2],
  "chevron-right": [2],
  "circle-question-mark": [2],
  clock: [2],
  contact: [2],
  database: [2],
  "file-text": [2],
  flag: [2],
  "key-round": [2],
  languages: [2],
  layers: [2],
  "life-buoy": [2],
  "loader-circle": [2],
  lock: [2],
  "log-out": [2],
  "message-square": [2],
  monitor: [2],
  moon: [2],
  pencil: [2],
  plus: [2, 2.25],
  settings: [2],
  share: [2],
  "shield-check": [2],
  star: [2],
  sun: [2],
  trash: [2],
  user: [2],
  "user-plus": [2],
  users: [2],
  vote: [2],
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

/** Every file of the catalog, by its path inside it. */
export async function catalogFiles() {
  const files = {
    "Contents.json": JSON.stringify({ info: { author: "xcode", version: 1 } }, null, 2) + "\n",
  };
  for (const [icon, strokes] of Object.entries(ICONS)) {
    for (const stroke of strokes) {
      const name = assetName(icon, stroke);
      files[`${name}.imageset/${name}.svg`] = await svg(icon, stroke);
      files[`${name}.imageset/Contents.json`] =
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
    }
  }
  return files;
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
