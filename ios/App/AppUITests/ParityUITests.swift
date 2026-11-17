import XCTest

/// The native screens' look against the web's (#280, docs/native-visual-parity.md).
/// Every test here runs twice on iPhone 17e, through scripts/native/parity.sh:
/// CASY_PARITY_MODE=web, where no screen is native and the page draws each one
/// itself (`-casyWebOnly`), and CASY_PARITY_MODE=native. Both open the same
/// screen in the same made-up world, clock, theme and language, with the page
/// signed in as Mia (`-casyWebSession`): native, the page hands the native
/// screen its data as in real use. Each shot is saved as `<name>-<mode>.png`.
///
/// Without CASY_PARITY_MODE (the ordinary UI test run) these are skipped.
@MainActor
final class ParityUITests: XCTestCase {
    private static let backend = "http://localhost:4318"
    private static let now = "2026-10-07T08:00:00.000Z"

    private var mode: String { ProcessInfo.processInfo.environment["CASY_PARITY_MODE"] ?? "" }

    override func setUp() async throws {
        continueAfterFailure = false
        try XCTSkipUnless(["web", "native"].contains(mode), "parity shots run through parity.sh")
        var reset = URLRequest(url: URL(string: "\(Self.backend)/reset")!)
        reset.httpMethod = "POST"
        _ = try await URLSession.shared.data(for: reset)
    }

    /// The app on `path` (`/`, `/?day=2026-10-15`), in `theme`, in this run's mode.
    private func launch(_ path: String, theme: String) async throws -> XCUIApplication {
        let (session, _) = try await URLSession.shared.data(from: URL(string: "\(Self.backend)/parity/session")!)
        let app = XCUIApplication()
        app.launchArguments = [
            "-casyBackend", Self.backend,
            "-casyLang", "da",
            "-casyNow", Self.now,
            "-casyTheme", theme,
            "-casy.appearance", theme,
            // Base64: iOS reads a launch argument starting with "{" as a dictionary.
            "-casyWebSession", session.base64EncodedString(),
            "-casyWebPath", path,
        ]
        app.launchArguments += mode == "web" ? ["-casyWebOnly", "YES"] : ["-casy.nativeHome", "YES"]
        app.launch()
        return app
    }

    /// Waits for `words` on screen, makes sure the screen is the one this mode
    /// is about, lets fonts, images and the page's own entrances settle, then
    /// saves the shot as `<name>-<mode>.png`.
    ///
    /// `native` is an element only the Swift screen has (`home.title`). Web
    /// only, the words must be visible on the page and that element nowhere: the
    /// reference is always the web screen people have in the App Store build
    /// (no native screens), never a Swift one. Native, the element must be
    /// visible. Visible means on top, where a tap would reach it (`isHittable`):
    /// an element merely present can be covered by something else.
    private func shoot(_ app: XCUIApplication, _ name: String, when words: String, native: String) {
        let containing = NSPredicate(format: "label CONTAINS %@", words)
        let swift = app.descendants(matching: .any)[native]
        let shown: XCUIElement
        if mode == "web" {
            shown = app.webViews.descendants(matching: .any).matching(containing).firstMatch
        } else {
            shown = swift
        }
        XCTAssertTrue(visible(shown), "\(mode == "web" ? words : native) never showed on top")
        if mode == "web" { XCTAssertFalse(swift.exists, "a native screen (\(native)) is in the web reference") }
        _ = XCTWaiter.wait(for: [expectation(description: "settle")], timeout: 2)
        XCTAssertTrue(shown.isHittable, "\(mode == "web" ? words : native) was covered while settling")
        if mode == "web" { XCTAssertFalse(swift.exists, "a native screen (\(native)) came up while settling") }
        shot("\(name)-\(mode)")
    }

    /// Whether `element` comes up on top within 30 seconds.
    private func visible(_ element: XCUIElement) -> Bool {
        let hittable = expectation(for: NSPredicate(format: "isHittable == true"), evaluatedWith: element)
        return XCTWaiter.wait(for: [hittable], timeout: 30) == .completed
    }

    // MARK: The home page (#201)

    func testHomeMonthLight() async throws {
        let app = try await launch("/", theme: "light")
        shoot(app, "home-month-light", when: "Oktober", native: "home.title")
    }

    func testHomeMonthDark() async throws {
        let app = try await launch("/", theme: "dark")
        shoot(app, "home-month-dark", when: "Oktober", native: "home.title")
    }
}
