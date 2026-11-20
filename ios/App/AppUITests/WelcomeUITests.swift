import XCTest

/// The welcome, natively (#282): the intro plays, then the animation runs
/// under the line and the ways in; "Find en dag" opens sign-in on Opret konto
/// over the welcome's colour, and Tilbage brings the welcome back.
final class WelcomeUITests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    private func launch() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [
            "-casyBackend", "http://localhost:4318",
            "-casyOpenScreen", "welcome",
            "-casyLang", "da",
            "-casyNow", "2026-10-07T08:00:00.000Z",
            "-casyKeepIntro", "YES",
        ]
        app.launch()
        return app
    }

    func testTheIntroThenTheWaysIn() {
        let app = launch()
        XCTAssertTrue(app.staticTexts["Vi kender det alle:"].waitForExistence(timeout: 20), "the intro first")
        let start = app.buttons["welcome.start"]
        XCTAssertTrue(start.waitForExistence(timeout: 30), "the ways in, after the intro")
        XCTAssertTrue(app.buttons["welcome.signIn"].exists)
        XCTAssertTrue(app.buttons["welcome.paste"].exists)
        _ = XCTWaiter.wait(for: [expectation(description: "the animation runs")], timeout: 6)
        start.tap()
        XCTAssertTrue(app.buttons["signin.apple"].waitForExistence(timeout: 5), "sign-in over the colour")
        XCTAssertTrue(app.buttons["signin.tab.signUp"].isSelected, "on Opret konto")
        _ = XCTWaiter.wait(for: [expectation(description: "seen")], timeout: 1.5)
        app.buttons["signin.back"].tap()
        XCTAssertTrue(app.buttons["signin.apple"].waitForNonExistence(timeout: 5))
        XCTAssertTrue(start.waitForExistence(timeout: 5), "the welcome back")
        _ = XCTWaiter.wait(for: [expectation(description: "back")], timeout: 1.5)
    }
}
