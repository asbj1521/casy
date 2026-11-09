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
  "profile.title": (t) => t.nav.profile,
  "profile.changeName": (t) => t.profile.changeName,
  "profile.setNameFailed": (t) => t.api.setName,
  "profile.groups": (t) => t.groupsPage.title,
  "profile.friends": (t) => t.friends.screenTitle,
  "profile.security": (t) => t.profileHub.security,
  "profile.admin": (t) => t.profileHub.admin,
  "profile.feedback": (t) => t.profileHub.feedback,
  "profile.feedbackSubject": (t) => t.profileHub.feedbackSubject,
  "profile.feedbackPrompt": (t) => t.profileHub.feedbackPrompt,
  "profile.share": (t) => t.profileHub.share,
  "profile.shareText": (t) => t.profileHub.shareText,
  "profile.myData": (t) => t.myData.row,
  "profile.support": (t) => t.footer.support,
  "profile.howItWorks": (t) => t.footer.howItWorks,
  "profile.terms": (t) => t.footer.terms,
  "profile.privacy": (t) => t.footer.privacy,
  "profile.signOut": (t) => t.nav.signOut,
  "profile.deleteAccount": (t) => t.deleteAccount.title,
  "pictures.change": (t) => t.pictures.change,
  "pictures.add": (t) => t.pictures.add,
  "pictures.remove": (t) => t.pictures.remove,
  "pictures.saveFailed": (t) => t.pictures.saveFailed,
  "pictures.removeFailed": (t) => t.pictures.removeFailed,
  "pictures.unreadable": (t) => t.pictures.unreadable,
  "pictures.cropTitle": (t) => t.pictures.cropTitle,
  "pictures.cropFrame": (t) => t.pictures.cropFrame,
  "push.failed": (t) => t.push.failed,
  "push.title": (t) => t.push.title,
  "push.turnOn": (t) => t.push.turnOn,
  "push.deniedTitle": (t) => t.push.deniedTitle,
  "push.denied": (t) => t.push.denied,
  ...Object.fromEntries(
    KINDS.map((kind) => [`push.kind.${kind}`, (t: Messages) => t.push.kinds[kind]]),
  ),
};

/**
 * Words only the native screens have, where iOS shows its own menu on the web
 * (the file field's Fotobibliotek and Tag billede), in iOS's own wording.
 */
const NATIVE_ONLY: Record<string, { da: string; en: string }> = {
  "pictures.library": { da: "Fotobibliotek", en: "Photo Library" },
  "pictures.camera": { da: "Tag billede", en: "Take Photo" },
};

interface Catalog {
  strings: Record<string, { localizations: Record<string, { stringUnit: { value: string } }> }>;
}
const catalog = JSON.parse(catalogText) as Catalog;

describe("the native String Catalog", () => {
  it("lists exactly the keys checked here", () => {
    expect(Object.keys(catalog.strings).sort()).toEqual(
      [...Object.keys(WEB), ...Object.keys(NATIVE_ONLY)].sort(),
    );
  });

  it.each(Object.keys(WEB))("%s says what the web says", (key) => {
    const { localizations } = catalog.strings[key];
    expect(localizations.da.stringUnit.value).toBe(WEB[key](da));
    expect(localizations.en.stringUnit.value).toBe(WEB[key](en as Messages));
  });

  it.each(Object.keys(NATIVE_ONLY))("%s says what iOS says", (key) => {
    const { localizations } = catalog.strings[key];
    expect(localizations.da.stringUnit.value).toBe(NATIVE_ONLY[key].da);
    expect(localizations.en.stringUnit.value).toBe(NATIVE_ONLY[key].en);
  });
});
