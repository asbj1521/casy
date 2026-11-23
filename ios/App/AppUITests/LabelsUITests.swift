import XCTest

/// The event labels made by the app itself (#282, LabelsWork): with
/// `-casySeedPhone` the app fills a "Casy test" calendar on this simulator and
/// the fake backend lists it as this phone's, so the app's labeller reads its
/// three titles, asks the fake calendar-label for them and keeps the labels:
/// Dine data then counts three on this phone.
final class LabelsUITests: XCTestCase {
    override func setUp() async throws {
        continueAfterFailure = false
        var reset = URLRequest(url: URL(string: "\(testBackend)/reset")!)
        reset.httpMethod = "POST"
        _ = try await URLSession.shared.data(for: reset)
    }

    func testTheAppLabelsThisPhonesEvents() {
        let app = XCUIApplication()
        app.launchArguments = [
            "-casyBackend", testBackend,
            "-casyOpenScreen", "profile",
            "-casyPushPermission", "granted",
            "-casyLang", "da",
            "-casySeedPhone", "YES",
        ]
        app.launch()
        allowCalendarAccess()
        XCTAssertTrue(app.navigationBars["Profil"].waitForExistence(timeout: 20))
        let row = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Dine data")).firstMatch
        // The row reads as one: "Mærkater på denne telefon, 3".
        let labels = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label BEGINSWITH %@", "Mærkater på denne telefon")).firstMatch
        var seen = ""
        // The count is read as Dine data opens: again, if the labels weren't made yet.
        for _ in 0..<4 {
            for _ in 0..<12 where !(row.exists && row.isHittable) { app.screenList.swipeUp(velocity: .slow) }
            row.tap()
            XCTAssertTrue(app.navigationBars["Dine data"].waitForExistence(timeout: 10))
            for _ in 0..<12 where !(labels.exists && labels.isHittable) { app.screenList.swipeUp(velocity: .slow) }
            seen = labels.exists ? labels.label : "no row"
            if seen.hasSuffix(" 3") { return }
            app.navigationBars["Dine data"].buttons.firstMatch.tap()
            sleep(2)
        }
        XCTFail("Dine data never counted the three labels: \(seen)")
    }

    /// iOS's question about the calendars, the first time on this simulator: full access.
    private func allowCalendarAccess() {
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let allow = springboard.buttons.matching(
            NSPredicate(format: "label CONTAINS[c] %@ OR label CONTAINS[c] %@", "fuld adgang", "Full Access")
        ).firstMatch
        if allow.waitForExistence(timeout: 8) { allow.tap() }
    }
}
