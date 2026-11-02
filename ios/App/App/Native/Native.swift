import CasyUI

/// The app's own SwiftUI (#192) lives in this folder, a synchronized folder:
/// Xcode finds every file in it by itself, so a new one needs no edit to
/// project.pbxproj (#196). The bridge between the web view and the native
/// screens goes in Bridge/, the screens in Screens/.
enum Native {
    /// Proof the app links the local CasyUI package; replaced by real use in Phase 1.
    static let designPackage = CasyUI.name
}
