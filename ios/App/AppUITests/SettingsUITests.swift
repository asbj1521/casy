import XCTest

/// Native Indstillinger, signed in against the fake backend (scripts/native/ui-tests.sh).
final class SettingsUITests: XCTestCase {
    private func launch(push: String = "granted", lang: String = "da") -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [
            "-casyBackend", "http://localhost:4318",
            "-casyOpenScreen", "settings",
            "-casyPushPermission", push,
            "-casyLang", lang,
        ]
        app.launch()
        XCTAssertTrue(
            app.navigationBars[lang == "da" ? "Indstillinger" : "Settings"]
                .waitForExistence(timeout: 20))
        return app
    }

    private func toggle(_ app: XCUIApplication, _ label: String) -> XCUIElement {
        let element = app.switches[label].firstMatch
        let list = app.collectionViews.firstMatch
        for _ in 0..<6 where !(element.exists && element.isHittable) {
            list.swipeUp(velocity: .slow)
        }
        return element
    }

    /// Taps the switch at the row's end once the list has truly stopped: a tap
    /// on a list still gliding only stops it.
    private func flip(_ row: XCUIElement) {
        var still = 0
        var last = row.frame
        for _ in 0..<40 where still < 3 {
            usleep(250_000)
            still = row.frame == last ? still + 1 : 0
            last = row.frame
        }
        XCTAssertEqual(still, 3, "the list never stopped moving")
        XCTAssertTrue(row.isHittable)
        row.coordinate(withNormalizedOffset: CGVector(dx: 0.93, dy: 0.5)).tap()
    }

    private func isOn(_ element: XCUIElement) -> Bool { "\(element.value ?? "")" == "1" }

    private func waitUntil(
        _ element: XCUIElement, isOn expected: Bool, within seconds: TimeInterval
    ) -> Bool {
        let predicate = NSPredicate { _, _ in self.isOn(element) == expected }
        let waited = XCTNSPredicateExpectation(predicate: predicate, object: nil)
        return XCTWaiter.wait(for: [waited], timeout: seconds) == .completed
    }

    /// The section once never appeared: nothing started the check with iOS.
    func testNotificationsShowEveryKindOnceAllowed() {
        let app = launch()
        for label in [
            "Nogen foreslår datoer til dig", "Datoen er fundet",
            "Datoen ændres, eller aftalen aflyses", "Du bliver inviteret til en gruppe",
            "Svarfristen nærmer sig",
        ] {
            let row = toggle(app, label)
            XCTAssertTrue(row.waitForExistence(timeout: 10), label)
        }
    }

    /// A switch moves at once, while the fake server takes 8 seconds, and
    /// the save is really there after a fresh start.
    func testASwitchMovesAtOnceAndIsSaved() {
        let label = "Svarfristen nærmer sig"
        var app = launch()
        var row = toggle(app, label)
        XCTAssertTrue(row.waitForExistence(timeout: 10))
        let before = isOn(row)

        flip(row)
        // Well inside the fake server's 8 seconds: this is the switch alone.
        XCTAssertTrue(waitUntil(row, isOn: !before, within: 4), "it waited for the server")
        // Past the fake server's pause, so the save has landed.
        sleep(10)

        app.terminate()
        app = launch()
        row = toggle(app, label)
        XCTAssertTrue(row.waitForExistence(timeout: 10))
        XCTAssertTrue(waitUntil(row, isOn: !before, within: 5), "the save didn't stick")

        // Back as it was, for the other tests.
        flip(row)
        sleep(10)
    }

    func testNotAskedYetOffersToTurnThemOn() {
        let app = launch(push: "prompt")
        XCTAssertTrue(app.staticTexts["Slå notifikationer til"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.switches["Datoen er fundet"].exists)
    }

    func testRefusedSaysWhereToUndoIt() {
        let app = launch(push: "denied")
        XCTAssertTrue(
            app.staticTexts["Slå dem til under Casy i iPhones Indstillinger."]
                .waitForExistence(timeout: 10))
    }

    func testTheScreenSpeaksCasysLanguage() {
        let app = launch(lang: "en")
        XCTAssertTrue(app.staticTexts["Appearance"].waitForExistence(timeout: 10))
    }
}
