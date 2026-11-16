import XCTest

/// Tid til hinanden's sheet (#200) on a made-up starred day for Fredagsbar
/// (`-casyPrime`): Friday 16 October, 18:00 to 22:00.
final class PrimeDateUITests: XCTestCase {
    override func setUp() async throws {
        continueAfterFailure = false
        var reset = URLRequest(url: URL(string: "http://localhost:4318/reset")!)
        reset.httpMethod = "POST"
        _ = try await URLSession.shared.data(for: reset)
    }

    private func launch(_ extra: [String] = []) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments =
            [
                "-casyBackend", "http://localhost:4318",
                "-casyOpenScreen", "prime",
                "-casyPrime", "g-friday",
                "-casyLang", "da",
                "-casyNow", "2026-10-07T08:00:00.000Z",
            ] + extra
        app.launch()
        XCTAssertTrue(app.navigationBars["Tid til hinanden"].waitForExistence(timeout: 20))
        return app
    }

    private func any(_ app: XCUIApplication, _ words: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", words)).firstMatch
    }

    /// The group, the day and its hours, everyone named with you last.
    func testItSaysWhoIsFreeWhen() {
        let app = launch()
        XCTAssertTrue(any(app, "Fredagsbar").waitForExistence(timeout: 10))
        // Until the evening's end: said as from when.
        XCTAssertTrue(any(app, "fra 18:00").exists)
        XCTAssertTrue(any(app, "Alle 4 er fri").exists)
        XCTAssertTrue(any(app, "Emil og dig").exists)
        shot("prime")
    }

    /// The same in light.
    func testTheHalfSheetLooksLikeTheWholeInLight() {
        let app = launch(["-casy.appearance", "light"])
        XCTAssertTrue(app.navigationBars["Tid til hinanden"].waitForExistence(timeout: 10))
        sleep(1)
        shot("prime-half-light")
        let half = colour(XCUIScreen.main.screenshot(), x: 0.04, y: 0.9)
        app.navigationBars["Tid til hinanden"].swipeUp()
        sleep(1)
        let full = colour(XCUIScreen.main.screenshot(), x: 0.04, y: 0.9)
        XCTAssertEqual(half, full)
        XCTAssertEqual(full, [242, 242, 247])
    }

    /// At half height the sheet and its rows are the colours they have pulled all the way up.
    func testTheHalfSheetLooksLikeTheWhole() {
        // Dark as a phone set to dark, Casy following it.
        let app = launch(["-casy.appearance", "dark"])
        XCTAssertTrue(any(app, "Fredagsbar").waitForExistence(timeout: 10))
        shot("prime-half")
        let half = colour(XCUIScreen.main.screenshot(), x: 0.04, y: 0.9)
        app.navigationBars["Tid til hinanden"].swipeUp()
        sleep(1)
        shot("prime-full")
        let full = colour(XCUIScreen.main.screenshot(), x: 0.04, y: 0.9)
        XCTAssertEqual(half, full)
        XCTAssertEqual(full, [28, 28, 30])
    }

    /// Planlæg hands over to the page's own, which opens with the group and the day.
    func testPlanHandsOver() {
        let app = launch()
        let plan = app.buttons["prime.plan"]
        XCTAssertTrue(plan.waitForExistence(timeout: 10))
        XCTAssertTrue(any(app, "Fredagsbar").waitForExistence(timeout: 10))
        plan.tap()
        XCTAssertTrue(app.navigationBars["Tid til hinanden"].waitForNonExistence(timeout: 10))
    }
}
