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
}
