import XCTest

/// The native Planlæg sheet (#282), over the home page: the group, the time
/// as rows with their pickers, the months and how many must come. The fake
/// world's group Fredagsbar has four members.
final class PlanUITests: XCTestCase {
    private func launch() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [
            "-casyBackend", "http://localhost:4318",
            "-casyOpenScreen", "plan",
            "-casyLang", "da",
            "-casyNow", "2026-10-07T08:00:00.000Z",
        ]
        app.launch()
        XCTAssertTrue(app.navigationBars["Planlæg"].waitForExistence(timeout: 20))
        return app
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
        XCTAssertTrue(app.otherElements["plan.howMany"].waitForExistence(timeout: 15))
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
}
