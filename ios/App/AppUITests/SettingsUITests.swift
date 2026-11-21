import XCTest

/// Native Indstillinger, signed in against the fake backend (scripts/native/ui-tests.sh).
final class SettingsUITests: XCTestCase {
    /// Each test finds the world as it was: one saves a notification switch.
    override func setUp() async throws {
        var reset = URLRequest(url: URL(string: "\(testBackend)/reset")!)
        reset.httpMethod = "POST"
        _ = try await URLSession.shared.data(for: reset)
    }

    private func launch(push: String = "granted", lang: String = "da") -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [
            "-casyBackend", testBackend,
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
        for _ in 0..<6 where !(element.exists && element.isHittable) {
            app.screenList.swipeUp(velocity: .slow)
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
            "Du mangler at svare",
        ] {
            let row = toggle(app, label)
            XCTAssertTrue(row.waitForExistence(timeout: 10), label)
        }
    }

    /// A switch moves at once, while the fake server takes 8 seconds, and
    /// the save is really there after a fresh start.
    func testASwitchMovesAtOnceAndIsSaved() {
        let label = "Du mangler at svare"
        var app = launch()
        var row = toggle(app, label)
        XCTAssertTrue(row.waitForExistence(timeout: 10))
        let before = isOn(row)

        flip(row)
        // Well inside the fake server's 3 seconds: this is the switch alone.
        XCTAssertTrue(waitUntil(row, isOn: !before, within: 2), "it waited for the server")
        // Past the fake server's pause, so the save has landed.
        sleep(4)

        app.terminate()
        app = launch()
        row = toggle(app, label)
        XCTAssertTrue(row.waitForExistence(timeout: 10))
        XCTAssertTrue(waitUntil(row, isOn: !before, within: 5), "the save didn't stick")
        // The next test starts from a fresh world (setUp), so nothing is put back.
    }

    func testNotAskedYetOffersToTurnThemOn() {
        let app = launch(push: "prompt")
        XCTAssertTrue(app.staticTexts["Slå notifikationer til"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.switches["Datoen er fundet"].exists)
    }

    func testRefusedSaysWhereToUndoIt() {
        let app = launch(push: "denied")
        XCTAssertTrue(
            app.staticTexts["Slå dem til under Find en dag i iPhones Indstillinger."]
                .waitForExistence(timeout: 10))
    }

    func testTheScreenSpeaksCasysLanguage() {
        let app = launch(lang: "en")
        XCTAssertTrue(app.staticTexts["Appearance"].waitForExistence(timeout: 10))
    }
}
