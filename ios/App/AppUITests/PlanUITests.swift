import XCTest

/// The native Planlæg sheet (#282), over the home page: the group, the time
/// as rows with their pickers, the months and how many must come. The fake
/// world's group Fredagsbar has four members.
final class PlanUITests: XCTestCase {
    /// A fresh world each test: a genvej one test saves is no other test's.
    override func setUp() async throws {
        var reset = URLRequest(url: URL(string: "\(testBackend)/reset")!)
        reset.httpMethod = "POST"
        _ = try await URLSession.shared.data(for: reset)
    }

    override func tearDown() {
        AnimationWait.ignore(false)
    }

    private func launch(_ extra: [String] = []) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = extra + [
            "-casyBackend", testBackend,
            "-casyOpenScreen", "plan",
            "-casyLang", "da",
            "-casyNow", "2026-10-07T08:00:00.000Z",
        ]
        app.launch()
        XCTAssertTrue(app.navigationBars["Planlæg"].waitForExistence(timeout: 20))
        return app
    }

    /// Begun from a starred day (#171): said at the top, its group picked, and
    /// the time any time in its free hours ("Fra 18:00"), for three hours, that day only.
    func testAStarredDayBeginsThePlan() {
        let app = launch(["-casyPrime", "g-friday"])
        XCTAssertTrue(
            app.descendants(matching: .any)["plan.prime"].waitForExistence(timeout: 10), "the starred day said first")
        XCTAssertTrue(
            app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", "Fredag 16. oktober"))
                .firstMatch.exists)
        XCTAssertTrue(app.staticTexts["Fredagsbar"].waitForExistence(timeout: 10))
        let time = app.buttons["plan.row.time"]
        XCTAssertTrue(time.waitForExistence(timeout: 5))
        XCTAssertTrue(time.label.contains("Fra 18:00, 3 t"), time.label)
    }

    /// The first meeting's time is the preset the test launch draws: 17:00 to 19:00.
    func testTheTimeRowsShowTheMeetingAndStepItsFlex() {
        let app = launch()
        XCTAssertTrue(app.buttons["plan.row.time"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["17:00 - 19:00"].exists)
        XCTAssertTrue(app.staticTexts["Nej"].exists)
        app.buttons["Mere plads at rykke"].tap()
        XCTAssertTrue(app.staticTexts["± 30 min"].waitForExistence(timeout: 5))
        app.buttons["Mindre plads at rykke"].tap()
        XCTAssertTrue(app.staticTexts["Nej"].waitForExistence(timeout: 5))
    }

    /// Tur / ferie swaps the meeting's rows for the trip's days and start day.
    func testATripAsksForDaysAndStartDay() {
        let app = launch()
        app.buttons["plan.kind.trip"].tap()
        XCTAssertTrue(app.staticTexts["Antal dage"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Starter"].exists)
        XCTAssertFalse(app.buttons["plan.row.time"].exists)
        app.buttons["Flere dage"].tap()
        XCTAssertTrue(app.staticTexts["4 dage"].waitForExistence(timeout: 5))
    }

    /// A month picked narrows the search to it; a tap on "Alle måneder" lifts it again.
    func testPickingAMonthAndAllMonths() {
        let app = launch()
        let november = app.buttons["plan.month.1"]
        XCTAssertTrue(november.waitForExistence(timeout: 10))
        november.tap()
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Tryk på de måneder")).firstMatch
            .waitForExistence(timeout: 5))
        app.buttons["Alle måneder"].tap()
        XCTAssertFalse(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Tryk på de måneder")).firstMatch.exists)
    }

    /// The days picker is a small panel off its row; a quick pick changes the row's value.
    func testDaysPickerChangesTheRow() {
        let app = launch()
        app.buttons["plan.row.days"].tap()
        let weekdays = app.buttons["Hverdage"]
        XCTAssertTrue(weekdays.waitForExistence(timeout: 5))
        weekdays.tap()
        XCTAssertTrue(app.staticTexts["Hverdage"].waitForExistence(timeout: 5))
    }

    /// Everyone is four of four: the slider says what the step buys.
    func testHowManyMustComeSliderShowsTheCounts() {
        let app = launch()
        let slider = app.otherElements["plan.howMany"]
        XCTAssertTrue(slider.waitForExistence(timeout: 15))
        let before = slider.value as? String ?? ""
        // It sits under the sheet's fold, behind "Find dato".
        app.buttons["plan.row.days"].swipeUp()
        // Held and dragged a step down: the knob is glass on the way (filmed),
        // and let go the count is the one under it.
        let knob = slider.coordinate(withNormalizedOffset: CGVector(dx: 0.93, dy: 0.6))
        let left = slider.coordinate(withNormalizedOffset: CGVector(dx: 0.25, dy: 0.6))
        knob.press(forDuration: 0.4, thenDragTo: left, withVelocity: .slow, thenHoldForDuration: 1)
        XCTAssertNotEqual(slider.value as? String ?? "", before, "a step down from everyone")
        // Settled back to the solid pill on its step (seen on film).
        _ = app.staticTexts["plan.never"].waitForExistence(timeout: 1)
    }

    /// Written and sent with return: the AI's plan fills the sheet in, its title the name.
    func testTheAiFillsTheSheetIn() {
        let app = launch()
        let field = app.textFields["plan.name"]
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["plan.mic"].waitForExistence(timeout: 10), "the microphone while it is empty")
        field.tap()
        field.typeText("møde om formiddagen på hverdage i oktober\n")
        XCTAssertTrue(app.staticTexts["10:00 - 12:00"].waitForExistence(timeout: 20))
        XCTAssertTrue(app.staticTexts["Hverdage"].waitForExistence(timeout: 10))
        XCTAssertEqual(field.value as? String, "Møde")
    }

    /// The AI's questions come first; answering the last closes them, and its answer is filled in.
    func testTheAiAsksItsQuestionsFirst() {
        let app = launch()
        let field = app.textFields["plan.name"]
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        field.tap()
        field.typeText("mange spørgsmål\n")
        XCTAssertTrue(app.staticTexts["Hvornår?"].waitForExistence(timeout: 20))
        app.buttons.matching(identifier: "Om aftenen").element(boundBy: 0).tap()
        app.buttons.matching(identifier: "Om aftenen").element(boundBy: 1).tap()
        app.buttons.matching(identifier: "Sent om aftenen").element(boundBy: 2).tap()
        XCTAssertTrue(app.staticTexts["Hvornår?"].waitForNonExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["21:00 - 23:00"].waitForExistence(timeout: 20))
    }

    /// Find dato: the pile, the dates checked, and sending them closes Planlæg.
    func testFindDateSendsTheVote() {
        let app = launch()
        let find = app.buttons["plan.find"]
        XCTAssertTrue(find.waitForExistence(timeout: 15))
        find.tap()
        let send = app.buttons["pile.send"]
        XCTAssertTrue(send.waitForExistence(timeout: 40), "the list never finished")
        XCTAssertTrue(app.staticTexts["De 5 bedste datoer"].exists)
        send.tap()
        XCTAssertTrue(app.descendants(matching: .any)["pile.screen"].waitForNonExistence(timeout: 15))
    }

    /// Ret planen goes back to the sheet, the plan as it was.
    func testChangeThePlanFromThePile() {
        let app = launch()
        app.buttons["plan.kind.trip"].tap()
        app.buttons["plan.find"].tap()
        let change = app.buttons["pile.change"]
        XCTAssertTrue(change.waitForExistence(timeout: 40))
        change.tap()
        XCTAssertTrue(app.staticTexts["Antal dage"].waitForExistence(timeout: 10), "the trip is kept")
    }

    /// Genveje: a new one saved from the plan, run from its square, and deleted again.
    func testAGenvejIsSavedRunAndDeleted() {
        let app = launch()
        let shortcuts = app.buttons["plan.shortcuts"]
        XCTAssertTrue(shortcuts.waitForExistence(timeout: 15))
        shortcuts.tap()
        XCTAssertTrue(app.staticTexts["Gem en plan, du bruger tit, og find en dato med ét tryk."].waitForExistence(timeout: 15))
        let add = app.buttons.matching(NSPredicate(format: "label == %@", "Ny genvej")).firstMatch
        if !add.waitForExistence(timeout: 5) { print(app.debugDescription) }
        add.tap()
        let name = app.textFields.firstMatch
        XCTAssertTrue(name.waitForExistence(timeout: 10))
        // From the keyboard on, iOS may leave the sheet's glass with endless
        // animations: each step waits for the app to be idle, not for those.
        AnimationWait.ignore(true)
        name.tap()
        name.typeText("Padel\n")
        app.buttons["editor.save"].tap()
        let square = app.buttons["shortcut.Padel"]
        XCTAssertTrue(square.waitForExistence(timeout: 15), "the new genvej's square")
        square.tap()
        let find = app.buttons["shortcuts.find"]
        XCTAssertTrue(find.waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Snarest"].exists, "Hvornår under it")
        find.tap()
        XCTAssertTrue(app.buttons["pile.change"].waitForExistence(timeout: 40), "the pile ran")
        app.buttons["pile.change"].tap()
        XCTAssertTrue(app.buttons["plan.shortcuts"].waitForExistence(timeout: 10))
        app.buttons["plan.shortcuts"].tap()
        let edit = app.buttons["Ret Padel"]
        XCTAssertTrue(edit.waitForExistence(timeout: 15))
        edit.tap()
        let remove = app.buttons["editor.remove"]
        if !remove.waitForExistence(timeout: 10) { print(app.debugDescription) }
        remove.tap()
        let confirm = app.buttons["confirm.yes"]
        XCTAssertTrue(confirm.waitForExistence(timeout: 5))
        confirm.tap()
        XCTAssertTrue(app.buttons["shortcut.Padel"].waitForNonExistence(timeout: 15))
    }
}
