import Foundation

/// The native home page's switch (#201): Admin's "Native forside", kept on this
/// phone, and only in a Debug build while the home page is being built. Off,
/// the web's home page is what is seen, as for everyone else.
enum NativeHome {
    static let key = "casy.nativeHome"
    /// Posted when the switch changes, so the home page comes or goes at once.
    static let switched = Notification.Name("casy.nativeHomeSwitched")

    static var on: Bool {
        get {
            #if DEBUG
                if TestLaunch.isActive, TestLaunch.webOnly { return false }
                if TestLaunch.isActive, TestLaunch.nativeHome { return true }
                return UserDefaults.standard.bool(forKey: key)
            #else
                return false
            #endif
        }
        set {
            UserDefaults.standard.set(newValue, forKey: key)
            NotificationCenter.default.post(name: switched, object: nil)
        }
    }
}
