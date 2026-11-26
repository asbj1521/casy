// The words the shared pieces and screens use. Each screen adds its own to the
// catalog as it is ported, from src/i18n/da.tsx and en.tsx. Casy has its own
// language choice, so they are read in that language, not the phone's.

import Foundation
import Synchronization

private let currentLanguage = Mutex("da")

public enum CasyStrings {
    /// "da" or "en": the language the person chose in Casy.
    public static var language: String {
        get { currentLanguage.withLock { $0 } }
        set { currentLanguage.withLock { $0 = newValue } }
    }

    static func text(_ key: String) -> String {
        let bundle =
            Bundle.module.path(forResource: language, ofType: "lproj")
            .flatMap(Bundle.init(path:)) ?? .module
        return bundle.localizedString(forKey: key, value: nil, table: "Localizable")
    }

    /// The app's name as people see it, and the label iOS shows under the icon
    /// and in Settings (#268): `src/i18n/brand.ts`'s two, changed together on
    /// launch day (#272).
    public static let appName = "Vi finder lige en dag"
    public static let appLabel = "Find en dag"

    public static var cancel: String { text("common.cancel") }
    public static var done: String { text("common.done") }
    public static var save: String { text("common.save") }
    public static var areYouSure: String { text("common.areYouSure") }
    public static var loading: String { text("common.loading") }

    public static var settingsTitle: String { text("settings.title") }
    public static var settingsLanguage: String { text("settings.language") }
    public static var settingsAppearance: String { text("settings.appearance") }
    public static var settingsSystem: String { text("settings.system") }
    public static var settingsLight: String { text("settings.light") }
    public static var settingsDark: String { text("settings.dark") }

    public static var profileTitle: String { text("profile.title") }
    public static var profileChangeName: String { text("profile.changeName") }
    public static var profileSetNameFailed: String { text("profile.setNameFailed") }
    public static var profileGroups: String { text("profile.groups") }
    public static var profileFriends: String { text("profile.friends") }
    public static var profileSecurity: String { text("profile.security") }
    public static var profileAdmin: String { text("profile.admin") }
    public static var profileFeedback: String { text("profile.feedback") }
    public static var profileFeedbackSubject: String { text("profile.feedbackSubject") }
    public static var profileFeedbackPrompt: String { text("profile.feedbackPrompt") }
    public static var profileShare: String { text("profile.share") }
    public static var profileShareText: String { text("profile.shareText") }
    public static var profileRate: String { text("profile.rate") }
    public static var profileMyData: String { text("profile.myData") }
    public static var profileSupport: String { text("profile.support") }
    public static var profileHowItWorks: String { text("profile.howItWorks") }
    public static var profileTerms: String { text("profile.terms") }
    public static var profilePrivacy: String { text("profile.privacy") }
    public static var profileSignOut: String { text("profile.signOut") }
    public static var profileDeleteAccount: String { text("profile.deleteAccount") }

    public static var picturesChange: String { text("pictures.change") }
    public static var picturesAdd: String { text("pictures.add") }
    public static var picturesRemove: String { text("pictures.remove") }
    public static var picturesSaveFailed: String { text("pictures.saveFailed") }
    public static var picturesRemoveFailed: String { text("pictures.removeFailed") }
    public static var picturesUnreadable: String { text("pictures.unreadable") }
    public static var picturesCropTitle: String { text("pictures.cropTitle") }
    public static var picturesCropFrame: String { text("pictures.cropFrame") }
    public static var picturesLibrary: String { text("pictures.library") }
    public static var picturesCamera: String { text("pictures.camera") }

    /// "1 medlem", "5 medlemmer".
    public static func members(_ n: Int) -> String {
        n == 1 ? text("counts.members.one") : String(format: text("counts.members.many"), n)
    }

    public static var groupsTitle: String { text("groups.title") }
    public static var groupsYours: String { text("groups.yours") }
    public static var groupsYou: String { text("groups.you") }
    public static var groupsLoading: String { text("groups.loading") }
    public static var groupsLoadFailed: String { text("groups.loadFailed") }
    public static var groupsEmpty: String { text("groups.empty") }
    public static var groupsMake: String { text("groups.make") }
    public static var groupsLeave: String { text("groups.leave") }
    public static var groupsDelete: String { text("groups.delete") }
    public static var groupsLeaveFailed: String { text("groups.leaveFailed") }
    public static var groupsDeleteFailed: String { text("groups.deleteFailed") }
    /// Asked before deleting a group other people are in.
    public static func groupsDeleteConfirm(_ name: String, members count: Int) -> String {
        String(format: text("groups.deleteConfirm"), name, members(count))
    }

    public static var invitationsTitle: String { text("invitations.title") }
    public static var invitationsInvitedTo: String { text("invitations.invitedTo") }
    public static func invitationsInvitedBy(_ name: String) -> String {
        String(format: text("invitations.invitedBy"), name)
    }
    public static func invitationsMembersSoFar(_ n: Int) -> String {
        n == 1
            ? text("invitations.membersSoFar.one")
            : String(format: text("invitations.membersSoFar.many"), n)
    }
    public static var invitationsAbout: String { text("invitations.about") }
    public static var invitationsPrivacy: String { text("invitations.privacy") }
    public static var invitationsJoin: String { text("invitations.join") }
    public static var invitationsNoThanks: String { text("invitations.noThanks") }
    public static var invitationsAnswerFailed: String { text("invitations.answerFailed") }
    public static var invitationsBlockSender: String { text("invitations.blockSender") }
    public static var invitationsBlock: String { text("invitations.block") }
    public static var invitationsBlockFailed: String { text("invitations.blockFailed") }
    public static func invitationsBlockConfirm(_ name: String) -> String {
        String(format: text("invitations.blockConfirm"), name)
    }

    public static var groupMembers: String { text("group.members") }
    public static var groupWhatMembersSee: String { text("group.whatMembersSee") }
    public static var groupWhatMembersSeeBody: String { text("group.whatMembersSeeBody") }
    public static var groupInvitePeople: String { text("group.invitePeople") }
    public static var groupEdit: String { text("group.edit") }
    public static func groupMade(_ value: String) -> String { String(format: text("group.made"), value) }
    public static func groupWithYou(_ value: String) -> String { String(format: text("group.withYou"), value) }
    public static var groupLeave: String { text("group.leave") }
    public static var groupDeleteGroup: String { text("group.deleteGroup") }
    public static func groupLeaveConfirm(_ value: String) -> String { String(format: text("group.leaveConfirm"), value) }
    public static func groupLeaveSole(_ value: String) -> String { String(format: text("group.leaveSole"), value) }
    public static var groupDeleteForAll: String { text("group.deleteForAll") }
    public static var groupPrimeTitle: String { text("group.primeTitle") }
    public static var groupPrimeFootnote: String { text("group.primeFootnote") }
    public static var groupRenameFailed: String { text("group.renameFailed") }
    public static var groupDescribeFailed: String { text("group.describeFailed") }
    public static var groupPrimeFailed: String { text("group.primeFailed") }
    public static var groupNameLabel: String { text("group.nameLabel") }
    public static var groupDescriptionLabel: String { text("group.descriptionLabel") }
    public static var groupDescriptionPlaceholder: String { text("group.descriptionPlaceholder") }
    public static var groupPictureChange: String { text("group.pictureChange") }
    public static var groupPictureAdd: String { text("group.pictureAdd") }
    public static var reportOrBlock: String { text("report.reportOrBlock") }
    public static var reportTitle: String { text("report.title") }
    public static var reportSend: String { text("report.send") }
    public static var reportSent: String { text("report.sent") }
    public static var reportWhat: String { text("report.what") }
    public static var reportWhy: String { text("report.why") }
    public static var reportNote: String { text("report.note") }
    public static func reportBlockToo(_ value: String) -> String { String(format: text("report.blockToo"), value) }
    public static func reportBlockHelp(_ value: String) -> String { String(format: text("report.blockHelp"), value) }
    public static func reportLeaveToo(_ value: String) -> String { String(format: text("report.leaveToo"), value) }
    public static var reportIntro: String { text("report.intro") }
    public static func reportTargetGroup(_ value: String) -> String { String(format: text("report.targetGroup"), value) }
    public static var reportFailed: String { text("report.failed") }
    public static var close: String { text("common.close") }
    /// A report's reason, by the server's name: spam, offensive, harassment, other.
    public static func reportReason(_ reason: String) -> String { text("report.reason.\(reason)") }

    public static func inviteTitle(_ value: String) -> String { String(format: text("invite.title"), value) }
    public static var invitePeople: String { text("invite.people") }
    public static var invitePeopleEmpty: String { text("invite.peopleEmpty") }
    public static var inviteAllIn: String { text("invite.allIn") }
    public static func inviteFrom(_ value: String) -> String { String(format: text("invite.from"), value) }
    public static var inviteFromPast: String { text("invite.fromPast") }
    public static var inviteFilter: String { text("invite.filter") }
    public static var inviteNoMatch: String { text("invite.noMatch") }
    public static var inviteInvited: String { text("invite.invited") }
    public static var inviteEmail: String { text("invite.email") }
    public static var inviteEmailPlaceholder: String { text("invite.emailPlaceholder") }
    public static var inviteAddEmail: String { text("invite.addEmail") }
    public static func inviteRemoveEmail(_ value: String) -> String { String(format: text("invite.removeEmail"), value) }
    public static var inviteNotAnEmail: String { text("invite.notAnEmail") }
    public static func inviteTooManyEmails(_ n: Int) -> String { String(format: text("invite.tooManyEmails"), n) }
    public static var inviteEmailHelp: String { text("invite.emailHelp") }
    public static var inviteConsent: String { text("invite.consent") }
    public static var inviteSent: String { text("invite.sent") }
    public static var inviteSentWithEmail: String { text("invite.sentWithEmail") }
    public static func inviteLinkHelp(_ value: String) -> String { String(format: text("invite.linkHelp"), value) }
    public static var inviteMakeLink: String { text("invite.makeLink") }
    public static var inviteMakingLink: String { text("invite.makingLink") }
    public static var inviteFromContacts: String { text("invite.fromContacts") }
    public static func inviteMessage(_ value: String) -> String { String(format: text("invite.message"), value) }
    public static func inviteShareTitle(_ value: String) -> String { String(format: text("invite.shareTitle"), value) }
    public static var inviteTexted: String { text("invite.texted") }
    public static var inviteTextFailed: String { text("invite.textFailed") }
    public static var inviteShareLink: String { text("invite.shareLink") }
    public static var inviteShowQr: String { text("invite.showQr") }
    public static var inviteHideQr: String { text("invite.hideQr") }
    public static func inviteQrLabel(_ value: String) -> String { String(format: text("invite.qrLabel"), value) }
    public static var inviteQrHelp: String { text("invite.qrHelp") }
    public static func inviteShowAll(_ n: Int) -> String { String(format: text("invite.showAll"), n) }
    public static var inviteShowFewer: String { text("invite.showFewer") }
    public static var inviteLinkFailed: String { text("invite.linkFailed") }
    public static var inviteSendFailed: String { text("invite.sendFailed") }
    public static var copy: String { text("common.copy") }
    public static var copied: String { text("common.copied") }
    public static var newGroupTitle: String { text("newGroup.title") }
    public static var newGroupPlaceholder: String { text("newGroup.placeholder") }
    public static var newGroupNext: String { text("newGroup.next") }
    public static var newGroupPictureLost: String { text("newGroup.pictureLost") }
    public static var newGroupFailed: String { text("newGroup.failed") }
    /// "Send invitation", "Send 3 invitationer".
    public static func inviteSend(_ n: Int) -> String {
        n <= 1 ? text("invite.send.one") : String(format: text("invite.send.many"), n)
    }
    /// How long a link has left: "7 dage", "5 timer", "under en time".
    public static func inviteExpiry(days: Int?, hours: Int?) -> String {
        if let days { return days == 1 ? text("expiry.days.one") : String(format: text("expiry.days.many"), days) }
        if let hours {
            return hours == 1 ? text("expiry.hours.one") : String(format: text("expiry.hours.many"), hours)
        }
        return text("expiry.underAnHour")
    }
    public static var inviteExpired: String { text("expiry.expired") }

