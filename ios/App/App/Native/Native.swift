import CasyAPI
import CasyCore
import CasyUI
import Foundation

/// The app's own SwiftUI (#192) lives in this folder, a synchronized folder:
/// Xcode finds every file in it by itself, so a new one needs no edit to
/// project.pbxproj. The bridge between the web view and the native screens goes
/// in Bridge/, the screens in Screens/.
enum Native {
    /// The client for the Edge Functions, with the web view's login, or nil
    /// before the web view has said where they are.
    static func api() async -> EdgeFunctions? {
        guard let connection = await SessionBox.shared.current() else { return nil }
        return EdgeFunctions(
            configuration: APIConfiguration(
                projectURL: connection.projectURL, publishableKey: connection.apiKey),
            session: SessionBox.shared,
            language: { CasyStrings.language == "en" ? Lang.en : Lang.da })
    }

    /// The client for what anyone may ask, signed in or not (an invite's
    /// preview, #282): the login's when there is one, else the publishable key alone.
    static func publicApi() async -> EdgeFunctions? {
        if let signedIn = await api() { return signedIn }
        var endpoint = await SessionBox.shared.currentEndpoint()
        #if DEBUG
            // A test's page may be the real site; its native screens ask the fake backend.
            if let backend = TestLaunch.backend { endpoint = (backend, "test-key") }
        #endif
        guard let endpoint else { return nil }
        return EdgeFunctions(
            configuration: APIConfiguration(projectURL: endpoint.url, publishableKey: endpoint.apiKey),
            session: SessionBox.shared,
            language: { CasyStrings.language == "en" ? Lang.en : Lang.da })
    }

    /// Now, as epoch ms: the clock every event rule reads. A UI test fixes it
    /// (`-casyNow`) to the fake backend's moment, as the browser tests do.
    static var now: Int64 {
        #if DEBUG
            if let fixed = TestLaunch.now { return fixed }
        #endif
        return Int64(Date().timeIntervalSince1970 * 1000)
    }
}
