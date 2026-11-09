/**
 * The native String Catalog says what the web says (#198): each key's Danish
 * and English read from da.tsx and en.tsx, so a change to the web's words fails
 * until the catalog follows. A new key in the catalog must be listed here.
 */
import { describe, expect, it } from "vitest";

import catalogText from "../../../ios/Packages/CasyUI/Sources/CasyUI/Resources/Localizable.xcstrings?raw";
import { da } from "@/i18n/da";
import type { Messages } from "@/i18n/da";
import { en } from "@/i18n/en";

const KINDS = [
  "vote_invited",
  "vote_decided",
  "event_changed",
  "group_invitation",
  "deadline_near",
];

const WEB: Record<string, (t: Messages) => string> = {
  "common.cancel": (t) => t.common.cancel,
  "common.done": (t) => t.common.done,
  "common.save": (t) => t.common.save,
  "common.areYouSure": (t) => t.common.areYouSure,
  "common.loading": (t) => t.common.loading,
  "settings.title": (t) => t.profileHub.settings,
  "settings.language": (t) => t.language.title,
  "settings.appearance": (t) => t.appearance.title,
  "settings.system": (t) => t.appearance.system,
  "settings.light": (t) => t.appearance.light,
  "settings.dark": (t) => t.appearance.dark,
  "push.failed": (t) => t.push.failed,
  "push.title": (t) => t.push.title,
  "push.turnOn": (t) => t.push.turnOn,
  "push.deniedTitle": (t) => t.push.deniedTitle,
  "push.denied": (t) => t.push.denied,
  ...Object.fromEntries(
    KINDS.map((kind) => [`push.kind.${kind}`, (t: Messages) => t.push.kinds[kind]]),
  ),
};

interface Catalog {
  strings: Record<string, { localizations: Record<string, { stringUnit: { value: string } }> }>;
}
const catalog = JSON.parse(catalogText) as Catalog;

describe("the native String Catalog", () => {
  it("lists exactly the keys checked here", () => {
    expect(Object.keys(catalog.strings).sort()).toEqual(Object.keys(WEB).sort());
  });

  it.each(Object.keys(WEB))("%s says what the web says", (key) => {
    const { localizations } = catalog.strings[key];
    expect(localizations.da.stringUnit.value).toBe(WEB[key](da));
    expect(localizations.en.stringUnit.value).toBe(WEB[key](en as Messages));
  });
});
