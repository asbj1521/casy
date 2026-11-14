import XCTest

/// Native Admin (#198) against the fake backend, with Mia an admin: the
/// overview of Mia and Sara, no groups and no calendar accounts, and the
/// made-up reports and AI corrections of e2e/adminReviews.ts.
final class AdminUITests: XCTestCase {
    override func setUp() async throws {
        continueAfterFailure = false
        var reset = URLRequest(url: URL(string: "http://localhost:4318/reset")!)
        reset.httpMethod = "POST"
        reset.httpBody = Data(#"{"admin":true,"reviews":true}"#.utf8)
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

        // The lists are under the tabs, at the bottom: a list only draws what is on screen.
        let tabs = app.segmentedControls.firstMatch
        for _ in 0..<4 where !(tabs.exists && tabs.isHittable) { list.swipeUp(velocity: .slow) }
        XCTAssertTrue(app.staticTexts["Ingen har lavet en gruppe endnu."].waitForExistence(timeout: 5))
        app.segmentedControls.buttons["Brugere"].tap()
        list.swipeUp(velocity: .slow)
        XCTAssertTrue(app.staticTexts["Sara"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Mia Jensen"].exists)

        app.segmentedControls.buttons["Kalendersundhed"].tap()
        list.swipeUp(velocity: .slow)
        XCTAssertTrue(app.staticTexts["Ingen kalenderkonti passer til det."].waitForExistence(timeout: 10))
    }

    /// An account opens on its own screen; deleting it waits for its name,
    /// then goes back to the list with a note of what went (#198).
    func testDeletingAnAccountWaitsForItsNameThenSaysWhatWent() {
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
        let tabs = app.segmentedControls.firstMatch
        for _ in 0..<4 where !(tabs.exists && tabs.isHittable) { list.swipeUp(velocity: .slow) }
        app.segmentedControls.buttons["Brugere"].tap()
        list.swipeUp(velocity: .slow)
        let sara = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Sara")).firstMatch
        XCTAssertTrue(sara.waitForExistence(timeout: 10))
        sara.tap()
        XCTAssertTrue(app.navigationBars["Sara"].waitForExistence(timeout: 10))

        let delete = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Slet konto")).firstMatch
        for _ in 0..<4 where !(delete.exists && delete.isHittable) { list.swipeUp(velocity: .slow) }
        XCTAssertFalse(delete.isEnabled, "deletable before the name is typed")
        let field = app.textFields.firstMatch
        field.tap()
        field.typeText("sara")
        XCTAssertTrue(delete.isEnabled)
        delete.tap()

        XCTAssertTrue(app.navigationBars["Admin"].waitForExistence(timeout: 10))
        for _ in 0..<4 { list.swipeDown(velocity: .fast) }
        XCTAssertTrue(app.staticTexts["Sara blev slettet."].waitForExistence(timeout: 10))
    }

    private func openAdmin() -> XCUIApplication {
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
        return app
    }

    private func any(_ app: XCUIApplication, containing text: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
    }

    /// A report shows what and why, never who; a picture is taken down, and
    /// Klaret makes it go (#142, #187).
    func testAReportIsReadThenDealtWith() {
        let app = openAdmin()
        let reports = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Rapporter")).firstMatch
        XCTAssertTrue(reports.waitForExistence(timeout: 10))
        reports.tap()
        XCTAssertTrue(app.navigationBars["Rapporter"].waitForExistence(timeout: 10))
        XCTAssertTrue(any(app, containing: "Gruppe · Spam eller reklame").waitForExistence(timeout: 10))
        XCTAssertTrue(any(app, containing: "Reklamer hele tiden").exists)

        let picture = app.buttons["Fjern billedet"]
        let list = app.collectionViews.firstMatch
        for _ in 0..<3 where !(picture.exists && picture.isHittable) { list.swipeUp(velocity: .slow) }
        picture.tap()
        XCTAssertTrue(app.buttons["Billedet er fjernet"].waitForExistence(timeout: 10))

        list.swipeDown(velocity: .fast)
        app.buttons["Klaret"].firstMatch.tap()
        XCTAssertTrue(
            any(app, containing: "Reklamer hele tiden").waitForNonExistence(timeout: 10), "still listed")
        XCTAssertTrue(any(app, containing: "Medlem · Stødende eller upassende").exists)
    }

    /// Where the AI was wrong comes first, in words; Håndteret deletes it (#122).
    func testACorrectionSaysWhatTheAiSaidAndIsHandled() {
        let app = openAdmin()
        let corrections = app.buttons.matching(
            NSPredicate(format: "label BEGINSWITH %@", "Rettelser til AI'en")).firstMatch
        XCTAssertTrue(corrections.waitForExistence(timeout: 10))
        corrections.tap()
        XCTAssertTrue(app.navigationBars["Rettelser til AI'en"].waitForExistence(timeout: 10))
        // The label correction was sent second, but a plan sent as it was goes last.
        let label = any(app, containing: "Eksamen i statistik")
        let right = any(app, containing: "Sendt, som AI'en lavede den")
        XCTAssertTrue(label.waitForExistence(timeout: 10))
        XCTAssertTrue(!right.exists || right.frame.minY > label.frame.minY, "a right plan came first")
        XCTAssertTrue(
            any(app, containing: "AI'en sagde: Eksamen · Almindelig. Efter rettelsen: Eksamen · Meget vigtig.").exists)
        XCTAssertTrue(any(app, containing: "startHour: 18 → 16").exists)

        app.buttons["Håndteret"].firstMatch.tap()
        XCTAssertTrue(any(app, containing: "Eksamen i statistik").waitForNonExistence(timeout: 10))
    }

    /// The push test goes the whole way and says how many phones got it (#139).
    func testThePushTestSaysHowManyPhonesGotIt() {
        let app = openAdmin()
        let test = app.buttons["Send en test-notifikation"]
        XCTAssertTrue(test.waitForExistence(timeout: 10))
        test.tap()
        XCTAssertTrue(any(app, containing: "Sendt til 1 telefon.").waitForExistence(timeout: 10))
    }
}
