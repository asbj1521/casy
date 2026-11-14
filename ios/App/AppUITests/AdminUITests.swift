import XCTest

/// Native Admin (#198) against the fake backend, with Mia an admin: the
/// overview of Mia and Sara, no groups and no calendar accounts.
final class AdminUITests: XCTestCase {
    override func setUp() async throws {
        continueAfterFailure = false
        var reset = URLRequest(url: URL(string: "http://localhost:4318/reset")!)
        reset.httpMethod = "POST"
        reset.httpBody = Data(#"{"admin":true}"#.utf8)
        _ = try await URLSession.shared.data(for: reset)
    }

    func testTheOverviewShowsHealthNumbersAndEveryList() {
        let app = XCUIApplication()
        app.launchArguments = [
            "-casyBackend", "http://localhost:4318",
            "-casyOpenScreen", "profile",
            "-casyPushPermission", "granted",
            "-casyLang", "da",
        ]
        app.launch()
        XCTAssertTrue(app.navigationBars["Profil"].waitForExistence(timeout: 20))
        let row = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Admin")).firstMatch
        let list = app.collectionViews.firstMatch
        for _ in 0..<6 where !(row.exists && row.isHittable) { list.swipeUp(velocity: .slow) }
        row.tap()
        XCTAssertTrue(app.navigationBars["Admin"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Kalendersynkroniseringen virker."].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Brugere"].exists)
        XCTAssertTrue(app.staticTexts["Ingen har lavet en gruppe endnu."].exists)

        // The lists are under the tabs, at the bottom: a list only draws what is on screen.
        app.segmentedControls.buttons["Brugere"].tap()
        list.swipeUp(velocity: .slow)
        XCTAssertTrue(app.staticTexts["Sara"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Mia Jensen"].exists)

        app.segmentedControls.buttons["Kalendersundhed"].tap()
        list.swipeUp(velocity: .slow)
        XCTAssertTrue(app.staticTexts["Ingen kalenderkonti passer til det."].waitForExistence(timeout: 10))
    }
}
