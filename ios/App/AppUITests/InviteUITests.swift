import XCTest

/// "Indsæt link" natively (#282): the welcome's way back to an invite, as the
/// web's InvitePasteSheet. A link typed in, or found in what is copied (a test
/// hands it over with `-casyCopied`, never the real pasteboard), opens the
/// invite's page; copied text with no invite in it says so.
final class InviteUITests: XCTestCase {
    override func setUp() async throws {
        continueAfterFailure = false
        var reset = URLRequest(url: URL(string: "http://localhost:4318/reset")!)
        reset.httpMethod = "POST"
        _ = try await URLSession.shared.data(for: reset)
    }

    /// Signed out, as a friend who just installed the app: the page asks for the welcome.
    private func launch(copied: String? = nil) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [
            "-casyBackend", "http://localhost:4318",
            "-casyPageAuth", "YES",
            "-casyLang", "da",
            "-casyNow", "2026-10-07T08:00:00.000Z",
        ]
        if let copied { app.launchArguments += ["-casyCopied", copied] }
        app.launch()
        return app
    }

    /// The welcome's "Indsæt link", and the sheet it opens over the welcome.
    private func openSheet(_ app: XCUIApplication) -> XCUIElement {
        let paste = app.buttons["welcome.paste"]
        XCTAssertTrue(paste.waitForExistence(timeout: 45), "the welcome's Indsæt link")
        paste.tap()
        let go = app.buttons["invitePaste.go"]
        XCTAssertTrue(go.waitForExistence(timeout: 10), "the paste sheet")
        XCTAssertTrue(app.descendants(matching: .any)["welcome.screen"].exists, "over the welcome, not instead of it")
        return go
    }

    /// The invite's page, whoever draws it: the group the fake backend's link leads to.
    private func invitePage(_ app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", "Sommerhuset")).firstMatch
    }

    func testALinkTypedInOpensTheInvite() {
        let app = launch()
        let go = openSheet(app)
        XCTAssertEqual(go.label, "Indsæt link", "nothing typed: the button reads what is copied")
        let field = app.textFields["invitePaste.field"]
        field.tap()
        field.typeText("https://casy.app/join/abc123")
        XCTAssertTrue(app.buttons["Åbn invitation"].waitForExistence(timeout: 5), "a link: the button opens it")
        app.buttons["invitePaste.go"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["welcome.screen"].waitForNonExistence(timeout: 10))
        XCTAssertTrue(invitePage(app).waitForExistence(timeout: 20), "the invite's page")
    }

    func testTheButtonFindsTheInviteInWhatIsCopied() {
        let app = launch(copied: "Kom med i gruppen: https://casy.app/join/abc123!")
        openSheet(app).tap()
        XCTAssertTrue(invitePage(app).waitForExistence(timeout: 20), "the invite's page")
    }

    func testCopiedTextWithoutAnInviteSaysSo() {
        let app = launch(copied: "Ses på fredag")
        openSheet(app).tap()
        let note = app.staticTexts["invitePaste.note"]
        XCTAssertTrue(note.waitForExistence(timeout: 5))
        XCTAssertTrue(note.label.hasPrefix("Intet invitationslink fundet"))
        XCTAssertTrue(app.textFields["invitePaste.field"].exists, "the field, to paste it in by hand")
        app.buttons["Annuller"].tap()
        XCTAssertTrue(app.buttons["invitePaste.go"].waitForNonExistence(timeout: 5))
        XCTAssertTrue(app.buttons["welcome.paste"].exists, "back on the welcome")
    }

    /// Signed in, the invite's page natively: Bliv medlem joins, and the page closes for home.
    func testJoiningFromTheInvitesPage() {
        let app = XCUIApplication()
        app.launchArguments = [
            "-casyBackend", "http://localhost:4318",
            "-casyOpenScreen", "join:abc123",
            "-casyLang", "da",
            "-casyNow", "2026-10-07T08:00:00.000Z",
        ]
        app.launch()
        XCTAssertTrue(invitePage(app).waitForExistence(timeout: 20), "the group the link leads to")
        XCTAssertTrue(app.staticTexts["Sara har inviteret dig til"].exists, "who asked")
        let answer = app.buttons["join.answer"]
        XCTAssertEqual(answer.label, "Bliv medlem")
        answer.tap()
        XCTAssertTrue(
            app.descendants(matching: .any)["join.screen"].waitForNonExistence(timeout: 15), "joined, it closes")
    }

    /// A link that no longer works says why, and leads home.
    func testABrokenLinkSaysWhy() {
        let app = XCUIApplication()
        app.launchArguments = [
            "-casyBackend", "http://localhost:4318",
            "-casyOpenScreen", "join:expired-token",
            "-casyLang", "da",
            "-casyNow", "2026-10-07T08:00:00.000Z",
        ]
        app.launch()
        XCTAssertTrue(app.staticTexts["Invitationen virker ikke"].waitForExistence(timeout: 20))
        app.buttons["join.home"].firstMatch.tap()
        XCTAssertTrue(app.descendants(matching: .any)["join.screen"].waitForNonExistence(timeout: 10))
    }
}
