import XCTest

/// Native Venner (#198) against the fake backend: Mia, in Fredagsbar and
/// Løbeklubben, and Tilde, a friend from a group since gone.
final class FriendsUITests: XCTestCase {
    override func setUp() async throws {
        continueAfterFailure = false
        var reset = URLRequest(url: URL(string: "\(testBackend)/reset")!)
        reset.httpMethod = "POST"
        reset.httpBody = Data(#"{"friends":[{"profileId":"p-past","name":"Tilde"}]}"#.utf8)
        _ = try await URLSession.shared.data(for: reset)
    }

    private func openProfile() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [
            "-casyBackend", testBackend,
            "-casyOpenScreen", "profile",
            "-casyPushPermission", "granted",
            "-casyLang", "da",
        ]
        app.launch()
        XCTAssertTrue(app.navigationBars["Profil"].waitForExistence(timeout: 20))
        return app
    }

    private func row(_ app: XCUIApplication, _ label: String) -> XCUIElement {
        app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", label)).firstMatch
    }

    private func openFriends() -> XCUIApplication {
        let app = openProfile()
        let friends = row(app, "Venner")
        XCTAssertTrue(friends.waitForExistence(timeout: 10))
        friends.tap()
        XCTAssertTrue(app.navigationBars["Venner"].waitForExistence(timeout: 10))
        return app
    }

    func testEveryoneShowsWhereFromAndOnlyAPastFriendCanBeRemoved() {
        let app = openFriends()
        XCTAssertTrue(app.staticTexts["Tilde"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Din ven"].exists)
        XCTAssertTrue(app.staticTexts["Jonas"].exists)
        XCTAssertFalse(app.buttons["Fjern Jonas"].exists, "someone from a group can be removed")
        app.buttons["Fjern Tilde"].tap()
        let confirm = app.buttons.matching(NSPredicate(format: "label == %@", "Fjern")).firstMatch
        XCTAssertTrue(confirm.waitForExistence(timeout: 10))
        confirm.tap()
        let gone = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "exists == false"), object: app.staticTexts["Tilde"])
        XCTAssertEqual(XCTWaiter.wait(for: [gone], timeout: 10), .completed)
    }

    func testAddingAFriendIsALinkWithoutEmailOrPeople() {
        let app = openFriends()
        row(app, "Tilføj en ven").tap()
        XCTAssertTrue(app.navigationBars["Tilføj en ven"].waitForExistence(timeout: 10))
        XCTAssertFalse(row(app, "Med e-mail").exists)
        XCTAssertFalse(app.staticTexts["Folk fra dine grupper"].exists)
        row(app, "Lav et link").tap()
        XCTAssertTrue(row(app, "https://casy.app/friend/test-friend-token").waitForExistence(timeout: 10))
    }

    /// Design rule 11: a screen pushed inside the sheet keeps its button top
    /// right, and it closes the whole sheet from any depth.
    func testFærdigClosesTheWholeSheetFromAPushedScreen() {
        let app = openFriends()
        let done = app.navigationBars["Venner"].buttons["Færdig"]
        XCTAssertTrue(done.exists)
        XCTAssertGreaterThan(done.frame.minX, app.frame.width / 2, "Færdig isn't on the right")
        done.tap()
        let closed = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "exists == false"), object: app.navigationBars["Venner"])
        XCTAssertEqual(XCTWaiter.wait(for: [closed], timeout: 10), .completed)
    }

    /// Design rule 11: a sheet's first screen has its one button top right too.
    func testASheetsOnlyTopButtonIsOnTheRight() {
        let app = openProfile()
        let done = app.navigationBars["Profil"].buttons["Færdig"]
        XCTAssertTrue(done.exists)
        XCTAssertGreaterThan(done.frame.minX, app.frame.width / 2, "Færdig isn't on the right")
        XCTAssertEqual(app.navigationBars["Profil"].buttons.count, 1, "more than one top button")
    }
}