    public static var friendsLinksInData: String { text("friends.linksInData") }
    public static var friendsInData: String { text("friends.inData") }
    public static var friendsEmpty: String { text("friends.empty") }
    public static var friendsNote: String { text("friends.note") }
    public static var friendsRemove: String { text("friends.remove") }
    public static func friendsRemoveAsk(_ value: String) -> String { String(format: text("friends.removeAsk"), value) }
    public static var friendsFailed: String { text("friends.failed") }
    public static var friendLinkAdd: String { text("friendLink.add") }
    public static var friendLinkMessage: String { text("friendLink.message") }
    public static var friendLinkShareTitle: String { text("friendLink.shareTitle") }
    public static func friendLinkHelp(_ value: String) -> String { String(format: text("friendLink.linkHelp"), value) }
    public static var friendLinkQrHelp: String { text("friendLink.qrHelp") }
    public static var friendLinkFailed: String { text("friendLink.failed") }

    public static var deleteAccountIntro: String { text("deleteAccount.intro") }
    public static var deleteAccountWord: String { text("deleteAccount.word") }
    public static func deleteAccountPrompt(_ value: String) -> String { String(format: text("deleteAccount.prompt"), value) }
    public static var deleteAccountButton: String { text("deleteAccount.button") }
    public static var deleteAccountConfirm: String { text("deleteAccount.confirm") }
    public static var deleteAccountDeleting: String { text("deleteAccount.deleting") }
    public static var deleteAccountFailed: String { text("deleteAccount.failed") }

    public static var myDataTitle: String { text("myData.title") }
    public static var myDataRow: String { text("myData.row") }
    public static var myDataPrivacyLink: String { text("myData.privacyLink") }
    public static var myDataLoading: String { text("myData.loading") }
    public static var myDataAccount: String { text("myData.account") }
    public static var myDataEmail: String { text("myData.email") }
    public static var myDataName: String { text("myData.name") }
    public static var myDataNameCustom: String { text("myData.nameCustom") }
    public static var myDataNameFromLogin: String { text("myData.nameFromLogin") }
    public static var myDataPicture: String { text("myData.picture") }
    public static var myDataPictureKept: String { text("myData.pictureKept") }
    public static var myDataPictureNone: String { text("myData.pictureNone") }
    public static var myDataNameNotYet: String { text("myData.nameNotYet") }
    public static var myDataSignIn: String { text("myData.signIn") }
    public static var myDataSignInMethodsEmail: String { text("myData.signInMethods.email") }
    public static var myDataSignInMethodsGoogle: String { text("myData.signInMethods.google") }
    public static var myDataSignInMethodsApple: String { text("myData.signInMethods.apple") }
    public static var myDataPush: String { text("myData.push") }
    public static var myDataPushOff: String { text("myData.pushOff") }
    public static var myDataPushDetail: String { text("myData.pushDetail") }
    public static var myDataAppleToken: String { text("myData.appleToken") }
    public static var myDataEmailLanguage: String { text("myData.emailLanguage") }
    public static var myDataLanguagesDa: String { text("myData.languages.da") }
    public static var myDataLanguagesEn: String { text("myData.languages.en") }
    public static var myDataLanguageDefault: String { text("myData.languageDefault") }
    public static var myDataCreated: String { text("myData.created") }
    public static var myDataCalendars: String { text("myData.calendars") }
    public static var myDataNoCalendars: String { text("myData.noCalendars") }
    public static var myDataNotCounted: String { text("myData.notCounted") }
    public static var myDataPrimary: String { text("myData.primary") }
    public static var myDataPrimaryNone: String { text("myData.primaryNone") }
    public static var myDataAutoAdd: String { text("myData.autoAdd") }
    public static var myDataOn: String { text("myData.on") }
    public static var myDataOff: String { text("myData.off") }
    public static var myDataBusy: String { text("myData.busy") }
    public static var myDataToldCasy: String { text("myData.toldCasy") }
    public static var myDataShortcuts: String { text("myData.shortcuts") }
    public static var myDataShortcutPictures: String { text("myData.shortcutPictures") }
    public static var myDataGroupPictures: String { text("myData.groupPictures") }
    public static var myDataReportsSent: String { text("myData.reportsSent") }
    public static var myDataBusyCount: String { text("myData.busyCount") }
    public static var myDataBusyFrom: String { text("myData.busyFrom") }
    public static var myDataBusyTo: String { text("myData.busyTo") }
    public static var myDataBusyNext: String { text("myData.busyNext") }
    public static var myDataBusyNote: String { text("myData.busyNote") }
    public static var myDataGroups: String { text("myData.groups") }
    public static var myDataNoGroups: String { text("myData.noGroups") }
    public static var myDataInviteLinks: String { text("myData.inviteLinks") }
    public static var myDataInvitationsToYou: String { text("myData.invitationsToYou") }
    public static var myDataInvitationsSent: String { text("myData.invitationsSent") }
    public static var myDataEmailLookups: String { text("myData.emailLookups") }
    public static var myDataEmailLookupsDetail: String { text("myData.emailLookupsDetail") }
    public static var myDataEvents: String { text("myData.events") }
    public static var myDataInvitedTo: String { text("myData.invitedTo") }
    public static var myDataSuggested: String { text("myData.suggested") }
    public static var myDataAnswers: String { text("myData.answers") }
    public static var myDataDeclined: String { text("myData.declined") }
    public static var myDataEntries: String { text("myData.entries") }
    public static var myDataEntriesAdded: String { text("myData.entriesAdded") }
    public static var myDataEntriesDeleted: String { text("myData.entriesDeleted") }
    public static var myDataAi: String { text("myData.ai") }
    public static var myDataAiCalls: String { text("myData.aiCalls") }
    public static var myDataAiConsent: String { text("myData.aiConsent") }
    public static var myDataAiConsentAgain: String { text("myData.aiConsentAgain") }
    public static var myDataAiConsentOff: String { text("myData.aiConsentOff") }
    public static var myDataLabels: String { text("myData.labels") }
    public static var myDataShareCorrections: String { text("myData.shareCorrections") }
    public static var myDataShareOn: String { text("myData.shareOn") }
    public static var myDataShareOff: String { text("myData.shareOff") }
    public static var myDataCorrectionsKept: String { text("myData.correctionsKept") }
    public static var myDataCorrectionsDelete: String { text("myData.correctionsDelete") }
    public static var myDataLabelsNote: String { text("myData.labelsNote") }
    public static var myDataAiNote: String { text("myData.aiNote") }
    public static var myDataCredentials: String { text("myData.credentials") }
    public static var myDataCredentialKindsOauth: String { text("myData.credentialKinds.oauth") }
    public static var myDataCredentialKindsPassword: String { text("myData.credentialKinds.password") }
    public static var myDataCredentialKindsLink: String { text("myData.credentialKinds.link") }
    public static var myDataCredentialNone: String { text("myData.credentialNone") }
    public static var myDataCredentialsNote: String { text("myData.credentialsNote") }
    public static var myDataDownload: String { text("myData.download") }
    public static var myDataDownloadDetail: String { text("myData.downloadDetail") }
    public static var myDataDownloading: String { text("myData.downloading") }
    public static func myDataIntro(_ value: String) -> String { String(format: text("myData.intro"), value) }
    public static func myDataConnectedOn(_ value: String) -> String { String(format: text("myData.connectedOn"), value) }
    public static func myDataGroupDetailYours(_ value: String) -> String { String(format: text("myData.groupDetailYours"), value) }
    public static func myDataAiConsentOn(_ value: String) -> String { String(format: text("myData.aiConsentOn"), value) }
    public static var myDataLoadFailed: String { text("myData.loadFailed") }
    public static var aiConsentRowOn: String { text("aiConsent.rowOn") }
    public static var aiConsentRowOff: String { text("aiConsent.rowOff") }
    public static var aiConsentRow: String { text("aiConsent.row") }
    public static func aiConsentFootnote(_ value: String) -> String { String(format: text("aiConsent.footnote"), value) }
    public static var aiConsentPrivacyLink: String { text("aiConsent.privacyLink") }
    public static var aiConsentTurnOffMessage: String { text("aiConsent.turnOffMessage") }
    public static var aiConsentTurnOff: String { text("aiConsent.turnOff") }
    public static var aiConsentFailed: String { text("aiConsent.failed") }
    public static var blockedTitle: String { text("blocked.title") }
    public static var blockedFootnote: String { text("blocked.footnote") }
    public static func blockedSince(_ value: String) -> String { String(format: text("blocked.since"), value) }
    public static var blockedUnblock: String { text("blocked.unblock") }
    public static var blockedUnknownName: String { text("blocked.unknownName") }
    public static var guessed: String { text("words.guessed") }
    public static var primeOff: String { text("words.primeOff") }
    /// "1 konto" / "3 konti", and the other counts Dine data shows.
    private static func count(_ key: String, _ n: Int) -> String {
        n == 1 ? text("\(key).one") : String(format: text("\(key).many"), n)
    }
    public static func myDataPushOn(_ n: Int) -> String { count("myData.pushOn", n) }
    public static func myDataAccountsCount(_ n: Int) -> String { count("myData.accountsCount", n) }
    public static func myDataGroupsCount(_ n: Int) -> String { count("myData.groupsCount", n) }
    public static func calendarsCount(_ n: Int) -> String { count("counts.calendars", n) }
    public static func busyBlocks(_ n: Int) -> String { count("counts.busyBlocks", n) }
    /// "3 (1 gyldige)".
    public static func myDataInviteLinksValue(made: Int, active: Int) -> String {
        String(format: text("myData.inviteLinksValue"), made, active)
    }
    /// "1 åbne, 2 afslået".
    public static func myDataInvitationsToYouValue(pending: Int, declined: Int) -> String {
        String(format: text("myData.invitationsToYouValue"), pending, declined)
    }
    /// A word by the server's own name for it, with the catalog's prefix:
    /// `category.work`, `priority.never`, `provider.apple`, `myData.signInMethods.google`.
    /// Falls back to the name itself for one the catalog doesn't know yet.
    public static func named(_ prefix: String, _ name: String) -> String {
        let key = "\(prefix).\(name)"
        let found = text(key)
        return found == key ? name : found
    }

