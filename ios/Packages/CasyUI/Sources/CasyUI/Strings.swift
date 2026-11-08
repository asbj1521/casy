// The words the shared pieces use. Each screen adds its own to the catalog as
// it is ported, from src/i18n/da.tsx and en.tsx.

import Foundation

public enum CasyStrings {
    public static var cancel: String { String(localized: "common.cancel", bundle: .module) }
    public static var done: String { String(localized: "common.done", bundle: .module) }
    public static var save: String { String(localized: "common.save", bundle: .module) }
    public static var areYouSure: String {
        String(localized: "common.areYouSure", bundle: .module)
    }
    public static var loading: String { String(localized: "common.loading", bundle: .module) }
}
