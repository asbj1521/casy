import { describe, expect, it } from "vitest";

import { initialLang, phoneLang } from "@/i18n/lang";

describe("initialLang", () => {
  it("defaults to Danish", () => {
    expect(initialLang("", null)).toBe("da");
  });

  it("uses the remembered choice", () => {
    expect(initialLang("", "en")).toBe("en");
  });

  it("lets ?lang= override the remembered choice", () => {
    expect(initialLang("?lang=en", "da")).toBe("en");
    expect(initialLang("?next=%2F&lang=da", "en")).toBe("da");
  });

  it("ignores values it doesn't know", () => {
    expect(initialLang("?lang=de", "fr")).toBe("da");
  });
});

describe("phoneLang", () => {
  it("is Danish wherever the phone lists Danish", () => {
    expect(phoneLang(["da-DK"])).toBe("da");
    expect(phoneLang(["en-DK", "da-DK"])).toBe("da");
    expect(phoneLang(["en-GB"])).toBe("en");
    expect(phoneLang([])).toBe("en");
  });

  it("is only the fallback: a choice made before wins", () => {
    expect(initialLang("", "da", phoneLang(["en-US"]))).toBe("da");
    expect(initialLang("", null, phoneLang(["en-US"]))).toBe("en");
  });
});