    public static var adminTitle: String { text("admin.title") }
    public static var adminIntro: String { text("admin.intro") }
    public static var adminRefresh: String { text("admin.refresh") }
    public static var adminStatUsers: String { text("admin.statUsers") }
    public static var adminStatGroups: String { text("admin.statGroups") }
    public static var adminStatAccounts: String { text("admin.statAccounts") }
    public static var adminStatFailing: String { text("admin.statFailing") }
    public static var adminStatBusy: String { text("admin.statBusy") }
    public static var adminHealthOk: String { text("admin.healthOk") }
    public static var adminHealthStale: String { text("admin.healthStale") }
    public static var adminHealthFailing: String { text("admin.healthFailing") }
    public static var adminTabGroups: String { text("admin.tabGroups") }
    public static var adminTabUsers: String { text("admin.tabUsers") }
    public static var adminTabCalendars: String { text("admin.tabCalendars") }
    public static var adminOnlyNoCalendar: String { text("admin.onlyNoCalendar") }
    public static var adminOnlyProblems: String { text("admin.onlyProblems") }
    public static var adminSearch: String { text("admin.search") }
    public static var adminLoading: String { text("admin.loading") }
    public static var adminNoGroupMatch: String { text("admin.noGroupMatch") }
    public static var adminNoGroups: String { text("admin.noGroups") }
    public static var adminNoUserMatch: String { text("admin.noUserMatch") }
    public static var adminNoProblems: String { text("admin.noProblems") }
    public static var adminNoAccountMatch: String { text("admin.noAccountMatch") }
    public static var adminYou: String { text("admin.you") }
    public static var adminGroupsLabel: String { text("admin.groupsLabel") }
    public static var adminCalendarsLabel: String { text("admin.calendarsLabel") }
    public static var adminNeverSynced: String { text("admin.neverSynced") }
    public static var adminConnectingNeverFinished: String { text("admin.connectingNeverFinished") }
    public static var adminConnectingFailed: String { text("admin.connectingFailed") }
    public static var adminNeedsReconnect: String { text("admin.needsReconnect") }
    public static var adminAiAdmin: String { text("admin.aiAdmin") }
    public static var adminTesterOn: String { text("admin.testerOn") }
    public static func adminFirstOnly(_ value: String) -> String { String(format: text("admin.firstOnly"), value) }
    public static func adminJoined(_ value: String) -> String { String(format: text("admin.joined"), value) }
    public static func adminLastSignIn(_ value: String) -> String { String(format: text("admin.lastSignIn"), value) }
    public static var syncedJustNow: String { text("synced.justNow") }
    public static var adminLoadFailed: String { text("admin.loadFailed") }
    /// "AI i dag: 12 af 500 kald brugt."
    public static func adminAiToday(_ used: Int, of limit: Int) -> String {
        String(format: text("admin.aiToday"), used, limit)
    }
    /// "Planlæg med AI: 3 i dag, 40 på 30 dage, cirka 0,12 US$".
    public static func adminAiSkill(_ name: String, today: Int, month: Int, cost: String) -> String {
        String(format: text("admin.aiSkill"), name, today, month, cost)
    }
    /// "4 medlemmer · lavet 9. okt.", with "af Mia" when who made it is known.
    public static func adminGroupMeta(_ members: String, _ date: String, by: String?) -> String {
        by.map { String(format: text("admin.groupMetaBy"), members, date, $0) }
            ?? String(format: text("admin.groupMeta"), members, date)
    }
    /// "Synkroniseret for 5 min siden", from minutes ago (`syncedAgo`).
    public static func syncedAgo(minutes: Int) -> String {
        if minutes < 1 { return text("synced.justNow") }
        if minutes < 60 { return String(format: text("synced.minutes"), minutes) }
        let hours = minutes / 60
        if hours < 24 { return String(format: text("synced.hours"), hours) }
        let days = hours / 24
        return days == 1 ? text("synced.days.one") : String(format: text("synced.days.many"), days)
    }

    public static var adminDeleteGroupTitle: String { text("admin.deleteGroupTitle") }
    public static var adminDeleteGroup: String { text("admin.deleteGroup") }
    public static var adminRemoveAndDelete: String { text("admin.removeAndDelete") }
    public static var adminRemove: String { text("admin.remove") }
    public static var adminDeleteAccount: String { text("admin.deleteAccount") }
    public static var adminTheAccount: String { text("admin.theAccount") }
    public static var adminSyncFailed: String { text("admin.syncFailed") }
    public static var adminSyncTitle: String { text("admin.syncTitle") }
    public static var adminTesterOff: String { text("admin.testerOff") }
    public static var adminDeleteGroupFailed: String { text("admin.deleteGroupFailed") }
    public static var adminRemoveMemberFailed: String { text("admin.removeMemberFailed") }
    public static var adminDeleteAccountFailed: String { text("admin.deleteAccountFailed") }
    public static var adminSyncRequestFailed: String { text("admin.syncRequestFailed") }
    public static var adminAiAccessFailed: String { text("admin.aiAccessFailed") }
    public static func adminSyncUserTitle(_ name: String) -> String { String(format: text("admin.syncUserTitle"), name) }
    public static func adminTesterTurnOn(_ name: String) -> String { String(format: text("admin.testerTurnOn"), name) }
    public static func adminTesterTurnOff(_ name: String) -> String { String(format: text("admin.testerTurnOff"), name) }
    public static func adminTypeToConfirm(_ name: String) -> String { String(format: text("admin.typeToConfirm"), name) }
    /// Asked before deleting a group for everyone in it.
    public static func adminDeleteGroupConfirm(_ name: String, members: Int) -> String {
        members == 1
            ? String(format: text("admin.deleteGroupConfirm.one"), name)
            : String(format: text("admin.deleteGroupConfirm.many"), name, members)
    }
    /// Asked before taking someone out of a group; the last one out deletes it.
    public static func adminRemoveMember(_ name: String, from group: String, last: Bool) -> String {
        String(format: text(last ? "admin.removeLast" : "admin.removeMember"), name, group)
    }
    /// What deleting an account takes with it, spelled out before it is asked.
    public static func adminDeleteUserConfirm(
        _ name: String, accounts: Int, groups: Int, soleGroups: Int
    ) -> String {
        let accountsPart = accounts == 1
            ? text("admin.impactAccounts.one") : String(format: text("admin.impactAccounts.many"), accounts)
        let groupsPart: String
        if groups == 0 {
            groupsPart = text("admin.impactNoGroups")
        } else if soleGroups == 0 {
            groupsPart = groups == 1
                ? text("admin.impactGroups.one") : String(format: text("admin.impactGroups.many"), groups)
        } else {
            switch (groups == 1, soleGroups == 1) {
            case (true, true): groupsPart = text("admin.impactSole.oneOne")
            case (true, false): groupsPart = String(format: text("admin.impactSole.oneMany"), soleGroups)
            case (false, true): groupsPart = String(format: text("admin.impactSole.manyOne"), groups)
            case (false, false):
                groupsPart = String(format: text("admin.impactSole.manyMany"), groups, soleGroups)
            }
        }
        return String(
            format: text("admin.deleteUserConfirm"), name, accountsPart + text("admin.and") + groupsPart)
    }
    /// "Sara blev slettet, sammen med 1 gruppe, kun personen var med i."
    public static func adminUserDeleted(_ who: String, groups: Int) -> String {
        switch groups {
        case 0: String(format: text("admin.userDeleted.none"), who)
        case 1: String(format: text("admin.userDeleted.one"), who)
        default: String(format: text("admin.userDeleted.many"), who, groups)
        }
    }
    public static func adminSyncedBlocks(_ n: Int) -> String {
        n == 1 ? text("admin.syncedBlocks.one") : String(format: text("admin.syncedBlocks.many"), n)
    }
    /// How a person's re-sync went: every account, or how many of them.
    public static func adminSyncedUser(ok: Int, failed: Int, blocks: Int) -> String {
        if failed > 0 { return String(format: text("admin.syncedUser.failed"), ok, ok + failed) }
        switch (ok == 1, blocks == 1) {
        case (true, true): return text("admin.syncedUser.oneOne")
        case (true, false): return String(format: text("admin.syncedUser.oneMany"), blocks)
        case (false, true): return String(format: text("admin.syncedUser.manyOne"), ok)
        case (false, false): return String(format: text("admin.syncedUser.manyMany"), ok, blocks)
        }
    }

    public static var pushFailed: String { text("push.failed") }
    public static var pushTitle: String { text("push.title") }
    public static var pushTurnOn: String { text("push.turnOn") }
    public static var pushDeniedTitle: String { text("push.deniedTitle") }
    public static var pushDenied: String { text("push.denied") }
    /// A kind of notification, by the server's name for it.
    public static func pushKind(_ kind: String) -> String { text("push.kind.\(kind)") }

