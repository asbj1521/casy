import XCTest

/// Native Tilføj til kalender (#200) against the fake backend, whose AI always
/// reads a first description as a week away in October and more details as a
/// course one evening; "bare noget vrøvl" it can't read.
final class TellUITests: XCTestCase {
    override func setUp() async throws {
        continueAfterFailure = false
        var reset = URLRequest(url: URL(string: "\(testBackend)/reset")!)
        reset.httpMethod = "POST"
        _ = try await URLSession.shared.data(for: reset)
    }

    func launch(_ extra: [String] = []) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments =
            [
                "-casyBackend", testBackend,
                "-casyOpenScreen", "tell",
                "-casyLang", "da",
                "-casyNow", "2026-10-07T08:00:00.000Z",
            ] + extra
        app.launch()
        XCTAssertTrue(app.navigationBars["Tilføj til kalender"].waitForExistence(timeout: 20))
        return app
    }

    func write(_ app: XCUIApplication, _ text: String) {
        let box = app.textViews["tell.box"]
        XCTAssertTrue(box.waitForExistence(timeout: 10))
        box.tap()
        box.typeText(text)
        // The iPhone 17e simulator's on-screen keyboard swallows the first tap
        // after typing (a second always works; a real phone sends on the first,
        // checked 19 Nov 2026): the title takes it, where a tap does nothing.
        app.navigationBars["Tilføj til kalender"].staticTexts.firstMatch.tap()
        app.buttons["tell.send"].tap()
    }

    func text(_ app: XCUIApplication, containing words: String) -> XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", words)).firstMatch
    }

    /// Pulled up, the sheet stops at the web's 85 %, never whole, where iOS
    /// would draw it solid: it stays Apple's glass, as Profil (#281).
    func neverWhole(_ theme: String) {
        let app = launch(["-casy.appearance", theme])
        let bar = app.navigationBars["Tilføj til kalender"]
        sleep(1)
        shot("tell-half-\(theme)")
        let half = bar.frame.minY
        // A swipe while the sheet is still settling can be lost: again, a few times.
        for _ in 0..<3 where bar.frame.minY >= half {
            bar.swipeUp()
            sleep(2)
        }
        shot("tell-full-\(theme)")
        let screen = app.windows.firstMatch.frame.height
        XCTAssertLessThan(bar.frame.minY, half, "it grows")
        XCTAssertGreaterThan(bar.frame.minY, screen * 0.12, "and stops short of the whole screen")
    }

    func testTheSheetStaysGlassInLight() { neverWhole("light") }

    func testTheSheetStaysGlass() { neverWhole("dark") }

    /// Said, checked and kept: the sheet closes on it.
    func testADescriptionIsReadCheckedAndKept() {
        let app = launch()
        write(app, "Jeg rejser fra den 12. til den 19. oktober")
        XCTAssertTrue(app.staticTexts["Sådan forstod vi det"].waitForExistence(timeout: 10))
        XCTAssertTrue(text(app, containing: "Væk").exists)
        XCTAssertTrue(text(app, containing: "29 AI-svar tilbage i dag").exists)
        shot("tell-proposal")
        let save = app.buttons["tell.save"]
        XCTAssertTrue(save.label.contains("Gem 1 post"), save.label)
        save.tap()
        XCTAssertTrue(app.navigationBars["Tilføj til kalender"].waitForNonExistence(timeout: 10))
    }

    /// More details change the proposal; one can be left out before keeping.
    func testMoreDetailsAndLeavingOneOut() {
        let app = launch()
        write(app, "Jeg rejser")
        XCTAssertTrue(app.staticTexts["Sådan forstod vi det"].waitForExistence(timeout: 10))
        app.buttons["Tilføj detaljer"].tap()
        write(app, "og har kursus torsdag aften")
        XCTAssertTrue(text(app, containing: "Kursus").waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["tell.save"].label.contains("Gem 2 poster"))
        app.buttons["Drop Rejse"].tap()
        XCTAssertTrue(app.buttons["tell.save"].label.contains("Gem 1 post"))
        app.buttons["Start forfra"].tap()
        XCTAssertTrue(app.textViews["tell.box"].waitForExistence(timeout: 5))
    }

    /// What couldn't be read says so, and what was written is back to fix.
    func testWhatCantBeReadComesBack() {
        let app = launch()
        write(app, "bare noget vrøvl")
        XCTAssertTrue(text(app, containing: "Vi kunne ikke få en kalenderpost").waitForExistence(timeout: 10))
        XCTAssertEqual(app.textViews["tell.box"].value as? String, "bare noget vrøvl")
    }

    /// Kept, it is listed the next time, and deleted from there.
    func testWhatIsKeptIsListedAndDeleted() {
        let app = launch()
        write(app, "Jeg rejser")
        let save = app.buttons["tell.save"]
        XCTAssertTrue(save.waitForExistence(timeout: 10))
        save.tap()
        XCTAssertTrue(app.navigationBars["Tilføj til kalender"].waitForNonExistence(timeout: 10))
        let again = launch()
        XCTAssertTrue(again.staticTexts["Det har du tilføjet"].waitForExistence(timeout: 10))
        let delete = again.buttons["Slet Rejse"]
        XCTAssertTrue(delete.exists)
        delete.tap()
        XCTAssertTrue(delete.waitForNonExistence(timeout: 10))
    }
}

/// Without the yes to the AI, the first description asks for it, and goes on once given.
final class TellConsentUITests: XCTestCase {
    override func setUp() async throws {
        continueAfterFailure = false
        var reset = URLRequest(url: URL(string: "\(testBackend)/reset")!)
        reset.httpMethod = "POST"
        reset.httpBody = Data(#"{"aiConsent":false}"#.utf8)
        _ = try await URLSession.shared.data(for: reset)
    }

    func testTheAiIsAskedForFirst() {
        let tell = TellUITests()
        let app = tell.launch()
        tell.write(app, "Jeg rejser")
        XCTAssertTrue(app.navigationBars["Slå AI til?"].waitForExistence(timeout: 10))
        shot("ai-consent")
        let next = app.buttons["aiConsent.next"]
        for _ in 0..<3 { next.tap() }
        XCTAssertTrue(next.label.contains("Tillad"), next.label)
        next.tap()
        XCTAssertTrue(app.staticTexts["Sådan forstod vi det"].waitForExistence(timeout: 10))
    }

    func testNotNowLeavesItAsItWas() {
        let tell = TellUITests()
        let app = tell.launch()
        tell.write(app, "Jeg rejser")
        XCTAssertTrue(app.navigationBars["Slå AI til?"].waitForExistence(timeout: 10))
        app.buttons["Ikke nu"].firstMatch.tap()
        XCTAssertTrue(app.navigationBars["Slå AI til?"].waitForNonExistence(timeout: 5))
        XCTAssertFalse(app.staticTexts["Sådan forstod vi det"].exists)
        XCTAssertEqual(app.textViews["tell.box"].value as? String, "Jeg rejser")
    }
}
