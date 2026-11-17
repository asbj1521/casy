/**
 * The native screens' icons (#281) are the web's own: CasyUI's Icons.xcassets
 * holds exactly what scripts/native/lucide-icons.mjs draws from lucide-react.
 * A lucide update, a new icon or a hand edit fails here: run
 * `node scripts/native/lucide-icons.mjs` and commit what it writes.
 */
import { describe, expect, it } from "vitest";

// @ts-expect-error: a plain ES module of the scripts, without types.
import { catalogFiles } from "../../../scripts/native/lucide-icons.mjs";

const PREFIX = "../../../ios/Packages/CasyUI/Sources/CasyUI/Resources/Icons.xcassets/";
const THERE = import.meta.glob(
  "../../../ios/Packages/CasyUI/Sources/CasyUI/Resources/Icons.xcassets/**/*",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

describe("the native screens' lucide icons", () => {
  it("are the ones lucide-react draws", async () => {
    const wanted = (await catalogFiles()) as Record<string, string>;
    const there = Object.fromEntries(
      Object.entries(THERE).map(([path, text]) => [path.slice(PREFIX.length), text]),
    );
    expect(there).toEqual(wanted);
  });
});