    // Admin's reports (#142), AI corrections (#122) and push test (#139).
    public static var adminReportsTitle: String { text("adminReports.title") }
    public static var adminReportsIntro: String { text("adminReports.intro") }
    public static var adminReportsNone: String { text("adminReports.none") }
    public static var adminReportHandled: String { text("adminReports.handled") }
    public static var adminReportDeleteGroup: String { text("adminReports.deleteGroup") }
    public static var adminReportRemovePicture: String { text("adminReports.removePicture") }
    public static var adminReportPictureRemoved: String { text("adminReports.pictureRemoved") }
    public static func adminReportDeleteGroupConfirm(_ group: String?) -> String {
        guard let group, !group.isEmpty else { return text("adminReports.deleteGroupConfirmUnnamed") }
        return String(format: text("adminReports.deleteGroupConfirm"), group)
    }
    /// What a report is about: "group", "event" or "member".
    public static func adminReportKind(_ kind: String) -> String { named("adminReports.kind", kind) }
    public static var adminReportsFailed: String { text("adminReports.failed") }
    public static var adminCorrectionsTitle: String { text("admin.correctionsTitle") }
    public static var adminCorrectionsIntro: String { text("admin.correctionsIntro") }
    public static var adminCorrectionsNone: String { text("admin.correctionsNone") }
    public static var adminCorrectionPlan: String { text("admin.correctionPlan") }
    public static var adminCorrectionPlanUnchanged: String { text("admin.correctionPlanUnchanged") }
    public static var adminCorrectionPlanChanged: String { text("admin.correctionPlanChanged") }
    public static var adminCorrectionBefore: String { text("admin.correctionBefore") }
    public static var adminCorrectionAfter: String { text("admin.correctionAfter") }
    public static var adminCorrectionNote: String { text("admin.correctionNote") }
    public static var adminCorrectionHandled: String { text("admin.correctionHandled") }
    /// An event label's kind and importance, by the AI's names for them.
    public static func eventLabelKind(_ kind: String) -> String { named("eventLabel.kind", kind) }
    public static func eventLabelImportance(_ importance: String) -> String {
        named("eventLabel.importance", importance)
    }
    public static var pushTestButton: String { text("push.testButton") }
    public static var pushTestSending: String { text("push.testSending") }
    public static var pushTestDenied: String { text("push.testDenied") }
    public static func pushTestSent(_ n: Int) -> String {
        n == 1 ? text("push.testSent.one") : String(format: text("push.testSent.many"), n)
    }
    public static func pushTestNone(_ reasons: [String]) -> String {
        reasons.isEmpty ? text("push.testNone") : String(format: text("push.testNoneWhy"), reasons.joined(separator: ", "))
    }

    // Aftaler (#199).
    public static var eventsTitle: String { text("events.title") }
    public static var eventsLoading: String { text("events.loading") }
    public static var eventsLoadFailed: String { text("events.loadFailed") }
    public static var eventsGroupAnswer: String { text("events.groupAnswer") }
    public static var eventsGroupComing: String { text("events.groupComing") }
    public static var eventsGroupPast: String { text("events.groupPast") }
    public static var eventsAnswerNow: String { text("events.answerNow") }
    public static var eventsChoose: String { text("events.choose") }
    public static var eventsSwipeCancel: String { text("events.swipeCancel") }
    public static var eventsSwipeLeave: String { text("events.swipeLeave") }
    public static var eventsCancelConfirm: String { text("events.cancelConfirm") }
    public static var eventsCancelEvent: String { text("events.cancelEvent") }
    public static var eventsEmptyTitle: String { text("events.emptyTitle") }
    public static var eventsEmptyBody: String { text("events.emptyBody") }
    public static var eventsPlan: String { text("events.plan") }
    public static var eventsCancelFailed: String { text("events.cancelFailed") }
    public static var eventsLeaveFailed: String { text("events.leaveFailed") }
    public static var timeZoneNote: String { text("timeZone.note") }
    public static func timeZoneYours(_ time: String) -> String { String(format: text("timeZone.yours"), time) }
    public static var eventsYou: String { text("events.you") }
    /// Where someone stands: "accepted", "maybe", "declined", or "none" for no answer yet.
    public static func eventsAnswered(_ standing: String) -> String { text("events.answered.\(standing)") }
    public static var eventsYouSuggested: String { text("events.youSuggested") }
    public static func eventsSuggestedBy(_ name: String) -> String { String(format: text("events.suggestedBy"), name) }
    public static func eventsOptionalAre(_ names: String) -> String { String(format: text("events.optionalAre"), names) }
    public static var eventsCantAfterAll: String { text("events.cantAfterAll") }
    public static var eventsMoveConfirm: String { text("events.moveConfirm") }
    public static var eventsMoveYes: String { text("events.moveYes") }
    public static var eventsMoveKeep: String { text("events.moveKeep") }
    public static var eventsLeaveConfirm: String { text("events.leaveConfirm") }
    public static var eventsLeaveEvent: String { text("events.leaveEvent") }
    public static var eventsKeepIt: String { text("events.keepIt") }
    public static var eventsStayIn: String { text("events.stayIn") }
    public static var eventsAnswerFailed: String { text("events.answerFailed") }
    public static var reportEvent: String { text("report.reportEvent") }
    public static func reportTargetEvent(_ title: String) -> String { String(format: text("report.targetEvent"), title) }
    public static var eventPlace: String { text("eventDetails.place") }
    public static var eventNote: String { text("eventDetails.note") }
    public static var addToCalendar: String { text("addToCalendar.button") }
    public static func addToCalendarGoesInto(_ name: String) -> String { String(format: text("addToCalendar.goesInto"), name) }
    public static var addToCalendarGoesIntoFallback: String { text("addToCalendar.goesIntoFallback") }
    public static var addToCalendarWillAsk: String { text("addToCalendar.willAsk") }
    public static var addToCalendarAsFile: String { text("addToCalendar.asFile") }
    public static func addToCalendarAdded(_ name: String) -> String { String(format: text("addToCalendar.added"), name) }
    public static var addToCalendarAddedFallback: String { text("addToCalendar.addedFallback") }
    public static var addToCalendarAdding: String { text("addToCalendar.adding") }
    public static var addToCalendarNotYet: String { text("addToCalendar.notYet") }
    public static var addToCalendarTryAgain: String { text("addToCalendar.tryAgain") }
    public static var addToCalendarNotYetPhone: String { text("addToCalendar.notYetPhone") }
    public static var addToCalendarGone: String { text("addToCalendar.gone") }
    public static var addToCalendarAddAgain: String { text("addToCalendar.addAgain") }
    public static var addToCalendarChooseTitle: String { text("addToCalendar.chooseTitle") }
    public static var addToCalendarChooseHelp: String { text("addToCalendar.chooseHelp") }
    public static var addToCalendarUseAndAdd: String { text("addToCalendar.useAndAdd") }
    public static var addToCalendarDownloadInstead: String { text("addToCalendar.downloadInstead") }
    public static var addToCalendarFailed: String { text("addToCalendar.failed") }
    public static var addToCalendarDownloadFailed: String { text("addToCalendar.downloadFailed") }
    public static var addToCalendarLoadPrimaryFailed: String { text("addToCalendar.loadPrimaryFailed") }
    public static var addToCalendarSetPrimaryFailed: String { text("addToCalendar.setPrimaryFailed") }
    public static var addToCalendarLoadStatusFailed: String { text("addToCalendar.loadStatusFailed") }
    public static var eventsOpenDay: String { text("events.openDay") }
    /// Who answered what on a date: "accepted", "maybe", "declined", "missing".
    public static func eventsVoters(_ group: String) -> String { text("events.voters.\(group)") }
    public static var eventsAhead: String { text("events.ahead") }
    public static var eventsBestPick: String { text("events.bestPick") }
    public static func eventsCanOnDate(_ n: Int) -> String { String(format: text("events.canOnDate"), n) }
    public static func eventsCantOnDate(_ n: Int) -> String { String(format: text("events.cantOnDate"), n) }
    public static var eventsSettlesIn: String { text("events.settlesIn") }
    public static var eventsChooseNow: String { text("events.chooseNow") }
    public static func eventsWaitingForChoice(_ name: String) -> String { String(format: text("events.waitingForChoice"), name) }
    public static var eventsICan: String { text("events.answerLong.accepted") }
    public static var eventsICant: String { text("events.answerLong.declined") }
    public static var voteDeadlineLabel: String { text("voteDeadline.label") }
    public static var voteDeadlineNone: String { text("voteDeadline.none") }
    public static func voteDeadlineAt(_ day: String, _ time: String) -> String { String(format: text("voteDeadline.at"), day, time) }
    public static var voteDeadlineUntilAll: String { text("voteDeadline.untilAll") }
    public static var voteDeadlineSettleNow: String { text("voteDeadline.settleNow") }
    public static var voteDeadlineSettleAsk: String { text("voteDeadline.settleAsk") }
    public static func days(_ n: Int) -> String {
        n == 1 ? text("common.days.one") : String(format: text("common.days.many"), n)
    }
    public static func remindButton(_ n: Int) -> String {
        n == 1 ? text("remind.button.one") : String(format: text("remind.button.many"), n)
    }
    public static var remindDone: String { text("remind.done") }
    public static var eventsChooseFailed: String { text("events.chooseFailed") }
    public static var eventsDeadlineFailed: String { text("events.deadlineFailed") }
    public static var eventsSettleFailed: String { text("events.settleFailed") }
    public static var eventsRemindFailed: String { text("events.remindFailed") }
    public static var searchAgain: String { text("searchAgain.button") }

    // Kalendere (#200): the list, its pickers, the connected calendars and the tour.
    private static func format(_ key: String, _ args: CVarArg...) -> String {
        String(format: text(key), arguments: args)
    }
    public static var calendarsTitle: String { text("calendarView.calendarsButton") }

    // MARK: Planlæg's sheet (#282)

