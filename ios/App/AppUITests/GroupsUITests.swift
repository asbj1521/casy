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

    // MARK: A group's own screen

    private func openFriday() -> XCUIApplication {
        let app = openGroups()
        let friday = row(app, "Fredagsbar")
        XCTAssertTrue(friday.waitForExistence(timeout: 10))
        friday.tap()
        XCTAssertTrue(app.staticTexts["4 medlemmer · lavet sep. 2026"].waitForExistence(timeout: 10))
        return app
    }

    func testAGroupShowsWhoIsInItAndWhatItIsFor() {
        let app = openFriday()
        XCTAssertTrue(app.staticTexts["En øl efter arbejde, når det passer de fleste"].exists)
        XCTAssertTrue(app.staticTexts["Mia Jensen (dig)"].exists)
        for name in ["Jonas", "Sara", "Emil"] { XCTAssertTrue(app.staticTexts[name].exists, name) }
        app.buttons["Hvad kan medlemmerne se?"].tap()
        XCTAssertTrue(
            app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Alle i en gruppe kan se"))
                .firstMatch.waitForExistence(timeout: 10))
    }

    func testRenamingIsSavedAndShownAtOnce() {
        let app = openFriday()
        row(app, "Rediger gruppe").tap()
        let field = app.textFields["Gruppenavn"]
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        field.tap()
        field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: 20))
        field.typeText("Fredagsøl")
        app.buttons["Gem"].tap()
        XCTAssertTrue(app.staticTexts["Fredagsøl"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.textFields["Gruppenavn"].exists, "the sheet stayed open")
    }

    func testTimeForEachOtherIsASwitchThatSticks() {
        let app = openFriday()
        let toggle = app.switches.matching(NSPredicate(format: "label BEGINSWITH %@", "Tid til hinanden"))
            .firstMatch
        let list = app.collectionViews.firstMatch
        for _ in 0..<4 where !toggle.isHittable { list.swipeUp(velocity: .slow) }
        XCTAssertEqual(toggle.value as? String, "1")
        toggle.switches.firstMatch.tap()
        let off = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == '0'"), object: toggle)
        XCTAssertEqual(XCTWaiter.wait(for: [off], timeout: 10), .completed)
    }

    func testAReportCanBlockAndSaysThankYou() {
        let app = openFriday()
        let report = row(app, "Rapportér eller bloker")
        let list = app.collectionViews.firstMatch
        for _ in 0..<4 where !report.isHittable { list.swipeUp(velocity: .slow) }
        report.tap()
        XCTAssertTrue(app.navigationBars["Rapportér"].waitForExistence(timeout: 10))
        let send = app.buttons["Send"]
        XCTAssertFalse(send.isEnabled, "sent without a reason")
        app.buttons["Jonas"].tap()
        app.buttons["Spam eller reklame"].tap()
        XCTAssertTrue(app.switches.matching(NSPredicate(format: "label BEGINSWITH %@", "Bloker også Jonas"))
            .firstMatch.exists)
        send.tap()
        XCTAssertTrue(app.staticTexts["Tak. Vi kigger på det."].waitForExistence(timeout: 10))
        app.buttons["Luk"].tap()
        XCTAssertTrue(app.staticTexts["Mia Jensen (dig)"].waitForExistence(timeout: 10))
    }

    func testLeavingFromTheGroupGoesBackToTheList() {
        let app = openGroups()
        let running = row(app, "Løbeklubben")
        XCTAssertTrue(running.waitForExistence(timeout: 10))
        running.tap()
        let leave = row(app, "Forlad gruppe")
        XCTAssertTrue(leave.waitForExistence(timeout: 10))
        leave.tap()
        let confirm = app.buttons.matching(NSPredicate(format: "label == %@", "Forlad gruppe")).element(boundBy: 1)
        XCTAssertTrue(confirm.waitForExistence(timeout: 10))
        confirm.tap()
        XCTAssertTrue(app.navigationBars["Grupper"].waitForExistence(timeout: 10))
        let gone = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: running)
        XCTAssertEqual(XCTWaiter.wait(for: [gone], timeout: 10), .completed)
    }

    // MARK: Inviting and making a group

    private func openInvite() -> XCUIApplication {
        let app = openGroups()
        let running = row(app, "Løbeklubben")
        XCTAssertTrue(running.waitForExistence(timeout: 10))
        running.tap()
        let invite = row(app, "Invitér folk")
        XCTAssertTrue(invite.waitForExistence(timeout: 10))
        invite.tap()
        XCTAssertTrue(app.navigationBars["Invitér til Løbeklubben"].waitForExistence(timeout: 10))
        return app
    }

    func testPeopleFromYourGroupsAreTickedAndSent() {
        let app = openInvite()
        let jonas = row(app, "Jonas")
        XCTAssertTrue(jonas.waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Fra Fredagsbar"].exists)
        XCTAssertFalse(app.buttons["Send invitation"].exists, "a send button with nobody picked")
        jonas.tap()
        XCTAssertTrue(app.staticTexts["De bliver først medlemmer, når de selv siger ja."].waitForExistence(timeout: 10))
        app.buttons["Send invitation"].tap()
        XCTAssertTrue(app.staticTexts["Invitationerne er sendt."].waitForExistence(timeout: 10))
    }

    func testALinkIsMadeAndShownAsAQrCode() {
        let app = openInvite()
        row(app, "Lav et link").tap()
        XCTAssertTrue(row(app, "https://casy.app/join/test-invite-token").waitForExistence(timeout: 10))
        XCTAssertTrue(row(app, "Del link").exists)
        XCTAssertTrue(
            app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Alle med linket kan blive medlem"))
                .firstMatch.exists)
        row(app, "Vis QR-kode").tap()
        XCTAssertTrue(app.images["QR-kode til at blive medlem af Løbeklubben"].waitForExistence(timeout: 10))
    }

    func testAnEmailIsCheckedThenAdded() {
        let app = openInvite()
        row(app, "Med e-mail").tap()
        let field = app.textFields["Med e-mail"]
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        field.typeText("nope")
        app.buttons["Tilføj"].tap()
        XCTAssertTrue(app.staticTexts["Det ligner ikke en e-mailadresse."].waitForExistence(timeout: 10))
        field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: 4))
        field.typeText("ny@eksempel.dk")
        app.buttons["Tilføj"].tap()
        XCTAssertTrue(app.buttons["Fjern ny@eksempel.dk"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["Send invitation"].exists)
    }

    func testANewGroupIsMadeThenInvitedTo() {
        let app = openGroups()
        let make = row(app, "Lav en gruppe")
        XCTAssertTrue(make.waitForExistence(timeout: 10))
        make.tap()
        XCTAssertTrue(app.navigationBars["Ny gruppe"].waitForExistence(timeout: 10))
        let next = app.buttons["Næste"]
        XCTAssertFalse(next.isEnabled, "a group without a name")
        let name = app.textFields["Gruppenavn"]
        name.tap()
        name.typeText("Brætspil")
        next.tap()
        XCTAssertTrue(app.navigationBars["Invitér til Brætspil"].waitForExistence(timeout: 10))
        // The invite sheet's own Færdig: Grupper's under it has one too (design rule 11).
        app.navigationBars["Invitér til Brætspil"].buttons["Færdig"].tap()
        XCTAssertTrue(row(app, "Brætspil").waitForExistence(timeout: 10))
    }
}

