import XCTest

/// The native home page (#201) on Mia's calendar from the fake backend, the
/// page's part played by the test launch (`-casyNativeHome`): a vote's
/// pencilled date on Wednesday 14 October, a starred Friday the 16th, and the
/// vote pill. A vote is answered here (#282); every other press is handed to the page, written down
/// (`home.lastAction`) for the test to read.
final class HomeUITests: XCTestCase {
    override func setUp() async throws {
        continueAfterFailure = false
        var reset = URLRequest(url: URL(string: "\(testBackend)/reset")!)
        reset.httpMethod = "POST"
        _ = try await URLSession.shared.data(for: reset)
    }

    private func launch(_ extra: [String] = []) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments =
            [
                "-casyBackend", testBackend,
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

    /// A starred day is the page's; a vote's date is answered here (#282).
    func testADayOfThePagesIsHandedToIt() {
        let app = launch()
        let starred = app.buttons["day.2026-10-16"]
        XCTAssertTrue(starred.waitForExistence(timeout: 10))
        starred.tap()
        XCTAssertEqual(pressed(app), "day 2026-10-16")
        XCTAssertFalse(app.buttons["day.back"].exists)
        app.buttons["day.2026-10-14"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["vote.panel"].waitForExistence(timeout: 5))
        XCTAssertEqual(pressed(app), "day 2026-10-16", "the vote's date isn't handed to the page")
    }

    /// The pill answers the soonest vote over the day view: a date answered
    /// goes on to the next, back steps to it again, Færdig puts the vote away
    /// and the pill with it.
    func testThePillAnswersTheVoteHere() {
        let app = launch()
        let pill = app.buttons["home.pill"]
        XCTAssertTrue(pill.waitForExistence(timeout: 10))
        pill.tap()
        let card = app.descendants(matching: .any)["vote.card"]
        XCTAssertTrue(card.waitForExistence(timeout: 5))
        XCTAssertTrue(card.label.contains("Dato 1 af 3"), card.label)
        XCTAssertTrue(app.buttons["week.2026-10-14"].isSelected)
        app.buttons["vote.accepted"].tap()
        let second = NSPredicate(format: "label CONTAINS %@", "Dato 2 af 3")
        expectation(for: second, evaluatedWith: app.descendants(matching: .any)["vote.card"])
        waitForExpectations(timeout: 5)
        XCTAssertTrue(app.buttons["week.2026-10-17"].waitForExistence(timeout: 5))
        expectation(for: NSPredicate(format: "isSelected == true"), evaluatedWith: app.buttons["week.2026-10-17"])
        waitForExpectations(timeout: 5)
        XCTAssertTrue(app.descendants(matching: .any)["vote.date.d-bg-2"].exists, "the date up, lit in its day")
        app.buttons["vote.back"].tap()
        let first = NSPredicate(format: "label CONTAINS %@", "Du svarede: Kan")
        expectation(for: first, evaluatedWith: app.descendants(matching: .any)["vote.card"])
        waitForExpectations(timeout: 5)
        app.buttons["vote.done"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["vote.panel"].waitForNonExistence(timeout: 5))
        XCTAssertTrue(title(app).waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["home.pill"].exists, "put away until the app is opened again")
    }

    /// A date the day before a critical exam of yours (#114): said on the
    /// card, and a yes is asked first.
    func testADateBeforeYourExamIsWarnedAndAskedFirst() {
        let app = launch(["-casyImportant", "YES"])
        let pill = app.buttons["home.pill"]
        XCTAssertTrue(pill.waitForExistence(timeout: 10))
        pill.tap()
        let card = app.descendants(matching: .any)["vote.card"]
        XCTAssertTrue(card.waitForExistence(timeout: 5))
        XCTAssertTrue(card.label.contains("Det ligner, at du har en eksamen dagen efter"), card.label)
        app.buttons["vote.accepted"].tap()
        let yes = app.buttons["confirm.yes"]
        XCTAssertTrue(yes.waitForExistence(timeout: 5), "a yes asked first")
        XCTAssertTrue(card.label.contains("Dato 1 af 3"), "not answered yet")
        yes.tap()
        expectation(for: NSPredicate(format: "label CONTAINS %@", "Dato 2 af 3"), evaluatedWith: card)
        waitForExpectations(timeout: 5)
    }

    /// The last date answered here: the page is told, for its notifications ask (#139).
    func testTheLastAnswerTellsThePage() {
        let app = launch()
        let pill = app.buttons["home.pill"]
        XCTAssertTrue(pill.waitForExistence(timeout: 10))
        pill.tap()
        XCTAssertTrue(app.descendants(matching: .any)["vote.card"].waitForExistence(timeout: 5))
        for _ in 0..<3 {
            let no = app.buttons["vote.declined"]
            XCTAssertTrue(no.waitForExistence(timeout: 5))
            no.tap()
        }
        let last = app.staticTexts["home.lastAction"]
        expectation(for: NSPredicate(format: "label == %@", "answered"), evaluatedWith: last)
        waitForExpectations(timeout: 10)
    }

    /// Every date answered: thanks, then back to the month by itself.
    func testTheLastAnswerSaysThanksAndGoesBack() {
        let app = launch()
        let pill = app.buttons["home.pill"]
        XCTAssertTrue(pill.waitForExistence(timeout: 10))
        pill.tap()
        for n in 1...3 {
            let card = app.descendants(matching: .any)["vote.card"]
            expectation(for: NSPredicate(format: "label CONTAINS %@", "Dato \(n) af 3"), evaluatedWith: card)
            waitForExpectations(timeout: 5)
            app.buttons[n == 2 ? "vote.maybe" : "vote.declined"].tap()
        }
        XCTAssertTrue(app.descendants(matching: .any)["vote.thanks"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.descendants(matching: .any)["vote.panel"].waitForNonExistence(timeout: 5))
        XCTAssertTrue(title(app).waitForExistence(timeout: 5))
    }

    /// A date agreed since this phone last looked is said over the month,
    /// then flies into its day; it is said once.
    func testAnAgreedDateIsSaidThenFliesIn() {
        let app = launch(["-casyAgreed", "ev-run"])
        let show = app.buttons["agreed.show"]
        XCTAssertTrue(show.waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Løbetur"].exists)
        show.tap()
        XCTAssertTrue(show.waitForNonExistence(timeout: 5))
        XCTAssertTrue(title(app).waitForExistence(timeout: 5))
        app.terminate()
        let again = launch()
        XCTAssertFalse(again.buttons["agreed.show"].waitForExistence(timeout: 4), "said once")
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
        // The web's DayRow sheet: the day as its title, Færdig to close (#281).
        let sheet = app.navigationBars["Torsdag 15. oktober"]
        XCTAssertTrue(sheet.waitForExistence(timeout: 5))
        XCTAssertTrue(app.descendants(matching: .any)["event.sheet"].staticTexts["Arbejde"].exists)
        shot("home-event")
        sheet.buttons["Færdig"].tap()
        XCTAssertTrue(sheet.waitForNonExistence(timeout: 5))
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

    /// A finger pressed on a date in the week row and dragged across it (a week
    /// turned by the drag): the app stays alive and answers (it froze, the
    /// hours' pager and the day chasing each other, 18 Nov 2026).
    func testDraggingAcrossTheWeekRowKeepsTheAppAlive() {
        // With the animations on, as on a phone: the freeze needed the animated scroll.
        let app = launch(["-casyMotion", "YES"])
        app.buttons["day.2026-10-15"].tap()
        let from = app.buttons["week.2026-10-15"]
        XCTAssertTrue(from.waitForExistence(timeout: 5))
        // Two days side by side, as when it froze: the pages step by two.
        app.buttons["day.span"].tap()
        from.press(forDuration: 0.2, thenDragTo: app.buttons["week.2026-10-18"])
        // The week before is in view, and the app still answers a press.
        XCTAssertTrue(app.buttons["week.2026-10-08"].waitForExistence(timeout: 5))
        // Slowly, a finger held and moved across the dates, both ways, a few times.
        for (a, b) in [("week.2026-10-08", "week.2026-10-05"), ("week.2026-10-15", "week.2026-10-18"),
                       ("week.2026-10-08", "week.2026-10-11"), ("week.2026-10-01", "week.2026-09-28")] {
            let start = app.buttons[a]
            XCTAssertTrue(start.waitForExistence(timeout: 5), a)
            start.press(forDuration: 0.6, thenDragTo: app.buttons[b], withVelocity: .slow, thenHoldForDuration: 0.4)
        }
        app.buttons["day.back"].tap()
        XCTAssertTrue(title(app).waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["day.back"].waitForNonExistence(timeout: 5))
    }

    /// Each button along the top and the bottom asks the page for its sheet.
    func testEveryButtonAsksThePage() {
        let app = launch()
        for (button, action) in [
            ("home.events", "events"), ("home.plan", "plan"), ("home.profile", "profile"),
            ("home.calendars", "calendars"), ("home.tell", "tell"),
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