    public static var planTitle: String { text("planFromCalendar.button") }
    public static var planFindDate: String { text("plan.findDate") }
    public static var planReset: String { text("plan.reset") }
    public static var planGroup: String { text("plan.group") }
    public static var planName: String { text("plan.name") }
    public static var planNamePlaceholder: String { text("plan.namePlaceholder") }
    public static var planKind: String { text("plan.kind") }
    public static var planMeeting: String { text("plan.meeting") }
    public static var planTrip: String { text("plan.trip") }
    public static var planTime: String { text("plan.time") }
    public static var planFrom: String { text("plan.from") }
    public static var planTo: String { text("plan.to") }
    public static func planFromTo(_ from: String, _ to: String) -> String { String(format: text("plan.fromTo"), from, to) }
    public static var planFlex: String { text("plan.flex") }
    public static var planFlexNone: String { text("plan.flexNone") }
    public static var planFlexLess: String { text("plan.flexLess") }
    public static var planFlexMore: String { text("plan.flexMore") }
    public static var planFriSat: String { text("plan.friSat") }
    public static var planMonths: String { text("plan.months") }
    public static var planAllMonths: String { text("plan.allMonths") }
    public static var planAnyTime: String { text("plan.anyTime") }
    public static func planStartWindow(_ from: String, _ to: String) -> String {
        String(format: text("plan.startWindow"), from, to)
    }
    public static var planDuration: String { text("plan.duration") }
    public static var planDayLabel: String { text("plan.dayLabel") }
    public static var planTripDays: String { text("plan.tripDays") }
    public static var planTripStarts: String { text("plan.tripStarts") }
    public static var planAnyDay: String { text("plan.anyDay") }
    public static var planFewerDays: String { text("plan.fewerDays") }
    public static var planMoreDays: String { text("plan.moreDays") }
    /// "alle dage", "hverdage", "weekender".
    public static func planDayList(_ kind: String) -> String { text("plan.dayList.\(kind)") }
    /// Søn ... Lør, by weekday (0 is Sunday).
    public static func planWeekdayShort(_ dow: Int) -> String { text("plan.weekdayShort.\(dow)") }
    /// 30 -> "30 min", 90 -> "1½ t", 180 -> "3 t".
    public static func planLength(_ minutes: Int) -> String {
        let h = minutes / 60
        let m = minutes % 60
        if h == 0 { return String(format: text("plan.duration.min"), m) }
        if m == 0 { return String(format: text("plan.duration.hours"), h) }
        if m == 30 { return String(format: text("plan.duration.half"), h) }
        return String(format: text("plan.duration.hours"), h) + " " + String(format: text("plan.duration.min"), m)
    }
    public static var planHowManyLabel: String { text("plan.howMany.label") }
    public static func planHowManyAll(_ n: Int) -> String { String(format: text("plan.howMany.all"), n) }
    public static func planHowManySome(_ n: Int, _ of: Int) -> String { String(format: text("plan.howMany.some"), n, of) }
    public static var planHowManyNone: String { text("plan.howMany.none") }
    public static var planHowManyFootnote: String { text("plan.howMany.footnote") }
    public static func planHowManySooner(_ days: Int) -> String {
        days == 1
            ? text("plan.howMany.sooner.one")
            : days < 14
                ? String(format: text("plan.howMany.sooner.days"), days)
                : String(format: text("plan.howMany.sooner.weeks"), Int((Double(days) / 7).rounded()))
    }
    public static var planNewGroup: String { text("plan.newGroup") }
    public static var planNewGroupDetail: String { text("plan.newGroupDetail") }
    public static var planExamples: String { text("plan.examples") }
    public static var planHintExample: String { text("plan.hintExample") }
    public static var planHintSignIn: String { text("plan.hintSignIn") }
    public static var planPeriodHint: String { text("plan.periodHint") }
    public static func planPeriodDaysHint(_ period: String) -> String { String(format: text("plan.periodDaysHint"), period) }
    public static var planTimeNote: String { text("plan.timeNote") }
    public static var shortcutsTitle: String { text("myData.shortcuts") }
    public static var aiStart: String { text("aiPlan.start") }
    public static var aiThinking: String { text("aiPlan.thinking") }
    public static var aiQuickQuestion: String { text("aiPlan.quickQuestion") }
    public static var planQuestionsDone: String { text("plan.questionsDone") }
    public static var planAiFailed: String { text("api.planAi") }

    // Genveje (#175, #282).
    public static var shortcutsAdd: String { text("shortcuts.add") }
    public static func shortcutsEdit(_ name: String) -> String { String(format: text("shortcuts.edit"), name) }
    public static func shortcutsRun(_ name: String) -> String { String(format: text("shortcuts.run"), name) }
    public static func shortcutsBack(_ name: String) -> String { String(format: text("shortcuts.back"), name) }
    public static var shortcutsSave: String { text("shortcuts.save") }
    public static var shortcutsNameFirst: String { text("shortcuts.nameFirst") }
    public static var shortcutsRemove: String { text("shortcuts.remove") }
    public static func shortcutsRemoveAsk(_ name: String) -> String { String(format: text("shortcuts.removeAsk"), name) }
    public static var shortcutsPicture: String { text("shortcuts.picture") }
    public static var shortcutsPictureAdd: String { text("shortcuts.pictureAdd") }
    public static var shortcutsNotSaved: String { text("shortcuts.notSaved") }
    public static var shortcutsEmptyNote: String { text("shortcuts.emptyNote") }
    public static var shortcutsNameLabel: String { text("shortcuts.nameLabel") }
    public static var shortcutsNamePlaceholder: String { text("shortcuts.namePlaceholder") }
    public static func shortcutsTime(_ n: Int) -> String { String(format: text("shortcuts.time"), n) }
    public static var shortcutsAddTime: String { text("shortcuts.addTime") }
    public static func shortcutsRemoveTime(_ n: Int) -> String { String(format: text("shortcuts.removeTime"), n) }
    public static var shortcutsAnyTime: String { text("shortcuts.anyTime") }
    public static var shortcutsLoadFailed: String { text("shortcuts.loadFailed") }
    public static var shortcutsSaveFailed: String { text("shortcuts.saveFailed") }
    public static var shortcutsDeleteFailed: String { text("shortcuts.deleteFailed") }
    public static var planWhenLabel: String { text("plan.when.label") }
    public static var planWhenSoonest: String { text("plan.when.soonest") }

    // The paper pile (#126, #282).
    public static func pileRanked(_ n: Int) -> String { n == 1 ? text("pile.ranked.one") : String(format: text("pile.ranked.many"), n) }
    public static var pileReviewing: String { text("pile.reviewing") }
    public static func pileRankedNew(_ n: Int) -> String {
        n == 1 ? text("pile.rankedNew.one") : String(format: text("pile.rankedNew.many"), n)
    }
    public static var pileReviewingNew: String { text("pile.reviewingNew") }
    public static func pileAllCan(_ n: Int) -> String { n == 1 ? text("pile.allCan.one") : String(format: text("pile.allCan.many"), n) }
    public static func pileAllCanWithCalendar(_ n: Int) -> String { String(format: text("pile.allCanWithCalendar"), n) }
    public static func pileCant(_ names: String) -> String { String(format: text("pile.cant"), names) }
    public static var pileEdgesClear: String { text("pile.edgesClear") }
    public static var pileNoSkips: String { text("pile.noSkips") }
    public static func pileMatchScore(_ n: Int) -> String { String(format: text("pile.matchScore"), n) }
    public static var pilePicked: String { text("pile.picked") }
    public static var pileNotPicked: String { text("pile.notPicked") }
    public static var pileComfortYou: String { text("pile.comfort.you") }
    public static func pileComfort(_ rule: String, _ who: String = "") -> String {
        who.isEmpty ? text("pile.comfort.\(rule)") : String(format: text("pile.comfort.\(rule)"), who)
    }
    public static func pileSuggest(_ n: Int) -> String { n == 1 ? text("pile.suggest.one") : String(format: text("pile.suggest.many"), n) }
    public static func pileSendNew(_ n: Int) -> String { n == 1 ? text("pile.sendNew.one") : String(format: text("pile.sendNew.many"), n) }
    public static func searchAgainMissing(_ n: Int) -> String {
        n == 1 ? text("searchAgain.missing.one") : String(format: text("searchAgain.missing.many"), n)
    }
    public static var searchAgainPickTitle: String { text("searchAgain.pickTitle") }
    public static var searchAgainWarning: String { text("searchAgain.warning") }
    public static var searchAgainWarningText: String { text("searchAgain.warningText") }
    public static var searchAgainFailed: String { text("api.searchAgain") }

    // What a vote's date runs into among your important events (#114), the web's importantClash.
    /// "samme dag", "dagen efter", "3 dage efter".
    public static func clashWhen(_ daysAfter: Int) -> String {
        daysAfter <= 0
            ? text("clash.when.same") : daysAfter == 1 ? text("clash.when.next") : String(format: text("clash.when.days"), daysAfter)
    }
    /// The warning's sentence by its kind ("nightBefore", "prepDayBefore", "prep", "recovery").
    public static func clashSentence(_ kind: String, what: String, when: String, avoid: String) -> String {
        kind == "nightBefore"
            ? String(format: text("clash.nightBefore"), what, when, avoid)
            : String(format: text("clash.\(kind)"), what, when)
    }
    /// What kind of event it is, said vaguely ("en eksamen").
    public static func clashKind(_ kind: String) -> String {
        let key = "clash.kind.\(kind)"
        let said = text(key)
        return said == key ? text("clash.kind.other") : said
    }
    public static func clashAvoid(_ effect: String) -> String { text("clash.avoid.\(effect)") }
    public static var clashAnd: String { text("clash.and") }
    public static var clashShow: String { text("clash.show") }
    public static var clashHide: String { text("clash.hide") }
    /// "Corporate Finance eksamen, tirsdag 19. januar kl. 09:00".
    public static func clashDetail(_ title: String, day: String, time: String?) -> String {
        time.map { String(format: text("clash.detailAt"), title, day, $0) } ?? String(format: text("clash.detail"), title, day)
    }
    public static var clashConfirm: String { text("clash.confirm") }
    public static var clashConfirmYes: String { text("clash.confirmYes") }
    public static var clashConfirmNo: String { text("clash.confirmNo") }

