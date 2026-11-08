// swift-tools-version: 6.2
import PackageDescription

// The Edge Function client and the answers as Codable types
// (docs/native-ios-plan.md). macOS is here only so the tests run without a simulator.
let package = Package(
    name: "CasyAPI",
    platforms: [.iOS(.v18), .macOS(.v15)],
    products: [.library(name: "CasyAPI", targets: ["CasyAPI"])],
    dependencies: [.package(path: "../CasyCore")],
    targets: [
        .target(name: "CasyAPI", dependencies: ["CasyCore"]),
        .testTarget(
            name: "CasyAPITests",
            dependencies: ["CasyAPI"],
            resources: [.copy("Answers")]
        ),
    ]
)
