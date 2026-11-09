#if DEBUG
    import CasyUI
    import Foundation
    import UIKit

    /// How the UI tests start a native screen signed in, against the fake
    /// backend (scripts/native/ui-tests.sh). A Debug build only: a Release
    /// build can't be pointed anywhere but the real project.
    ///
    /// `-casyBackend <url>` lends a made-up login, `-casyOpenScreen <name>`
    /// opens a screen, `-casyPushPermission <prompt|granted|denied>` answers
    /// for iOS, whose real prompt shows once, and `-casyLang <da|en>`.
    enum TestLaunch {
        private static let defaults = UserDefaults.standard

        static var backend: URL? {
            defaults.string(forKey: "casyBackend").flatMap(URL.init(string:))
        }
        static var isActive: Bool { backend != nil }
        static var screen: String? { defaults.string(forKey: "casyOpenScreen") }
        static var pushPermission: String? { defaults.string(forKey: "casyPushPermission") }
        static var lang: String? { defaults.string(forKey: "casyLang") }

        static func connection() -> SessionBox.Connection? {
            backend.map {
                SessionBox.Connection(
                    projectURL: $0, apiKey: "test-key", accessToken: "test-token",
                    expiresAt: .distantFuture, userId: "test-user", email: "test@example.com")
            }
        }
    }
#endif