    // Signing in, natively (#282): the web's SignIn and PasswordForm.
    /// A word of the sign-in card by its key under "signIn." ("tabSignUp", "forgot").
    public static func signIn(_ key: String) -> String { text("signIn.\(key)") }
    public static func signInAcceptTerms(_ terms: String, _ privacy: String) -> String {
        String(format: text("signIn.acceptTerms"), terms, privacy)
    }
    public static func signInLinkSent(_ email: String) -> String { String(format: text("signIn.linkSent"), email) }
    public static func signInConfirmSent(_ email: String) -> String { String(format: text("signIn.confirmSent"), email) }
    public static func signInResetSent(_ email: String) -> String { String(format: text("signIn.resetSent"), email) }
    public static var passwordShow: String { text("passwordForm.show") }
    public static var passwordHide: String { text("passwordForm.hide") }
    public static func passwordRuleLength(_ n: Int) -> String { String(format: text("passwordForm.ruleLength"), n) }
    public static var passwordRuleLettersDigits: String { text("passwordForm.ruleLettersDigits") }
    public static var passwordRuleNotPersonal: String { text("passwordForm.ruleNotPersonal") }
    public static var passwordRulesNotMet: String { text("passwordForm.rulesNotMet") }
    public static var passwordChecking: String { text("passwordForm.checking") }
    public static func passwordLeaked(_ times: String) -> String { String(format: text("passwordForm.leaked"), times) }
    public static var welcomeBack: String { text("welcome.back") }
    /// A word of the welcome screen by its key under "welcome." ("headline", "start").
    public static func welcome(_ key: String) -> String { text("welcome.\(key)") }
    public static var groupsShort: String { text("nav.groupsShort") }
    public static func groupMembers(_ n: Int) -> String {
        n == 1 ? text("groupPanel.members.one") : String(format: text("groupPanel.members.many"), n)
    }
    public static var invitePasteAsk: String { text("invitePaste.ask") }
    public static var invitePastePaste: String { text("invitePaste.paste") }
    public static var invitePasteTitle: String { text("invitePaste.title") }
    public static var invitePasteLabel: String { text("invitePaste.label") }
    public static var invitePasteOpen: String { text("invitePaste.open") }
    public static var invitePasteNone: String { text("invitePaste.none") }
    public static var invitePasteWaiting: String { text("invitePaste.waiting") }
    public static var invitePasteToGroup: String { text("invitePaste.toGroup") }
    public static var invitePasteGone: String { text("invitePaste.gone") }
    public static var joinOpening: String { text("join.opening") }
    public static var joinHome: String { text("join.home") }
    public static var joinBroken: String { text("join.broken") }
    public static func joinBrokenBody(_ reason: String) -> String { String(format: text("join.brokenBody"), reason) }
    public static var joinGoToCasy: String { text("join.goToCasy") }
    public static var joinAlreadyIn: String { text("join.alreadyIn") }
    public static var joinToGroup: String { text("join.toGroup") }
    public static var joinWhatIsCasy: String { text("join.whatIsCasy") }
    public static var joinPreviewFailed: String { text("join.previewFailed") }
    public static var joinJoinFailed: String { text("join.joinFailed") }
    public static var authUserExists: String { text("authErrors.userExists") }
    public static var pileChange: String { text("pile.change") }
    public static var pileClose: String { text("pile.close") }
    public static func pileDetails(_ date: String) -> String { String(format: text("pile.details"), date) }
    public static var pileNoneThrough: String { text("pile.noneThrough") }
    public static var pileInviteFriends: String { text("pile.inviteFriends") }
    public static var pileOnlyYou: String { text("pile.onlyYou") }
    public static var pilePriorityLabel: String { text("pile.priority.label") }
    public static func pilePriority(_ value: String) -> String { text("pile.priority.\(value)") }
    public static func pileNeedSkip(_ names: String) -> String { String(format: text("pile.needSkip"), names) }
    public static func pileNeedTimeOff(_ names: String) -> String { String(format: text("pile.needTimeOff"), names) }
    public static var pileChecking: String { text("pile.checking") }
    public static var pileHintAccept: String { text("pile.hintAccept") }
    public static var pileAccept: String { text("pile.accept") }
    public static var pileChangedBeforeSending: String { text("pile.changedBeforeSending") }
    public static var pileBusyLoading: String { text("pile.busyLoading") }
    public static var pileBusyFailed: String { text("pile.busyFailed") }
    public static var pileNoCalendars: String { text("pile.noCalendars") }
    public static var pileSuggestFailed: String { text("pile.suggestFailed") }
    public static var widenTitle: String { text("pile.widen.title") }
    public static func widenTime(_ part: String) -> String { text("pile.widen.time.\(part)") }
    public static var widenDays: String { text("pile.widen.days") }
    public static var widenStartDay: String { text("pile.widen.startDay") }
    public static func widenShorter(_ length: String) -> String { String(format: text("pile.widen.shorter"), length) }
    public static func widenMonths(_ period: String) -> String { String(format: text("pile.widen.months"), period) }
    public static func widenPeople(_ n: Int, _ of: Int) -> String { String(format: text("pile.widen.people"), n, of) }
    public static func widenWithout(_ names: String) -> String { String(format: text("pile.widen.without"), names) }
    public static var edgeEarlyYou: String { text("edge.earlyMorning.you") }
    public static func edgeEarlyOneYou(_ time: String) -> String { String(format: text("edge.earlyMorning.oneYou"), time) }
    public static func edgeEarlyOne(_ who: String, _ time: String) -> String { String(format: text("edge.earlyMorning.one"), who, time) }
    public static func edgeEarlyMany(_ list: String) -> String { String(format: text("edge.earlyMorning.many"), list) }
    public static var edgeNewYearsDay: String { text("edge.newYearsDay") }
    public static var edgeBackYou: String { text("edge.backToBack.you") }
    public static var edgeBackOneYou: String { text("edge.backToBack.oneYou") }
    public static func edgeBackOne(_ who: String) -> String { String(format: text("edge.backToBack.one"), who) }
    public static func edgeBackMany(_ list: String) -> String { String(format: text("edge.backToBack.many"), list) }

    // MARK: The home page (#201)

    public static var homeToday: String { text("calendarView.today") }
    public static var homeTitle: String { text("nav.home") }
    public static var homeEvents: String { text("nav.eventsShort") }
    public static var homeProfile: String { text("nav.profileShort") }
    /// "2 venter på dit svar": Aftaler's and Profil's badge, read with the button.
    public static func homeWaiting(_ n: Int) -> String { String(format: text("nav.waitingForAnswer"), n) }
    /// "1 kalender er ikke sat op": Kalendere's badge, read with the button.
    public static func homeToSort(_ n: Int) -> String {
        n == 1 ? text("calendarTour.badge.one") : String(format: text("calendarTour.badge.many"), n)
    }
    public static var homePlan: String { text("planFromCalendar.button") }
    public static var homeTell: String { text("tellCasy.button") }
    public static var homeStarred: String { text("prime.dayMark") }
    public static func homeVoteAnswer(_ title: String) -> String { format("homeVote.answer", title) }
    public static func homeVotesWaiting(_ n: Int) -> String { format("homeVote.waiting.many", n) }

