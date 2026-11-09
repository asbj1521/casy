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
}
