import XCTest

/// Native Dine data (#198) against the fake backend, where Mia has said yes to the AI.
final class MyDataUITests: XCTestCase {
    override func setUp() async throws {
        continueAfterFailure = false
        var reset = URLRequest(url: URL(string: "http://localhost:4318/reset")!)
        reset.httpMethod = "POST"
        _ = try await URLSession.shared.data(for: reset)
    }

    private func openMyData() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [
            "-casyBackend", "http://localhost:4318",
            "-casyOpenScreen", "profile",
            "-casyPushPermission", "granted",
            "-casyLang", "da",
        ]
        app.launch()
        XCTAssertTrue(app.navigationBars["Profil"].waitForExistence(timeout: 20))
        let row = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Dine data")).firstMatch
        scroll(app, to: row)
        row.tap()
        XCTAssertTrue(app.navigationBars["Dine data"].waitForExistence(timeout: 10))
        return app
    }

    private func scroll(_ app: XCUIApplication, to element: XCUIElement) {
        let list = app.collectionViews.firstMatch
        for _ in 0..<12 where !(element.exists && element.isHittable) { list.swipeUp(velocity: .slow) }
    }

    func testEverythingKeptIsListedInThePolicysOrder() {
        let app = openMyData()
        XCTAssertTrue(app.staticTexts["Din konto"].waitForExistence(timeout: 10))
        for header in ["Forbundne kalendere", "Optagede tidsrum", "Grupper", "Foreslåede aftaler", "AI"] {
            let text = app.staticTexts[header]
            scroll(app, to: text)
            XCTAssertTrue(text.exists, header)
        }
        let copy = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Hent en kopi")).firstMatch
        scroll(app, to: copy)
        XCTAssertTrue(copy.exists)
    }

    func testTurningTheAiOffAsksFirstAndThenMovesTheSwitchToTheTop() {
        let app = openMyData()
        let ai = app.switches.matching(NSPredicate(format: "label BEGINSWITH %@", "AI")).firstMatch
        scroll(app, to: ai)
        XCTAssertEqual(ai.value as? String, "1")
        ai.switches.firstMatch.tap()
        let off = app.buttons["Slå fra"]
        XCTAssertTrue(off.waitForExistence(timeout: 10), "turned off without asking")
        off.tap()
        // Off, the switch moves to the top of the list, which a list only draws on screen.
        sleep(3)
        let list = app.collectionViews.firstMatch
        for _ in 0..<6 { list.swipeDown(velocity: .fast) }
        let top = app.switches.matching(NSPredicate(format: "label BEGINSWITH %@", "AI")).firstMatch
        XCTAssertTrue(top.waitForExistence(timeout: 10))
        XCTAssertEqual(top.value as? String, "0")
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Slået til sender vi"))
            .firstMatch.exists, "the switch didn't move to the top with what it means")
    }

    func testACopyIsHandedToTheShareSheet() {
        let app = openMyData()
        let copy = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Hent en kopi")).firstMatch
        scroll(app, to: copy)
        copy.tap()
        XCTAssertTrue(app.otherElements["ActivityListView"].waitForExistence(timeout: 15), "no share sheet")
    }
}
