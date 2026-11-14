import XCTest

/// Native Grupper and an invitation (#198), signed in against the fake backend
/// (scripts/native/ui-tests.sh): Mia, in Fredagsbar (hers) and Løbeklubben
/// (Freja's), invited by Sara to Badminton.
final class GroupsUITests: XCTestCase {
    override func setUp() async throws {
        continueAfterFailure = false
        // Each test finds the world as it was: some leave groups or answer.
        var reset = URLRequest(url: URL(string: "http://localhost:4318/reset")!)
        reset.httpMethod = "POST"
        _ = try await URLSession.shared.data(for: reset)
    }

    private func openGroups() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [
            "-casyBackend", "http://localhost:4318",
            "-casyOpenScreen", "profile",
            "-casyPushPermission", "granted",
            "-casyLang", "da",
        ]
        app.launch()
        XCTAssertTrue(app.navigationBars["Profil"].waitForExistence(timeout: 20))
        let groups = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Grupper"))
            .firstMatch
        XCTAssertTrue(groups.waitForExistence(timeout: 10))
        groups.tap()
        XCTAssertTrue(app.navigationBars["Grupper"].waitForExistence(timeout: 10))
        return app
    }

    private func row(_ app: XCUIApplication, _ label: String) -> XCUIElement {
        app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", label)).firstMatch
    }

    func testShowsTheInvitationThenYourGroupsWithYouFirst() {
        let app = openGroups()
        XCTAssertTrue(app.staticTexts["INVITATIONER"].waitForExistence(timeout: 10)
            || app.staticTexts["Invitationer"].exists)
        XCTAssertTrue(app.staticTexts["Sara · 5 medlemmer"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Dig, Jonas, Sara, Emil"].exists)
        XCTAssertTrue(app.staticTexts["Dig, Freja, Oliver"].exists)
        XCTAssertTrue(row(app, "Lav en gruppe").exists)
    }

    func testSayingNoThanksGoesBackAndTheInvitationIsGone() {
        let app = openGroups()
        let badminton = row(app, "Badminton")
        XCTAssertTrue(badminton.waitForExistence(timeout: 10))
        badminton.tap()
        XCTAssertTrue(app.staticTexts["Sara har inviteret dig til"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["Bliv medlem"].exists)
        app.buttons["Nej tak"].tap()
        XCTAssertTrue(app.navigationBars["Grupper"].waitForExistence(timeout: 10))
        let gone = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "exists == false"), object: badminton)
        XCTAssertEqual(XCTWaiter.wait(for: [gone], timeout: 10), .completed)
    }

    func testBlockingTheSenderIsAskedFirst() {
        let app = openGroups()
        let badminton = row(app, "Badminton")
        XCTAssertTrue(badminton.waitForExistence(timeout: 10))
        badminton.tap()
        let about = app.buttons["Om invitationen"]
        XCTAssertTrue(about.waitForExistence(timeout: 10))
        about.tap()
        let block = app.buttons["Bloker afsenderen"]
        XCTAssertTrue(block.waitForExistence(timeout: 10))
        block.tap()
        let confirm = app.buttons["Bloker"]
        XCTAssertTrue(confirm.waitForExistence(timeout: 10))
        confirm.tap()
        XCTAssertTrue(app.navigationBars["Grupper"].waitForExistence(timeout: 10))
    }

    func testLeavingSomeoneElsesGroupIsASwipeWithNoQuestion() {
        let app = openGroups()
        let running = row(app, "Løbeklubben")
        XCTAssertTrue(running.waitForExistence(timeout: 10))
        running.swipeLeft()
        app.buttons["Forlad"].tap()
        let gone = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "exists == false"), object: running)
        XCTAssertEqual(XCTWaiter.wait(for: [gone], timeout: 10), .completed)
    }

    func testDeletingYourOwnGroupForEveryoneIsAskedFirst() {
        let app = openGroups()
        let friday = row(app, "Fredagsbar")
        XCTAssertTrue(friday.waitForExistence(timeout: 10))
        friday.swipeLeft()
        app.buttons["Slet"].firstMatch.tap()
        // The question names the group and how many lose it.
        XCTAssertTrue(
            app.staticTexts["Slet \"Fredagsbar\" for alle? Alle 4 medlemmer mister adgangen med det samme."]
                .waitForExistence(timeout: 10))
        // iOS 26 shows the question as a popover with no Annuller: a tap
        // outside it is the no. Earlier iOS has the button.
        let cancel = app.buttons["Annuller"].firstMatch
        if cancel.exists {
            cancel.tap()
        } else {
            app.navigationBars["Grupper"].staticTexts["Grupper"].tap()
        }
        sleep(2)
        XCTAssertTrue(friday.exists, "cancelling deleted it anyway")
    }
}
