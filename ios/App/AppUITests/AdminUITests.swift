import XCTest

/// Native Admin (#198) against the fake backend, with Mia an admin: the
/// overview of Mia and Sara, no groups and no calendar accounts, and the
/// made-up reports and AI corrections of e2e/adminReviews.ts.
final class AdminUITests: XCTestCase {
    override func setUp() async throws {
        continueAfterFailure = false
        var reset = URLRequest(url: URL(string: "\(testBackend)/reset")!)
        reset.httpMethod = "POST"
        reset.httpBody = Data(#"{"admin":true,"reviews":true}"#.utf8)
        _ = try await URLSession.shared.data(for: reset)
    }

    private func openAdmin() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [
            "-casyBackend", testBackend,
            "-casyOpenScreen", "profile",
            "-casyPushPermission", "granted",
            "-casyLang", "da",
        ]
        app.launch()
        XCTAssertTrue(app.navigationBars["Profil"].waitForExistence(timeout: 20))
        let row = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Admin")).firstMatch
        for _ in 0..<6 where !(row.exists && row.isHittable) { app.screenList.swipeUp(velocity: .slow) }
        row.tap()
        XCTAssertTrue(app.navigationBars["Admin-tilstand"].waitForExistence(timeout: 10))
        return app
    }

    /// A button by the start of its words, scrolled to until a tap reaches it.
    private func button(_ app: XCUIApplication, _ start: String) -> XCUIElement {
        let found = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", start)).firstMatch
        for _ in 0..<6 where !(found.exists && found.isHittable) { app.screenList.swipeUp(velocity: .slow) }
        return found
    }

    func testTheOverviewShowsHealthNumbersAndEveryList() {
        let app = openAdmin()
        XCTAssertTrue(app.staticTexts["Kalendersynkroniseringen virker."].waitForExistence(timeout: 10))

        // The tabs, as the web's: each a button with its count.
        _ = button(app, "Grupper")
        XCTAssertTrue(any(app, containing: "Ingen har lavet en gruppe endnu.").waitForExistence(timeout: 5))
        button(app, "Brugere").tap()
        XCTAssertTrue(app.staticTexts["Sara"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Mia Jensen"].exists)

        button(app, "Kalendersundhed").tap()
        XCTAssertTrue(any(app, containing: "Ingen kalenderkonti passer til det.").waitForExistence(timeout: 10))
    }

    /// Deleting an account is asked in "Er du sikker?", which waits for its
    /// name, then says what went (#198, the web's UserRow).
    func testDeletingAnAccountWaitsForItsNameThenSaysWhatWent() {
        let app = openAdmin()
        button(app, "Brugere").tap()
        let bin = button(app, "Slet konto Sara")
        XCTAssertTrue(bin.waitForExistence(timeout: 10))
        bin.tap()
        let ask = app.staticTexts["Er du sikker?"]
        XCTAssertTrue(ask.waitForExistence(timeout: 10))

        let delete = app.buttons.matching(NSPredicate(format: "label == %@", "Slet konto")).firstMatch
        XCTAssertTrue(delete.exists)
        XCTAssertFalse(delete.isEnabled, "deletable before the name is typed")
        let field = app.textFields.firstMatch
        field.tap()
        field.typeText("sara")
        // The iPhone 17e simulator's keyboard swallows the first tap after typing.
        ask.tap()
        XCTAssertTrue(delete.isEnabled)
        delete.tap()

        XCTAssertTrue(ask.waitForNonExistence(timeout: 10))
        for _ in 0..<6 { app.screenList.swipeDown(velocity: .fast) }
        XCTAssertTrue(any(app, containing: "Sara blev slettet.").waitForExistence(timeout: 10))
    }

    private func any(_ app: XCUIApplication, containing text: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
    }

    /// A report shows what and why, never who; a picture is taken down, and
    /// Klaret makes it go (#142, #187).
    func testAReportIsReadThenDealtWith() {
        let app = openAdmin()
        // Folded away until opened, as on the web.
        let reports = button(app, "Rapporter")
        XCTAssertTrue(reports.waitForExistence(timeout: 10))
        reports.tap()
        XCTAssertTrue(any(app, containing: "Gruppe · Spam eller reklame").waitForExistence(timeout: 10))
        XCTAssertTrue(any(app, containing: "Reklamer hele tiden").exists)

        let picture = app.buttons["Fjern billedet"]
        for _ in 0..<3 where !(picture.exists && picture.isHittable) { app.screenList.swipeUp(velocity: .slow) }
        picture.tap()
        XCTAssertTrue(app.buttons["Billedet er fjernet"].waitForExistence(timeout: 10))

        button(app, "Klaret").tap()
        XCTAssertTrue(
            any(app, containing: "Reklamer hele tiden").waitForNonExistence(timeout: 10), "still listed")
        XCTAssertTrue(any(app, containing: "Medlem · Stødende eller upassende").exists)
    }

    /// Where the AI was wrong comes first, in words; Håndteret deletes it (#122).
    func testACorrectionSaysWhatTheAiSaidAndIsHandled() {
        let app = openAdmin()
        let corrections = button(app, "Rettelser til AI'en")
        XCTAssertTrue(corrections.waitForExistence(timeout: 10))
        corrections.tap()
        for _ in 0..<2 { app.screenList.swipeUp(velocity: .slow) }
        // The label correction was sent second, but a plan sent as it was goes last.
        let label = any(app, containing: "Eksamen i statistik")
        let right = any(app, containing: "Sendt, som AI'en lavede den")
        XCTAssertTrue(label.waitForExistence(timeout: 10))
        XCTAssertTrue(!right.exists || right.frame.minY > label.frame.minY, "a right plan came first")
        XCTAssertTrue(
            any(app, containing: "AI'en sagde: Eksamen · Almindelig. Efter rettelsen: Eksamen · Meget vigtig.").exists)
        XCTAssertTrue(any(app, containing: "startHour: 18 → 16").exists)

        button(app, "Håndteret").tap()
        XCTAssertTrue(any(app, containing: "Eksamen i statistik").waitForNonExistence(timeout: 10))
    }

    /// The push test goes the whole way and says how many phones got it (#139).
    func testThePushTestSaysHowManyPhonesGotIt() {
        let app = openAdmin()
        let test = button(app, "Send en test-notifikation")
        XCTAssertTrue(test.waitForExistence(timeout: 10))
        test.tap()
        XCTAssertTrue(any(app, containing: "Sendt til 1 telefon.").waitForExistence(timeout: 10))
    }
}
