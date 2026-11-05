import { describe, expect, it } from "vitest";

import { shade, tint } from "./tint";

const parts = (rgb: string) => rgb.split(", ").map(Number);

function contrast(a: string, b: string): number {
  const lum = (rgb: string) => {
    const [r, g, c] = parts(rgb).map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * c;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("calendar colours in dark mode (#220)", () => {
  // An orange calendar, as measured against Apple Calendar on a phone.
  const orange = "237, 144, 55";

  it("use the colour itself for words, as Apple does", () => {
    expect(shade(orange, true)).toBe(orange);
  });
  it("tint it over black, not a grey that mutes it", () => {
    expect(tint(orange, true)).toBe("71, 43, 17");
  });
  it("lift a colour too dark to read, only as far as it takes", () => {
    for (const color of ["0, 0, 139", "60, 20, 120", "90, 30, 30", "10, 10, 10"]) {
      const words = shade(color, true);
      expect(contrast(words, tint(color, true))).toBeGreaterThanOrEqual(4.5);
      expect(words).not.toBe("255, 255, 255");
    }
  });
});

describe("calendar colours in light mode", () => {
  it("stay as they were", () => {
    expect(shade("100, 200, 50")).toBe("72, 144, 36");
    expect(tint("100, 200, 50")).toBe("230, 246, 222");
  });
});
