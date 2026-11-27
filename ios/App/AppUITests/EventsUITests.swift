import XCTest

/// Native Aftaler (#199) against the fake backend, at its fixed moment
/// (e2e/world.ts's NOW): Jonas's Brætspilsaften to answer, Mia's own
/// Julefrokost and Freja's Løbetur to come, Jonas's Fødselsdag over.
final class EventsUITests: XCTestCase {
    override func setUp() async throws {
        continueAfterFailure = false
        var reset = URLRequest(url: URL(string: "\(testBackend)/reset")!)
        reset.httpMethod = "POST"
        _ = try await URLSession.shared.data(for: reset)
    }

    private func launch(_ extra: [String] = []) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = extra + [
            "-casyBackend", testBackend,
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

    /// Someone else's new vote shows up by itself (#202): the app hears it on
    /// Realtime, the pulse has moved, and the list is fetched again.
    @MainActor func testSomeoneElsesVoteArrivesByItself() async throws {
        let app = launch(["-casyLive", "YES"])
        XCTAssertTrue(row(app, "Brætspilsaften").waitForExistence(timeout: 10))
        XCTAssertFalse(row(app, "Padel").exists)
        // Joined before the change, so it is heard rather than polled.
        try await Task.sleep(for: .seconds(2))
        var poke = URLRequest(url: URL(string: "\(testBackend)/someone")!)
        poke.httpMethod = "POST"
        _ = try await URLSession.shared.data(for: poke)
        XCTAssertTrue(row(app, "Padel").waitForExistence(timeout: 4))
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
        shot("dated-slice")
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

    /// With a primary calendar it says where, and goes straight in (#199).
    func testAnAgreedEventGoesIntoThePrimaryCalendar() {
        let app = launch()
        openEvent(app, "Løbetur", group: "Løbeklubben")
        XCTAssertTrue(app.staticTexts["Vi lægger den i Privat."].waitForExistence(timeout: 10))
        app.buttons["Tilføj til min kalender"].tap()
        XCTAssertTrue(app.buttons["Lagt i Privat"].waitForExistence(timeout: 10))
    }

    /// One already in says so, and can't be added twice.
    func testOneAlreadyInSaysWhere() {
        let app = launch()
        openEvent(app, "Julefrokost", group: "Fredagsbar")
        let added = app.buttons["Lagt i Privat"]
        XCTAssertTrue(added.waitForExistence(timeout: 10))
        XCTAssertFalse(added.isEnabled)
    }

    /// Your own day around it, opening the day view at a tap (#199).
    func testTheSliceOfYourDayOpensTheDay() {
        let app = launch()
        openEvent(app, "Løbetur", group: "Løbeklubben")
        let slice = app.buttons["Åbn dagen i din kalender"]
        _ = slice.waitForExistence(timeout: 10)
        if let shots = ProcessInfo.processInfo.environment["CASY_SHOTS"] {
            try? XCUIScreen.main.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: "\(shots)/dated.png"))
        }
        XCTAssertTrue(slice.exists)
        slice.tap()
        XCTAssertTrue(app.navigationBars["Løbeklubben"].waitForNonExistence(timeout: 10))
    }

    /// A vote's dates, each with your answer at its end, and the suggester's tools.
    func testYourOwnVoteShowsItsDatesAndTools() {
        let app = launch()
        openEvent(app, "Biograf", group: "Løbeklubben")
        let yes = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Jeg kan:")).firstMatch
        XCTAssertTrue(yes.waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Svarfrist")).firstMatch.exists)
        XCTAssertTrue(app.buttons["vote.settle"].exists)
        XCTAssertFalse(app.buttons["Rapportér aftalen"].exists)
    }

    /// Søg igen (#240, #264): the vote's own plan in a sheet (its name, no
    /// group or kind), Find dato lays the pile, the new dates are sent after
    /// the warning that everyone votes anew, and it closes back onto the vote.
    func testSearchingAVoteAgainSendsItNewDates() {
        let app = launch()
        openEvent(app, "Biograf", group: "Løbeklubben")
        let again = app.buttons["vote.searchAgain"]
        XCTAssertTrue(again.waitForExistence(timeout: 10))
        XCTAssertTrue(again.isEnabled)
        again.tap()
        XCTAssertTrue(app.navigationBars["Søg igen"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["plan.againName"].exists)
        XCTAssertFalse(app.buttons["plan.kind.trip"].exists)
        XCTAssertFalse(app.buttons["plan.group"].exists)
        let find = app.buttons["plan.find"]
        XCTAssertTrue(find.waitForExistence(timeout: 10))
        find.tap()
        let send = app.buttons["pile.send"]
        XCTAssertTrue(send.waitForExistence(timeout: 30), "the pile's dates")
        XCTAssertTrue(send.label.contains("nye"), send.label)
        // Pressable once the list has settled.
        let ready = expectation(for: NSPredicate(format: "isEnabled == true AND isHittable == true"), evaluatedWith: send)
        wait(for: [ready], timeout: 15)
        send.tap()
        let yes = app.buttons["confirm.yes"]
        XCTAssertTrue(yes.waitForExistence(timeout: 10), "everyone votes anew, said first")
        yes.tap()
        XCTAssertTrue(app.navigationBars["Løbeklubben"].waitForExistence(timeout: 20), "back on the vote")
        XCTAssertTrue(app.buttons["vote.searchAgain"].waitForExistence(timeout: 10))
    }

    /// A tap on the cross changes your answer for that date.
    func testChangingYourAnswerIsSaved() {
        let app = launch()
        openEvent(app, "Biograf", group: "Løbeklubben")
        let no = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Jeg kan ikke:")).firstMatch
        XCTAssertTrue(no.waitForExistence(timeout: 10))
        no.tap()
        let chosen = NSPredicate(format: "isSelected == true")
        expectation(for: chosen, evaluatedWith: no)
        waitForExpectations(timeout: 10)
    }

    /// A deadline picked from the sheet shows as a day and a time.
    func testADeadlineIsPicked() {
        let app = launch()
        openEvent(app, "Biograf", group: "Løbeklubben")
        let row = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Svarfrist")).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 10))
        row.tap()
        app.buttons["3 dage"].tap()
        let set = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@ AND label CONTAINS %@", "Svarfrist", "kl."))
            .firstMatch
        XCTAssertTrue(set.waitForExistence(timeout: 10))
    }

    /// Settling now is asked first, then the vote leaves its screen, decided.
    func testSettlingNowIsAskedFirst() {
        let app = launch()
        openEvent(app, "Biograf", group: "Løbeklubben")
        let settle = app.buttons["vote.settle"]
        XCTAssertTrue(settle.waitForExistence(timeout: 10))
        settle.tap()
        XCTAssertTrue(
            app.staticTexts["Afgør nu med de svar, der er kommet? Kan ingen dato vinde, vælger du."]
                .waitForExistence(timeout: 5))
        app.buttons.matching(NSPredicate(format: "label == %@ AND identifier != %@", "Afgør nu", "vote.settle"))
            .firstMatch.tap()
        XCTAssertTrue(app.navigationBars["Mine aftaler"].waitForExistence(timeout: 10))
    }
}
