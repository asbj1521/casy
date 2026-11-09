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

    public static var pushFailed: String { text("push.failed") }
    public static var pushTitle: String { text("push.title") }
    public static var pushTurnOn: String { text("push.turnOn") }
    public static var pushDeniedTitle: String { text("push.deniedTitle") }
    public static var pushDenied: String { text("push.denied") }
    /// A kind of notification, by the server's name for it.
    public static func pushKind(_ kind: String) -> String { text("push.kind.\(kind)") }
}
