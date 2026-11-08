// swift-tools-version: 6.2
import PackageDescription

// Casy's design language in SwiftUI (docs/native-ios-plan.md): colours, the
// glass buttons, list rows, fields and the shared strings. macOS is here only
// so the tests run without a simulator.
let package = Package(
    name: "CasyUI",
    defaultLocalization: "da",
    platforms: [.iOS(.v18), .macOS(.v15)],
    products: [.library(name: "CasyUI", targets: ["CasyUI"])],
    dependencies: [
        // Only for the snapshot tests; nothing in the library or the app uses it.
        .package(url: "https://github.com/pointfreeco/swift-snapshot-testing", from: "1.18.0")
    ],
    targets: [
        .target(name: "CasyUI", resources: [.process("Resources")]),
        .testTarget(
            name: "CasyUITests",
            dependencies: ["CasyUI"],
            resources: [.copy("Fixtures")]
        ),
        .testTarget(
            name: "CasyUISnapshotTests",
            dependencies: [
                "CasyUI",
                .product(name: "SnapshotTesting", package: "swift-snapshot-testing"),
            ],
            exclude: ["__Snapshots__"]
        ),
    ]
)
