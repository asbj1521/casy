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
}