    // Answering a vote over the day view (#282): the web's HomeVote, CardFace, SwipeCard.
    public static func voteDateOf(_ n: Int, _ total: Int) -> String { format("swipe.dateOf", n, total) }
    public static func voteMatchScore(_ n: Int) -> String { format("swipe.matchScore", n) }
    public static var voteCan: String { text("swipe.can") }
    public static var voteCant: String { text("swipe.cant") }
    public static var voteRather: String { text("swipe.rather") }
    /// "Jeg kan": an answer button's label, read aloud.
    public static func voteAnswerLong(_ answer: String) -> String { text("swipe.answerLong.\(answer)") }
    /// "Kan": the answer in "Du svarede: Kan".
    public static func voteAnswerWord(_ answer: String) -> String { text("swipe.answerWord.\(answer)") }
    public static func voteYouAnswered(_ word: String) -> String { format("swipe.youAnswered", word) }
    /// "Du har Arbejde 08:30-16:00 og 1 mere": what the date runs into in your calendar.
    public static func voteClash(_ what: String, more: Int) -> String {
        more > 0 ? format("swipe.clashMore", what, more) : format("swipe.clash", what)
    }
    public static var votePrevious: String { text("swipe.previous") }
    public static var voteHint: String { text("swipe.hintShort") }
    public static var voteDoneTitle: String { text("swipe.doneTitle") }
    public static func voteWaitingFor(_ names: String) -> String { format("swipe.waitingFor", names) }
    public static var voteLater: String { text("swipe.later") }
    public static var voteDone: String { text("swipe.done") }
    public static var voteMoveConfirm: String { text("swipe.moveConfirm") }
    public static var voteMoveYes: String { text("swipe.moveYes") }
    public static var voteMoveKeep: String { text("swipe.moveKeep") }
    /// "i dag", "i morgen", "om 7 dage".
    public static func inDays(_ n: Int) -> String {
        n <= 0 ? text("scheduler.inDays.today") : n == 1 ? text("scheduler.inDays.tomorrow") : format("scheduler.inDays.many", n)
    }
    public static var agreedEveryone: String { text("homeVote.everyone") }
    /// "19:00 til 22:00" and a trip's "Afgang 08:00, hjem 20:00", under a date.
    public static func timeRange(_ start: String, _ end: String) -> String { format("scheduler.timeRange", start, end) }
    public static func tripTimes(_ start: String, _ end: String) -> String { format("scheduler.tripTimes", start, end) }
    public static var agreedShow: String { text("homeVote.show") }
    public static var dayAllDay: String { text("calendarView.allDay") }
    public static var dayHourUnit: String { text("calendarView.hourUnit") }
    public static var dayCalendarFallback: String { text("calendarView.calendarFallback") }
    public static var dayContinuesBoth: String { text("calendarView.continuesBoth") }
    public static var dayContinuesBefore: String { text("calendarView.continuesBefore") }
    public static var dayContinuesAfter: String { text("calendarView.continuesAfter") }
    public static var dayPublicHoliday: String { text("calendarView.publicHoliday") }
    public static var dayObservedDay: String { text("calendarView.observedDay") }
    public static var dayDenmark: String { text("calendarView.denmark") }
    public static var dayCasyPill: String { text("calendarView.casyPill") }
    /// "U41": the week number in the day view's corner.
    public static func dayWeek(_ n: Int) -> String { String(format: text("swipe.week"), n) }
    public static var dayOne: String { text("calendarView.oneDay") }
    public static var dayTwo: String { text("calendarView.twoDays") }
    public static var dayShowOne: String { text("calendarView.showOneDay") }
    public static var dayShowTwo: String { text("calendarView.showTwoDays") }
    public static func dayShowMonth(_ month: String) -> String { format("swipe.showMonth", month) }
    public static var adminNativeHome: String { text("admin.nativeHome") }
    public static var adminNativeHomeDetail: String { text("admin.nativeHomeDetail") }
    public static var calendarsListTitle: String { text("calendarView.listTitle") }
    public static var calendarsListIntro: String { text("calendarView.listIntro") }
    public static var calendarsHelpLabel: String { text("calendarView.priorityHelpLabel") }
    public static func calendarsShowAll(_ brand: String) -> String { format("calendarView.showAll", brand) }
    public static func calendarsShow(_ name: String) -> String { format("calendarView.show", name) }
    public static func calendarsTotal(_ n: Int) -> String { format("calendarView.total", n) }
    public static var calendarsBuiltInNoAccount: String { text("calendarView.builtInNoAccount") }
    public static func calendarsNotCounted(_ n: Int) -> String { format("calendarView.notCounted", n) }
    public static var calendarsHolidayCategory: String { text("calendarView.holidayCategory") }
    public static var calendarsHolidayCalendar: String { text("calendarView.holidayCalendar") }
    public static var calendarsNoCategory: String { text("calendarView.noCategory") }
    public static var calendarsNewCategory: String { text("calendarView.newCategory") }
    public static var calendarsNewCategoryName: String { text("calendarView.newCategoryName") }
    public static var calendarsNewCategoryPlaceholder: String { text("calendarView.newCategoryPlaceholder") }
    public static var calendarsNewCategoryAsk: String { text("calendarView.newCategoryAsk") }
    public static var calendarsNewCategoryYes: String { text("calendarView.newCategoryYes") }
    public static var calendarsNewCategoryNo: String { text("calendarView.newCategoryNo") }
    public static var calendarsNewCategorySave: String { text("calendarView.newCategorySave") }
    public static var calendarsGuessedCategory: String { text("calendarView.guessedCategory") }
    public static func calendarsCategoryFor(_ name: String) -> String { format("calendarView.categoryFor", name) }
    public static func calendarsPriorityFor(_ name: String) -> String { format("calendarView.priorityFor", name) }
    public static func calendarsRename(_ name: String) -> String { format("calendarView.rename", name) }
    public static func calendarsOriginally(_ name: String) -> String { format("calendarView.originally", name) }
    public static func calendarsUseOriginalName(_ name: String) -> String { format("calendarView.useOriginalName", name) }
    public static var calendarsSaveCategoryFailed: String { text("calendarView.couldntSaveCategory") }
    public static var calendarsSaveIncludedFailed: String { text("calendarView.couldntSaveIncluded") }
    public static var calendarsSavePriorityFailed: String { text("calendarView.couldntSavePriority") }
    public static var calendarsSaveNameFailed: String { text("calendarView.couldntSaveName") }
    public static var calendarsTryAgain: String { text("calendarView.tryAgain") }
    /// A group of the list by its provider: Google, Apple, Særlige, Telefon, Indbygget.
    public static func calendarsBrand(_ provider: String) -> String { named("calendarView.brands", provider) }
    public static var calendarsAppleName: String { text("calendarView.providerNames.apple") }
    public static var calendarsLinkName: String { text("calendarView.providerNames.ics") }
    /// A calendar's provider, as the web's `providerNames` ("Google", "Telefon").
    public static func providerName(_ provider: String) -> String? {
        switch provider {
        case "builtin", "google", "outlook", "apple", "ics", "device": text("calendarView.providerNames.\(provider)")
        default: nil
        }
    }
    /// Arbejde, Skole, Privat, Andet.
    public static func category(_ purpose: String) -> String { named("category", purpose) }
    /// Lav, Normal or Høj prioritet: the app's names for a calendar's priority (#221).
    public static func priorityLevel(_ priority: String) -> String { named("calendarTour.levels", priority) }
    public static var priorityLevelsHelp: String { text("calendarTour.levelsHelp") }
    /// Apple-kalender, Denne telefon, Kalenderlink (ICS), Google Kalender, Outlook-kalender.
    public static func provider(_ id: String) -> String { named("provider", id) }

    public static var tourTitle: String { text("calendarTour.title") }
    public static var tourRow: String { text("calendarTour.row") }
    public static var tourRowDetail: String { text("calendarTour.rowDetail") }
    public static func tourRowUnsorted(_ n: Int) -> String { count("calendarTour.rowUnsorted", n) }
    public static var tourNext: String { text("calendarTour.next") }
    public static var tourFinish: String { text("calendarTour.finish") }
    public static func tourStep(_ i: Int, of n: Int) -> String { format("calendarTour.step", i, n) }
    public static func tourEvents(_ n: Int) -> String { count("calendarTour.events", n) }
    public static var tourCategory: String { text("calendarTour.category") }
    public static var tourImportance: String { text("calendarTour.importance") }
    public static var tourImportanceHelp: String { text("calendarTour.importanceHelp") }
    public static var tourOff: String { text("calendarTour.off") }
    public static var tourOffEffect: String { text("calendarTour.effects.off") }
    public static var tourDoneTitle: String { text("calendarTour.doneTitle") }
    public static var tourDoneBody: String { text("calendarTour.doneBody") }
    public static var tourSee: String { text("calendarTour.see") }
    public static func tourSomeFailed(_ n: Int) -> String { count("calendarTour.someFailed", n) }
    public static var tourRetry: String { text("calendarTour.retry") }

    public static var primaryTitle: String { text("primaryCalendar.title") }
    public static var primaryBadge: String { text("primaryCalendar.badge") }
    public static var primaryIntro: String { text("primaryCalendar.introShort") }
    public static var primaryAutoAddDetail: String { text("primaryCalendar.autoAddShort") }
    public static var primaryAutoAddHelp: String { text("primaryCalendar.autoAddHelp") }
    public static var primaryNoWritable: String { text("primaryCalendar.noWritable") }
    public static var primaryWaitingForSync: String { text("primaryCalendar.waitingForSync") }
    public static var primarySelectLabel: String { text("primaryCalendar.selectLabel") }
    public static var primaryChoose: String { text("primaryCalendar.choose") }
    public static var primaryNone: String { text("primaryCalendar.noneOption") }
    public static func primaryConfirmChange(_ name: String, from current: String) -> String {
        format("primaryCalendar.confirmChange", name, current)
    }
    public static func primaryConfirmClear(_ current: String) -> String { format("primaryCalendar.confirmClear", current) }
    public static var primaryYesChange: String { text("primaryCalendar.yesChange") }
    public static var primaryYesStop: String { text("primaryCalendar.yesStop") }
    public static var primaryAutoAdd: String { text("primaryCalendar.autoAdd") }
    public static var primaryAutoAddNeedsPrimary: String { text("primaryCalendar.autoAddNeedsPrimary") }
    public static var primaryAutoAddFailed: String { text("api.setAutoAdd") }

    public static var accountsRow: String { text("calendarAccounts.row") }
    public static var accountsRowDetail: String { text("calendarAccounts.rowDetail") }
    public static var accountsTitle: String { text("profile.connectedCalendars") }
    public static var accountsYours: String { text("calendarAccounts.accounts") }
    public static var accountsAdd: String { text("calendarAccounts.add") }
    public static var accountsHelp: String { text("calendarAccounts.help") }
    public static var accountsMore: String { text("calendarAccounts.more") }
    public static var accountsMoreDetail: String { text("calendarAccounts.moreDetail") }
    public static var accountsAppleElsewhere: String { text("calendarAccounts.appleElsewhere") }
    public static var accountsPhoneHint: String { text("connectPrompt.hints.device") }
    public static var accountsLinkHint: String { text("connectPrompt.hints.ics") }
    public static var syncing: String { text("profile.syncing") }
    public static var syncNow: String { text("profile.syncNow") }
    public static var syncAllFresh: String { text("profile.syncAllFresh") }
    public static func syncedAccounts(_ n: Int) -> String { count("profile.syncedAccounts", n) }
    public static func syncSomeFailed(_ failed: Int, of n: Int) -> String {
        n == 1 ? format("profile.syncSomeFailed.one", failed) : format("profile.syncSomeFailed.many", failed, n)
    }
    public static func linkAdded(_ label: String, blocks: Int) -> String { format("profile.icsAdded", label, busyBlocks(blocks)) }
    public static func appleConnected(_ label: String, calendars: Int, blocks: Int, skipped: Int) -> String {
        format("profile.appleConnected", label, calendarsCount(calendars), busyBlocks(blocks))
            + (skipped > 0 ? count("profile.appleConnected.skipped", skipped) : "")
    }
    public static var syncFailed: String { text("profile.couldntSync") }
    public static var addLinkFailed: String { text("profile.couldntAddLink") }
    public static var removeAccountFailed: String { text("profile.couldntRemove") }
    public static var connectAppleFailed: String { text("profile.couldntIcloud") }
    public static var loadCalendarsFailed: String { text("api.loadCalendars") }
    public static var loadGroupCalendarsFailed: String { text("api.loadGroupCalendars") }
    /// What removing an account deletes, and where its access is revoked.
    public static func removeAccountNote(provider: String, label: String?) -> String {
        switch provider {
        case "ics": label.map { format("providerCard.removeIcs", $0) } ?? text("providerCard.removeIcs.none")
        case "device": label.map { format("providerCard.removeDevice", $0) } ?? text("providerCard.removeDevice.none")
        case "apple": label.map { format("providerCard.removeApple", $0) } ?? text("providerCard.removeApple.none")
        default:
            label.map { format("providerCard.removeOauth", $0, provider == "google" ? "Google" : "Microsoft") }
                ?? format("providerCard.removeOauth.none", provider == "google" ? "Google" : "Microsoft")
        }
    }
    public static var unknownAccount: String { text("providerCard.unknownAccount") }
    public static var lastSyncFailed: String { text("providerCard.lastSyncFailed") }
    public static var linkStopped: String { text("providerCard.linkStopped") }
    public static var accessExpired: String { text("providerCard.accessExpired") }
    public static var reconnect: String { text("providerCard.reconnectTitle") }
    public static var removeAccountTitle: String { text("providerCard.removeTitle") }
    public static var removeAccount: String { text("providerCard.remove") }
    public static var connect: String { text("providerCard.connect") }
    public static var addLink: String { text("providerCard.addLink") }
    public static func lastFailed(_ message: String) -> String { format("providerCard.lastFailed", message) }
    public static var unknownError: String { text("providerCard.unknownError") }
    /// "for 5 min siden", a phone's short `syncedAgo` (#219).
    public static func syncedShort(minutes: Int) -> String {
        if minutes < 1 { return text("syncedShort.justNow") }
        if minutes < 60 { return format("syncedShort.minutes", minutes) }
        let hours = minutes / 60
        if hours < 24 { return format("syncedShort.hours", hours) }
        return count("syncedShort.days", hours / 24)
    }

