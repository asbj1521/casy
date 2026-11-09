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
}
