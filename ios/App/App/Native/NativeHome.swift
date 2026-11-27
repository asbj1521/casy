import Foundation

/// Whether the home page is the app's own (#201): always, now the app has no
/// page (#202). A UI test that still plays the page's part chooses: its own
/// home page (`-casyNativeHome YES`, `-casy.nativeHome YES`) or none.
enum NativeHome {
    static let key = "casy.nativeHome"
    /// Posted when the switch changes, so the home page comes or goes at once.
    static let switched = Notification.Name("casy.nativeHomeSwitched")

    static var on: Bool {
        #if DEBUG
            if TestLaunch.isActive {
                if TestLaunch.webOnly { return false }
                if TestLaunch.nativeHome || PageFree.on { return true }
                return UserDefaults.standard.bool(forKey: key)
            }
        #endif
        return true
    }
}
