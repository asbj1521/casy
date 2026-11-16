import XCTest

/// The native home page (#201) on Mia's calendar from the fake backend, the
/// page's part played by the test launch (`-casyNativeHome`): a vote's
/// pencilled date on Wednesday 14 October, a starred Friday the 16th, and the
/// vote pill. Each press is handed to the page; here it is written down
/// (`home.lastAction`) for the test to read.
final class HomeUITests: XCTestCase {
    override func setUp() async throws {
        continueAfterFailure = false
        var reset = URLRequest(url: URL(string: "http://localhost:4318/reset")!)
        reset.httpMethod = "POST"
        _ = try await URLSession.shared.data(for: reset)
    }

    private func launch(_ extra: [String] = []) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments =
            [
                "-casyBackend", "http://localhost:4318",
                "-casyNativeHome", "YES",
                "-casyLang", "da",
                "-casyNow", "2026-10-07T08:00:00.000Z",
            ] + extra
        app.launch()
        XCTAssertTrue(title(app).waitForExistence(timeout: 20))
        return app
    }

    private func title(_ app: XCUIApplication) -> XCUIElement { app.staticTexts["home.title"] }

    private func pressed(_ app: XCUIApplication) -> String {
        app.staticTexts["home.lastAction"].label
    }

    private func text(_ app: XCUIApplication, containing words: String) -> XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", words)).firstMatch
    }

    /// October, with Mia's calendars as chips, the vote's date pencilled in and the holidays.
    func testTheMonthShowsTheCalendar() {
        let app = launch()
        XCTAssertEqual(title(app).label, "Oktober")
        XCTAssertTrue(text(app, containing: "Fredagsbar").waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["day.2026-10-14"].exists)
        XCTAssertTrue(app.buttons["day.2026-10-16"].label.contains("Tid til hinanden"))
        shot("home")
    }

    /// In dark, as the page's own dark month.
    func testTheMonthInDark() {
        let app = launch(["-casyTheme", "dark", "-casy.appearance", "dark"])
        XCTAssertTrue(text(app, containing: "Fredagsbar").waitForExistence(timeout: 10))
        shot("home-dark")
    }

    /// A day with something of the page's on it is the page's: a vote's date, a starred day.
    func testADayOfThePagesIsHandedToIt() {
        let app = launch()
        let vote = app.buttons["day.2026-10-14"]
        XCTAssertTrue(vote.waitForExistence(timeout: 10))
        vote.tap()
        XCTAssertEqual(pressed(app), "day 2026-10-14")
        app.buttons["day.2026-10-16"].tap()
        XCTAssertEqual(pressed(app), "day 2026-10-16")
        XCTAssertFalse(app.buttons["day.back"].exists)
    }

    /// Any other day zooms into the day view: its hours, its events, and back.
    func testADayOpensInTheDayView() {
        let app = launch()
        let day = app.buttons["day.2026-10-15"]
        XCTAssertTrue(day.waitForExistence(timeout: 10))
        day.tap()
        XCTAssertTrue(app.buttons["day.back"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.otherElements["column.2026-10-15"].exists)
        XCTAssertTrue(app.buttons["week.2026-10-15"].isSelected)
        shot("home-day")
        // Mia's Arbejde, opened in its sheet.
        let work = app.otherElements["column.2026-10-15"].buttons
            .matching(NSPredicate(format: "label BEGINSWITH %@", "Arbejde")).firstMatch
        XCTAssertTrue(work.waitForExistence(timeout: 5))
        work.tap()
        XCTAssertTrue(app.navigationBars["Arbejde"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Torsdag 15. oktober"].exists)
        shot("home-event")
        app.buttons["Luk"].tap()
        XCTAssertTrue(app.navigationBars["Arbejde"].waitForNonExistence(timeout: 5))
        app.buttons["day.back"].tap()
        XCTAssertTrue(app.buttons["day.back"].waitForNonExistence(timeout: 5))
        XCTAssertTrue(title(app).exists)
        XCTAssertEqual(pressed(app), "")
    }

    /// A swipe turns the day, the week row a week; two days side by side; I dag.
    func testMovingThroughTheDays() {
        let app = launch()
        app.buttons["day.2026-10-15"].tap()
        let hours = app.scrollViews["day.hours"]
        XCTAssertTrue(hours.waitForExistence(timeout: 5))
        hours.swipeLeft()
        XCTAssertTrue(app.buttons["week.2026-10-16"].waitForExistence(timeout: 5))
        let picked = NSPredicate(format: "isSelected == true")
        expectation(for: picked, evaluatedWith: app.buttons["week.2026-10-16"])
        waitForExpectations(timeout: 5)
        app.buttons["week.2026-10-12"].tap()
        expectation(for: picked, evaluatedWith: app.buttons["week.2026-10-12"])
        waitForExpectations(timeout: 5)
        app.buttons["day.span"].tap()
        XCTAssertTrue(app.otherElements["column.2026-10-13"].waitForExistence(timeout: 5))
        app.buttons["day.span"].tap()
        app.buttons["day.today"].tap()
        expectation(for: picked, evaluatedWith: app.buttons["week.2026-10-07"])
        waitForExpectations(timeout: 5)
    }

    /// Each button along the top and the bottom asks the page for its sheet.
    func testEveryButtonAsksThePage() {
        let app = launch()
        for (button, action) in [
            ("home.events", "events"), ("home.plan", "plan"), ("home.profile", "profile"),
            ("home.calendars", "calendars"), ("home.tell", "tell"), ("home.pill", "pill"),
        ] {
            let b = app.buttons[button]
            XCTAssertTrue(b.waitForExistence(timeout: 5), button)
            b.tap()
            XCTAssertEqual(pressed(app), action, button)
        }
        XCTAssertTrue(app.buttons["home.pill"].label.contains("Svar på Fredagsbar"))
    }

    /// The title follows the months scrolling under it; I dag glides back.
    func testTheTitleFollowsTheScrollAndTodayComesBack() {
        let app = launch()
        let months = app.scrollViews["home.months"]
        for _ in 0..<4 { months.swipeUp() }
        XCTAssertNotEqual(title(app).label, "Oktober")
        app.buttons["home.today"].tap()
        let back = NSPredicate(format: "label == %@", "Oktober")
        expectation(for: back, evaluatedWith: title(app))
        waitForExpectations(timeout: 5)
    }
}
