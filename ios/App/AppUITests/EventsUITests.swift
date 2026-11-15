import XCTest

/// Native Aftaler (#199) against the fake backend, at its fixed moment
/// (e2e/world.ts's NOW): Jonas's Brætspilsaften to answer, Mia's own
/// Julefrokost and Freja's Løbetur to come, Jonas's Fødselsdag over.
final class EventsUITests: XCTestCase {
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
            "-casyOpenScreen", "events",
            "-casyPushPermission", "granted",
            "-casyLang", "da",
            "-casyNow", "2026-10-07T08:00:00.000Z",
        ]
        app.launch()
        XCTAssertTrue(app.navigationBars["Mine aftaler"].waitForExistence(timeout: 20))
        return app
    }

    private func row(_ app: XCUIApplication, _ title: String) -> XCUIElement {
        app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", title)).firstMatch
    }

    /// What needs you, what is to come and what is over, each with its group.
    func testTheRowsAreGroupedByWhatTheyNeed() {
        let app = launch()
        XCTAssertTrue(app.staticTexts["Svar nu"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Kommende"].exists)
        let vote = row(app, "Brætspilsaften")
        XCTAssertTrue(vote.exists)
        XCTAssertTrue(vote.label.contains("Fredagsbar") && vote.label.contains("Svar"), vote.label)
        XCTAssertTrue(row(app, "Julefrokost").exists)
        XCTAssertTrue(row(app, "Løbetur").exists)
        // A cancelled event is in no group at all.
        XCTAssertFalse(app.staticTexts["Aflyst"].exists)
    }

    /// Your own event is cancelled for everyone, so it is asked first.
    func testCancellingYourOwnIsAskedFirst() {
        let app = launch()
        let party = row(app, "Julefrokost")
        XCTAssertTrue(party.waitForExistence(timeout: 10))
        party.swipeLeft()
        app.buttons["Aflys"].tap()
        XCTAssertTrue(app.staticTexts["Aflys aftalen for alle?"].waitForExistence(timeout: 5))
        app.buttons["Aflys aftale"].tap()
        XCTAssertTrue(party.waitForNonExistence(timeout: 10))
    }

    /// Someone else's goes only for you: left at the press.
    func testLeavingSomeoneElsesIsAtOnce() {
        let app = launch()
        let run = row(app, "Løbetur")
        XCTAssertTrue(run.waitForExistence(timeout: 10))
        run.swipeLeft()
        app.buttons["Forlad"].tap()
        XCTAssertTrue(run.waitForNonExistence(timeout: 10))
    }

    /// A vote to answer is answered on the home page: the sheet closes for it.
    func testAVoteToAnswerHandsOverToTheHomePage() {
        let app = launch()
        let vote = row(app, "Brætspilsaften")
        XCTAssertTrue(vote.waitForExistence(timeout: 10))
        vote.tap()
        XCTAssertTrue(app.navigationBars["Mine aftaler"].waitForNonExistence(timeout: 10))
    }

    private func openEvent(_ app: XCUIApplication, _ title: String, group: String) {
        let target = row(app, title)
        XCTAssertTrue(target.waitForExistence(timeout: 10))
        target.tap()
        XCTAssertTrue(app.navigationBars[group].waitForExistence(timeout: 10))
    }

    /// An agreed event says what and when, and who is coming, the suggester starred.
    func testAnAgreedEventShowsWhatWhenAndWho() {
        let app = launch()
        openEvent(app, "Løbetur", group: "Løbeklubben")
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Løbetur")).firstMatch.exists)
        let freja = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label BEGINSWITH %@", "Freja:")).firstMatch
        XCTAssertTrue(freja.exists)
        XCTAssertTrue(freja.label.contains("Foreslået af Freja"), freja.label)
        XCTAssertTrue(app.buttons["Rapportér aftalen"].exists)
        XCTAssertTrue(app.buttons["Forlad aftale"].exists)
    }

    /// Your own has no report, and cancelling it is asked first.
    func testYourOwnIsCancelledFromItsScreenAfterAsking() {
        let app = launch()
        openEvent(app, "Julefrokost", group: "Fredagsbar")
        XCTAssertFalse(app.buttons["Rapportér aftalen"].exists)
        app.buttons["dated.exit"].tap()
        XCTAssertTrue(app.staticTexts["Aflys aftalen for alle?"].waitForExistence(timeout: 5))
        app.buttons.matching(NSPredicate(format: "label == %@ AND identifier != %@", "Aflys aftale", "dated.exit"))
            .firstMatch.tap()
        XCTAssertTrue(app.navigationBars["Mine aftaler"].waitForExistence(timeout: 10))
        XCTAssertTrue(row(app, "Julefrokost").waitForNonExistence(timeout: 10))
    }

    /// Reporting an event is the report sheet with only the event to choose.
    func testReportingAnEventSaysThankYou() {
        let app = launch()
        openEvent(app, "Løbetur", group: "Løbeklubben")
        app.buttons["Rapportér aftalen"].tap()
        let spam = app.buttons["Spam eller reklame"]
        XCTAssertTrue(spam.waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["Hvad drejer det sig om?"].exists, "only one thing to report")
        spam.tap()
        app.buttons["Send"].tap()
        XCTAssertTrue(app.staticTexts["Tak. Vi kigger på det."].waitForExistence(timeout: 10))
    }
}
