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

    private func launch() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [
            "-casyBackend", "http://localhost:4318",
            "-casyOpenScreen", "prime",
            "-casyPrime", "g-friday",
            "-casyLang", "da",
            "-casyNow", "2026-10-07T08:00:00.000Z",
        ]
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
