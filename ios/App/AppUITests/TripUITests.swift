import XCTest

/// The native trip sheet (#200), on the made-up trips `-casyTrip` gives: a
/// flight to Rome on 12 October and a train home on the 18th; the flight
/// alone, asking when you are back; and both, asking where home is. The test
/// launch answers for the page, as it would.
final class TripUITests: XCTestCase {
    private func launch(_ trip: String, title: String) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [
            "-casyBackend", testBackend,
            "-casyOpenScreen", "trip",
            "-casyTrip", trip,
            "-casyLang", "da",
            "-casyNow", "2026-10-07T08:00:00.000Z",
        ]
        app.launch()
        XCTAssertTrue(app.navigationBars[title].waitForExistence(timeout: 20))
        return app
    }

    private func text(_ app: XCUIApplication, containing words: String) -> XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", words)).firstMatch
    }

    /// The journeys and the time away; a yes keeps it open with the calendar button.
    func testATripIsAcceptedAndPutInTheCalendar() {
        let app = launch("trip", title: "Rejse til Rom")
        XCTAssertTrue(text(app, containing: "Fly: København til Rom").exists)
        XCTAssertTrue(text(app, containing: "Tog: Rom til København").exists)
        XCTAssertTrue(text(app, containing: "Du er væk fra").exists)
        shot("trip")
        app.buttons["trip.accept"].tap()
        let add = app.buttons["Læg i min kalender"]
        XCTAssertTrue(add.waitForExistence(timeout: 5))
        add.tap()
        XCTAssertTrue(text(app, containing: "Lagt i Kalender").waitForExistence(timeout: 5))
    }

    /// No closes the sheet.
    func testSayingNoCloses() {
        let app = launch("trip", title: "Rejse til Rom")
        app.buttons["Nej, det er ikke en rejse"].tap()
        XCTAssertTrue(app.navigationBars["Rejse til Rom"].waitForNonExistence(timeout: 10))
    }

    /// When you are back: a day picked on the month, said on the button, makes the trip.
    func testTheDayYouAreBack() {
        let app = launch("return", title: "Hvornår kommer du hjem fra Rom?")
        let confirm = app.buttons["trip.confirm"]
        XCTAssertFalse(confirm.isEnabled)
        let day = app.buttons["lørdag 17. oktober"]
        XCTAssertTrue(day.waitForExistence(timeout: 5))
        shot("trip-return")
        day.tap()
        XCTAssertTrue(confirm.label.contains("Hjemme"), confirm.label)
        confirm.tap()
        XCTAssertTrue(app.navigationBars["Rejse til Rom"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Læg i min kalender"].exists)
    }

    /// Where home is: a city, then the trip itself.
    func testWhereHomeIs() {
        let app = launch("home", title: "Hvor bor du?")
        app.buttons["København"].firstMatch.tap()
        XCTAssertTrue(app.navigationBars["Rejse til Rom"].waitForExistence(timeout: 5))
    }
}