    public static func phoneConnected(calendars: Int, blocks: Int) -> String {
        format("phoneCalendar.connected", calendarsCount(calendars), busyBlocks(blocks))
    }
    public static var phoneDenied: String { text("phoneCalendar.denied") }
    public static var phoneOpenSettings: String { text("phoneCalendar.openSettings") }
    public static var phoneNeedTitle: String { text("phoneCalendar.needTitle") }
    public static var phoneNeedBody: String { text("phoneCalendar.needBody") }
    public static var phoneImport: String { text("phoneCalendar.importCalendar") }
    public static var phoneImporting: String { text("phoneCalendar.importing") }
    public static var phoneSaveFailed: String { text("phoneCalendar.couldntSave") }
    public static var demoPhone: String { text("phoneCalendar.demo.phone") }
    public static var demoWeSee: String { text("phoneCalendar.demo.casy") }
    /// The made-up events of the import screen's picture: Tandlæge, Lægen, Middag.
    public static var demoTitles: [String] { (0..<3).map { text("phoneCalendar.demo.title\($0)") } }

    public static var appleEmail: String { text("appleForm.email") }
    public static var applePassword: String { text("appleForm.password") }
    public static var appleAbout: String { text("appleForm.about") }
    public static var appleAboutBody: String { text("appleForm.aboutBody") }
    public static var appleReading: String { text("appleForm.reading") }
    public static var appleStepByStep: String { text("appleForm.stepByStep") }
    public static func appleNoPasswordYet(_ link: String) -> String { format("appleForm.noPasswordYet", link) }
    public static func appleStuck(_ link: String) -> String { format("appleForm.stuck", link) }
    public static func appleLooksWrong(_ example: String) -> String { format("appleForm.looksWrong", example) }
    public static var linkLabel: String { text("icsForm.link") }
    public static var linkAbout: String { text("icsForm.about") }
    public static var linkAboutBody: String { text("icsForm.aboutBody") }
    public static var linkLikePassword: String { text("icsForm.likePassword") }
    public static var linkName: String { text("icsForm.name") }
    public static var linkNamePlaceholder: String { text("icsForm.namePlaceholder") }
    public static var linkReading: String { text("icsForm.reading") }

    // Tilføj til kalender (#200, Tell Casy in the code) and its speech.
    public static var tellTitle: String { text("tellCasy.title") }
    public static var tellDone: String { text("tellCasy.done") }
    public static var tellPlaceholder: String { text("tellCasy.placeholder") }
    public static var tellMorePlaceholder: String { text("tellCasy.morePlaceholder") }
    public static var tellSend: String { text("tellCasy.send") }
    public static var tellUpdate: String { text("tellCasy.update") }
    public static var tellThinking: String { text("tellCasy.thinking") }
    public static var tellUnderstood: String { text("tellCasy.understood") }
    /// Væk or Optaget.
    public static func tellKind(_ kind: String) -> String { named("tellCasy.kinds", kind) }
    public static var tellNothingFound: String { text("tellCasy.nothingFound") }
    public static func tellSave(_ n: Int) -> String { count("tellCasy.save", n) }
    public static var tellSaving: String { text("tellCasy.saving") }
    public static var tellAddDetails: String { text("tellCasy.addDetails") }
    public static var tellAgain: String { text("tellCasy.again") }
    public static func tellLeaveOut(_ label: String) -> String { format("tellCasy.leaveOut", label) }
    public static var tellKept: String { text("tellCasy.kept") }
    public static var tellKeptNote: String { text("tellCasy.keptNote") }
    public static func tellRemove(_ label: String) -> String { format("tellCasy.remove", label) }
    public static var tellFailed: String { text("tellCasy.failed") }
    public static var tellSaveFailed: String { text("tellCasy.saveFailed") }
    public static var tellDeleteFailed: String { text("tellCasy.deleteFailed") }
    public static var speak: String { text("aiPlan.speak") }
    public static var stopSpeaking: String { text("aiPlan.stopSpeaking") }
    public static var listening: String { text("aiPlan.listening") }
    public static var micDenied: String { text("aiPlan.micDenied") }
    public static var micFailed: String { text("aiPlan.micFailed") }
    public static var aiCancel: String { text("aiPlan.cancel") }
    public static func aiLeft(_ n: Int) -> String { count("aiPlan.left", n) }

    // The push ask (#139) and an app too old (#143), natively (#200).
    /// By why it is asked: "sent", "answered" or "joined".
    public static func pushAskTitle(_ reason: String) -> String { named("push.askTitle", reason) }
    public static var pushAskEnable: String { text("push.askEnable") }
    public static var pushAskLater: String { text("push.askLater") }
    public static var pushAskNote: String { text("push.askNote") }
    public static var updateTitle: String { text("updateRequired.title") }
    public static var updateBody: String { text("updateRequired.body") }
    public static var updateButton: String { text("updateRequired.button") }

    // Tid til hinanden (#171, #200): a starred day.
    public static var primeTitle: String { text("prime.title") }
    public static func primeAllFree(_ n: Int) -> String { format("prime.allFree", n) }
    public static var primeYou: String { text("prime.you") }
    public static var primeWeekend: String { text("prime.weekend") }
    public static var primeAllDay: String { text("prime.allDay") }
    public static func primeFrom(_ time: String) -> String { format("prime.from", time) }
    public static func primeUntil(_ from: String, _ to: String) -> String { format("prime.until", from, to) }
    public static var primePlan: String { text("prime.plan") }
    public static var primeFootnote: String { text("prime.footnote") }

    // A trip found in the calendar (#115, #200).
    public static func tripTitle(_ city: String) -> String { format("trips.title", city) }
    public static var tripFound: String { text("trips.found") }
    /// The bars on the home month (#202): a trip or question waiting for an answer.
    public static func tripBarPending(_ city: String) -> String { format("trips.barPending", city) }
    public static func tripBarReturn(_ city: String) -> String { format("trips.barReturn", city) }
    public static func tripBarOutbound(_ city: String) -> String { format("trips.barOutbound", city) }
    /// The note on a trip put in the phone's calendar: how it is known again (TRIP_NOTES).
    public static var tripCalendarNote: String { text("trips.calendarNote") }
    public static var tripAddFailed: String { text("trips.addFailed") }
    public static func tripAway(from: String, to: String) -> String { format("trips.away", from, to) }
    public static var tripAcceptNote: String { text("trips.acceptNote") }
    public static var tripAccept: String { text("trips.accept") }
    public static var tripDecline: String { text("trips.decline") }
    public static var tripAcceptedNote: String { text("trips.acceptedNote") }
    public static var tripRemove: String { text("trips.remove") }
    public static var tripAddToCalendar: String { text("trips.addToCalendar") }
    public static var tripAdding: String { text("trips.adding") }
    public static var tripInCalendar: String { text("trips.inCalendar") }
    public static func tripAddedTo(_ calendar: String) -> String { format("trips.addedTo", calendar) }
    public static func tripReturnTitle(_ city: String) -> String { format("trips.returnTitle", city) }
    public static var tripReturnIntro: String { text("trips.returnIntro") }
    public static func tripOutboundTitle(_ city: String) -> String { format("trips.outboundTitle", city) }
    public static var tripOutboundIntro: String { text("trips.outboundIntro") }
    public static var tripPickDay: String { text("trips.pickDay") }
    public static func tripConfirmReturn(_ day: String) -> String { format("trips.confirmReturn", day) }
    public static func tripConfirmOutbound(_ day: String) -> String { format("trips.confirmOutbound", day) }
    public static var tripPreviousMonth: String { text("trips.previousMonth") }
    public static var tripNextMonth: String { text("trips.nextMonth") }
    public static var tripNotATrip: String { text("trips.notATrip") }
    public static var tripHomeTitle: String { text("trips.homeTitle") }
    public static var tripHomeIntro: String { text("trips.homeIntro") }
    public static var tripNoneOfThem: String { text("trips.noneOfThem") }
    public static func tripRoute(_ from: String, _ to: String) -> String { format("trips.route", from, to) }
    /// Fly, Tog, Bus.
    public static func tripMode(_ mode: String) -> String { named("trips.modes", mode) }
    /// "tirs. 20. okt. kl. 16:00".
    public static func tripAt(_ date: String, _ time: String) -> String { format("trips.at", date, time) }

    // The one question before the AI does anything (#120, #147).
    public static var aiConsentTitle: String { text("aiConsent.title") }
    public static var aiConsentIntro: String { text("aiConsent.intro") }
    public static var aiConsentSent: String { text("aiConsent.sent") }
    public static var aiConsentCorrections: String { text("aiConsent.corrections") }
    public static var aiConsentShared: String { text("aiConsent.shared") }
    public static var aiConsentSafe: String { text("aiConsent.safe") }
    public static var aiConsentPrivateNote: String { text("aiConsent.privateNote") }
    public static var aiConsentReadMore: String { text("aiConsent.readMore") }
    public static var aiConsentAllow: String { text("aiConsent.allow") }
    public static var aiConsentNext: String { text("aiConsent.next") }
    /// Hvad det giver, Hvad der sendes, Hvad vi modtager, Din kontrol.
    public static var aiConsentPages: [String] { (0..<4).map { text("aiConsent.pages.\($0)") } }
    public static func aiConsentPageDot(_ n: Int, of total: Int) -> String { format("aiConsent.pageDot", n, total) }
    public static var aiConsentNotNow: String { text("aiConsent.notNow") }
    public static var aiConsentSaving: String { text("aiConsent.saving") }

    /// The stored English names of event types (STORED_TITLES in eventTitle.ts):
    /// "Evening" is shown in the reader's language; any other title as written.
    private static let storedTitles = [
        "Evening": "evening", "Lunch": "lunch", "Dinner": "dinner", "Gaming": "gaming",
        "Night out": "nightout", "Weekend trip": "weekend", "Vacation": "vacation",
        "Hangout": "meeting", "Gaming session": "gaming",
    ]

    public static func eventTitle(_ stored: String) -> String {
        storedTitles[stored].map { text("eventTypes.\($0)") } ?? stored
    }
}
