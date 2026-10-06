import { describe, expect, it } from "vitest";

import { isAppleTouch, viewportContent } from "@/lib/viewport";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0 Mobile/15E148 Safari/604.1";
const MAC_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Safari/605.1.15";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36";

describe("isAppleTouch", () => {
  it("knows an iPhone, in Safari or any other browser", () => {
    expect(isAppleTouch(IPHONE_SAFARI, 5)).toBe(true);
    expect(isAppleTouch(IPHONE_CHROME, 5)).toBe(true);
  });

  it("knows an iPad calling itself a Mac by its touch screen", () => {
    expect(isAppleTouch(MAC_SAFARI, 5)).toBe(true);
  });

  it("leaves a real Mac and Android alone", () => {
    expect(isAppleTouch(MAC_SAFARI, 0)).toBe(false);
    expect(isAppleTouch(ANDROID_CHROME, 5)).toBe(false);
  });
});

describe("viewportContent", () => {
  it("stops the tap zoom on an iPhone or iPad website", () => {
    expect(viewportContent({ app: false, appleTouch: true })).toBe(
      "width=device-width, initial-scale=1.0, maximum-scale=1.0",
    );
  });

  it("keeps the plain tag everywhere else, so pinching still works on Android", () => {
    expect(viewportContent({ app: false, appleTouch: false })).toBe(
      "width=device-width, initial-scale=1.0",
    );
  });

  it("gives the app the whole screen as well", () => {
    expect(viewportContent({ app: true, appleTouch: true })).toBe(
      "width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover",
    );
  });
});
