import XCTest

/// Native Slet konto (#198) against the fake backend.
final class DeleteAccountUITests: XCTestCase {
    func testTheWordMustBeTypedBeforeTheAccountGoes() {
        let app = XCUIApplication()
        app.launchArguments = [
            "-casyBackend", "http://localhost:4318",
            "-casyOpenScreen", "profile",
            "-casyPushPermission", "granted",
            "-casyLang", "da",
        ]
        app.launch()
        XCTAssertTrue(app.navigationBars["Profil"].waitForExistence(timeout: 20))
        let row = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Slet konto")).firstMatch
        let list = app.collectionViews.firstMatch
        for _ in 0..<6 where !(row.exists && row.isHittable) { list.swipeUp(velocity: .slow) }
        row.tap()
        XCTAssertTrue(app.navigationBars["Slet konto"].waitForExistence(timeout: 10))

        let delete = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Slet kontoen for altid"))
            .firstMatch
        XCTAssertTrue(delete.exists)
        XCTAssertFalse(delete.isEnabled, "deletable before the word is typed")
        let field = app.textFields.firstMatch
        field.tap()
        field.typeText("slet")
        XCTAssertTrue(delete.isEnabled, "the word typed in lower case isn't taken")
        delete.tap()
        // Gone: the sheet closes, and the page signs out.
        let closed = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "exists == false"), object: app.navigationBars["Slet konto"])
        XCTAssertEqual(XCTWaiter.wait(for: [closed], timeout: 10), .completed)
    }
}
