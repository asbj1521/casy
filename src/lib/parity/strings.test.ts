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
  // A number or a name filled in by Swift is written as String(format:) has it.
  "counts.members.one": (t) => t.counts.members(1),
  "counts.members.many": (t) => t.counts.members(7).replace("7", "%d"),
  "groups.title": (t) => t.groupsPage.title,
  "groups.yours": (t) => t.groupsSection.title,
  "groups.you": (t) => t.groupsPage.you,
  "groups.loading": (t) => t.groupsSection.loading,
  "groups.loadFailed": (t) => t.groupsSection.loadFailed,
  "groups.empty": (t) => t.groupsPage.empty,
  "groups.make": (t) => t.groupsSection.makeGroup,
  "groups.leave": (t) => t.groupsSection.swipeLeave,
  "groups.delete": (t) => t.groupsSection.swipeDelete,
  "groups.deleteConfirm": (t) =>
    t.groupsSection.deleteConfirm("%1$@", 7).replace(t.counts.members(7), "%2$@"),
  "groups.leaveFailed": (t) => t.api.leaveGroup,
  "groups.deleteFailed": (t) => t.api.deleteGroup,
  "invitations.title": (t) => t.events.invitations,
  "invitations.invitedBy": (t) => t.join.invitedBy("%@"),
  "invitations.invitedTo": (t) => t.join.invitedTo,
  "invitations.membersSoFar.one": (t) => t.join.membersSoFar(1),
  "invitations.membersSoFar.many": (t) => t.join.membersSoFar(7).replace("7", "%d"),
  "invitations.about": (t) => t.join.aboutTitle,
  "invitations.privacy": (t) => t.join.privacy,
  "invitations.join": (t) => t.join.joinGroup,
  "invitations.noThanks": (t) => t.events.noThanks,
  "invitations.answerFailed": (t) => t.api.answerInvitation,
  "invitations.blockSender": (t) => t.safety.blockSender,
  "invitations.block": (t) => t.safety.block,
  "invitations.blockFailed": (t) => t.api.blocked,
  "invitations.blockConfirm": (t) => t.safety.blockSenderConfirm("%1$@"),
  "group.members": (t) => t.groupsPage.members,
  "group.whatMembersSee": (t) => t.groupsPage.whatMembersSee,
  "group.whatMembersSeeBody": (t) => t.groupPanel.whatMembersSeeBody,
  "group.invitePeople": (t) => t.groupsPage.invitePeople,
  "group.edit": (t) => t.groupsSection.edit,
  "group.made": (t) => t.groupsSection.made("%@"),
  "group.withYou": (t) => t.common.withYou("%@"),
  "group.leave": (t) => t.groupPanel.leaveGroup,
  "group.deleteGroup": (t) => t.groupPanel.deleteGroup,
  "group.leaveConfirm": (t) => t.groupPanel.leaveConfirm("%@"),
  "group.leaveSole": (t) => t.groupsSection.leaveSole("%@"),
  "group.deleteForAll": (t) => t.groupsSection.deleteTitle,
  "group.primeTitle": (t) => t.prime.title,
  "group.primeFootnote": (t) => t.prime.switchFootnote,
  "group.renameFailed": (t) => t.api.renameGroup,
  "group.describeFailed": (t) => t.api.describeGroup,
  "group.primeFailed": (t) => t.api.setPrimeDates,
  "group.nameLabel": (t) => t.newGroup.nameLabel,
  "group.descriptionLabel": (t) => t.newGroup.descriptionLabel,
  "group.descriptionPlaceholder": (t) => t.newGroup.descriptionPlaceholder,
  "group.pictureChange": (t) => t.pictures.changeGroup,
  "group.pictureAdd": (t) => t.pictures.addGroup,
  "report.reportOrBlock": (t) => t.safety.reportOrBlock,
  "report.title": (t) => t.safety.title,
  "report.send": (t) => t.safety.send,
  "report.sent": (t) => t.safety.sent,
  "report.what": (t) => t.safety.what,
  "report.why": (t) => t.safety.why,
  "report.note": (t) => t.safety.note,
  "report.blockToo": (t) => t.safety.blockToo("%@"),
  "report.blockHelp": (t) => t.safety.blockHelp("%1$@"),
  "report.leaveToo": (t) => t.safety.leaveToo("%@"),
  "report.intro": (t) => t.safety.intro,
  "report.targetGroup": (t) => t.safety.targetGroup("%@"),
  "report.failed": (t) => t.api.report,
  "common.close": (t) => t.invite.close,
  "report.reason.spam": (t) => t.safety.reasons.spam,
  "report.reason.offensive": (t) => t.safety.reasons.offensive,
  "report.reason.harassment": (t) => t.safety.reasons.harassment,
  "report.reason.other": (t) => t.safety.reasons.other,
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
