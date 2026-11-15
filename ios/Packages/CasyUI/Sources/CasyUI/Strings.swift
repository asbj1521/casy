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
