import XCTest

/// The small asks (#200): the AI's question on its own, what is said before
/// iOS's question about notifications, and an app too old to go on.
final class AsksUITests: XCTestCase {
    override func setUp() async throws {
        continueAfterFailure = false
        var reset = URLRequest(url: URL(string: "http://localhost:4318/reset")!)
        reset.httpMethod = "POST"
        reset.httpBody = Data(#"{"aiConsent":false}"#.utf8)
        _ = try await URLSession.shared.data(for: reset)
    }

    private func launch(_ screen: String, _ extra: [String] = []) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments =
            [
                "-casyBackend", "http://localhost:4318",
                "-casyOpenScreen", screen,
                "-casyLang", "da",
            ] + extra
        app.launch()
        return app
    }

    /// Four pages, then Tillad: the sheet closes on the yes.
    func testTheAiQuestionOnItsOwn() {
        let app = launch("aiConsent")
        XCTAssertTrue(app.navigationBars["Slå AI til?"].waitForExistence(timeout: 20))
        let next = app.buttons["aiConsent.next"]
        for _ in 0..<3 { next.tap() }
        next.tap()
        XCTAssertTrue(app.navigationBars["Slå AI til?"].waitForNonExistence(timeout: 10))
    }

    /// Ikke nu closes it too, with nothing changed.
    func testTheAiQuestionNotNow() {
        let app = launch("aiConsent")
        XCTAssertTrue(app.navigationBars["Slå AI til?"].waitForExistence(timeout: 20))
        app.buttons["Ikke nu"].firstMatch.tap()
        XCTAssertTrue(app.navigationBars["Slå AI til?"].waitForNonExistence(timeout: 10))
    }

    /// Nothing to put away: Fortsæt goes to iOS, and the sheet goes with its answer.
    func testThePushAskLeadsOnlyToIos() {
        let app = launch("push", ["-casyPushAnswer", "granted"])
        XCTAssertTrue(app.staticTexts["Få besked, når de andre har svaret"].waitForExistence(timeout: 20))
        XCTAssertFalse(app.buttons["Ikke nu"].exists)
        shot("push-ask")
        app.buttons["push.enable"].tap()
        XCTAssertTrue(app.buttons["push.enable"].waitForNonExistence(timeout: 10))
    }

    /// If turning them on failed, it says so and can then be put away.
    func testThePushAskAfterAFailure() {
        let app = launch("push", ["-casyPushAnswer", "failed"])
        let enable = app.buttons["push.enable"]
        XCTAssertTrue(enable.waitForExistence(timeout: 20))
        enable.tap()
        XCTAssertTrue(
            app.staticTexts["Notifikationer kunne ikke slås til. Prøv igen."].waitForExistence(timeout: 10))
        app.buttons["Ikke nu"].firstMatch.tap()
        XCTAssertTrue(enable.waitForNonExistence(timeout: 10))
    }

    /// Too old: over everything, with nothing but the way to update.
    func testAnAppTooOld() {
        let app = launch("update")
        XCTAssertTrue(app.staticTexts["Opdater appen"].waitForExistence(timeout: 20))
        XCTAssertFalse(app.buttons["Færdig"].exists)
        shot("update")
    }
}
