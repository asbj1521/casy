// swift-tools-version: 6.2
import PackageDescription

// Casy's pure logic, ported from src/lib and kept equal to it by the parity
// fixtures (docs/native-ios-plan.md). No UIKit or SwiftUI. macOS is here only
// so the tests run without a simulator.
let package = Package(
    name: "CasyCore",
    platforms: [.iOS(.v18), .macOS(.v15)],
    products: [.library(name: "CasyCore", targets: ["CasyCore"])],
    targets: [
        .target(name: "CasyCore"),
        .testTarget(
            name: "CasyCoreTests",
            dependencies: ["CasyCore"],
            resources: [.copy("Parity")]
        ),
    ]
)
