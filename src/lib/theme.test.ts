import { describe, expect, it } from "vitest";

import { applyTheme, themeClass, themeFrom } from "@/lib/theme";

describe("themeFrom", () => {
  it("follows the system unless light or dark was chosen here", () => {
    expect(themeFrom(null, false)).toBe("system");
    expect(themeFrom("dark", false)).toBe("dark");
    expect(themeFrom("light", false)).toBe("light");
    expect(themeFrom("purple", false)).toBe("system");
  });

  it("always follows the phone in the app", () => {
    expect(themeFrom("light", true)).toBe("system");
    expect(themeFrom("dark", true)).toBe("system");
  });
});

/** <html>'s classes and the two theme-color tags, without a browser. */
function page() {
  const classes = new Set<string>();
  const root = {
    classList: {
      add: (c: string) => void classes.add(c),
      remove: (...cs: string[]) => cs.forEach((c) => classes.delete(c)),
    } as unknown as DOMTokenList,
  };
  const metas = [
    { media: "(prefers-color-scheme: light)", content: "" },
    { media: "(prefers-color-scheme: dark)", content: "" },
  ];
  return { classes, root, metas };
}

describe("applyTheme", () => {
  it("puts a forced theme's class on <html>, and none for the system", () => {
    expect(themeClass("system")).toBeNull();
    const { classes, root, metas } = page();
    applyTheme("dark", root, metas);
    expect([...classes]).toEqual(["theme-dark"]);
    applyTheme("light", root, metas);
    expect([...classes]).toEqual(["theme-light"]);
    applyTheme("system", root, metas);
    expect([...classes]).toEqual([]);
  });

  it("tints the browser's bars with the forced theme, or each system theme's own", () => {
    const { root, metas } = page();
    applyTheme("dark", root, metas);
    expect(metas.map((m) => m.content)).toEqual(["#0c0c0e", "#0c0c0e"]);
    applyTheme("system", root, metas);
    expect(metas.map((m) => m.content)).toEqual(["#faf8f5", "#0c0c0e"]);
  });
});
