import { describe, expect, it } from "vitest";

// Both read as text through Vite (?raw): the app's types have no Node.
import packageJson from "../../package.json?raw";
import project from "../../ios/App/App.xcodeproj/project.pbxproj?raw";

import { parseVersion } from "./appVersion";

/**
 * The release is package.json's version (#143): the site stamps it, and the
 * Opdater Casy screen compares it with MIN_APP_VERSION. Xcode's own number,
 * MARKETING_VERSION, is what the App Store shows, so they must never part.
 * scripts/release-ios.sh refuses a release when they do; this catches it on
 * the commit that parts them.
 */
describe("the app's version", () => {
  const pkg = JSON.parse(packageJson) as { version: string };
  const marketing = [...project.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map((m) => m[1]);

  it("is a version the app can compare", () => {
    expect(parseVersion(pkg.version)).not.toBeNull();
  });

  it("is the same in package.json and every Xcode configuration", () => {
    expect(marketing.length).toBeGreaterThan(0);
    expect(new Set(marketing)).toEqual(new Set([pkg.version]));
  });
});
