// swift-tools-version: 6.2
import PackageDescription

/// Casy's design language in SwiftUI (#192): colours, the glass buttons, list
/// rows, fields and the strings, shared by every native screen. See
/// docs/native-ios-plan.md.
let package = Package(
    name: "CasyUI",
    platforms: [.iOS(.v18)],
    products: [
        .library(name: "CasyUI", targets: ["CasyUI"])
    ],
    targets: [
        .target(name: "CasyUI")
    ],
    swiftLanguageModes: [.v6]
)
