import XCTest

/// Native Profil, signed in against the fake backend (scripts/native/ui-tests.sh).
final class ProfileUITests: XCTestCase {
    private func launch() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [
            "-casyTestPicture", "YES",
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
        // BEGINSWITH: a row's badge is part of what VoiceOver reads ("Grupper, 1").
        let element = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", label))
            .firstMatch
        for _ in 0..<6 where !(element.exists && element.isHittable) {
            app.screenList.swipeUp(velocity: .slow)
        }
        return element
    }

    func testShowsEveryRow() {
        let app = launch()
        // The rows on screen first, then one quick swipe for the rest: a list
        // only draws what is on screen, so a row not there yet is further down.
        for label in [
            "Grupper", "Venner", "Log ind og sikkerhed", "Send feedback", "Del appen", "Dine data",
            "Hjælp og kontakt", "Sådan virker det", "Vilkår", "Privatliv", "Log ud", "Slet konto",
        ] {
            let element = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", label)).firstMatch
            if !element.waitForExistence(timeout: 3) { app.screenList.swipeUp(velocity: .fast) }
            XCTAssertTrue(element.waitForExistence(timeout: 5), label)
        }
    }

    /// Going back into a pushed Indstillinger must not lose the way to Profil,
    /// and a language picked there changes the words at once without leaving.
    func testIndstillingerIsPushedAndKeepsItsPlaceOnALanguageChange() {
        let app = launch()
        let settings = app.buttons.matching(
            NSPredicate(format: "label BEGINSWITH %@", "Indstillinger")
        ).firstMatch
        XCTAssertTrue(settings.waitForExistence(timeout: 10))
        settings.tap()
        XCTAssertTrue(app.navigationBars["Indstillinger"].waitForExistence(timeout: 10))

        app.buttons["English"].firstMatch.tap()
        XCTAssertTrue(app.navigationBars["Settings"].waitForExistence(timeout: 10))
        app.buttons["Dansk"].firstMatch.tap()
        XCTAssertTrue(app.navigationBars["Indstillinger"].waitForExistence(timeout: 10))

        app.navigationBars.buttons.element(boundBy: 0).tap()
        XCTAssertTrue(app.navigationBars["Profil"].waitForExistence(timeout: 10))
    }

    func testChangingTheNameIsSaved() {
        let app = launch()
        let card = app.buttons["Skift dit viste navn"].firstMatch
        XCTAssertTrue(card.waitForExistence(timeout: 10))
        let name = "Testnavn \(Int.random(in: 100...999))"
        card.tap()
        let field = app.alerts.textFields.firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        field.tap()
        // The field starts with the name now: delete keys clear it on any iOS.
        field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: 50))
        field.typeText(name)
        // With the on-screen keyboard (iPhone 17e) the alert moves up as it
        // comes: Gem is pressed once it stands still, not where it was.
        _ = XCTWaiter.wait(for: [expectation(description: "settled")], timeout: 1)
        app.alerts.buttons["Gem"].tap()

        let saved = NSPredicate(format: "value == %@", name)
        let waited = XCTNSPredicateExpectation(predicate: saved, object: card)
        XCTAssertEqual(XCTWaiter.wait(for: [waited], timeout: 10), .completed)
    }

    /// The whole row is the button, not only its icon: found on a phone,
    /// where Del Casy seemed dead and the help pages opened only from the icon.
    func testARowAnswersFarFromItsIcon() {
        let app = launch()
        let share = row(app, "Del appen")
        XCTAssertTrue(share.waitForExistence(timeout: 10))
        share.coordinate(withNormalizedOffset: CGVector(dx: 0.75, dy: 0.5)).tap()
        XCTAssertTrue(
            app.otherElements["ActivityListView"].waitForExistence(timeout: 10),
            "the share sheet never opened")
    }

    /// A picture picked, cropped and saved, then taken away again.
    func testAPictureIsAddedAndRemoved() {
        let app = launch()
        let picture = app.buttons.matching(
            NSPredicate(format: "label == %@ OR label == %@", "Tilføj profilbillede", "Skift profilbillede")
        ).firstMatch
        XCTAssertTrue(picture.waitForExistence(timeout: 10))
        if picture.label == "Skift profilbillede" {
            picture.tap()
            app.buttons["Fjern billede"].firstMatch.tap()
            XCTAssertTrue(app.buttons["Tilføj profilbillede"].waitForExistence(timeout: 10))
        }

        app.buttons["Tilføj profilbillede"].firstMatch.tap()
        app.buttons["Fotobibliotek"].firstMatch.tap()
        let crop = app.otherElements.matching(
            NSPredicate(format: "label BEGINSWITH %@", "Billedet. Træk")
        ).firstMatch
        XCTAssertTrue(crop.waitForExistence(timeout: 10))
        // Færdig is the crop sheet's main button along the bottom (design rule 11);
        // the Profil sheet under it has one in its top bar.
        let done = app.buttons.matching(NSPredicate(format: "label == %@", "Færdig"))
            .allElementsBoundByIndex.max { $0.frame.minY < $1.frame.minY }
        XCTAssertGreaterThan(done?.frame.minY ?? 0, app.frame.height / 2)
        done?.tap()
        XCTAssertTrue(app.buttons["Skift profilbillede"].waitForExistence(timeout: 10), "not saved")

        app.buttons["Skift profilbillede"].firstMatch.tap()
        app.buttons["Fjern billede"].firstMatch.tap()
        XCTAssertTrue(app.buttons["Tilføj profilbillede"].waitForExistence(timeout: 10), "not removed")
    }

    /// A screen that is still the page's closes the native sheet.
    func testARowStillOnThePageClosesTheSheet() { leavesForThePage("Grupper") }

    /// Log ind og sikkerhed is the app's own (#202): a new password with its
    /// rules, the code emailed first, then Log ind med Apple added.
    func testLogInAndSecurity() {
        let app = openSecurity()
        typePasswords(app, "Solskin2026x", "Solskin2026x")
        app.buttons["security.save"].tap()
        let code = app.textFields["security.code"]
        XCTAssertTrue(code.waitForExistence(timeout: 10), "the code step")
        code.tap()
        code.typeText("123456")
        app.buttons["Gem adgangskode"].tap()
        XCTAssertTrue(
            app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Adgangskoden er gemt")).firstMatch
                .waitForExistence(timeout: 10))
        let apple = app.buttons["security.apple"]
        XCTAssertTrue(apple.waitForExistence(timeout: 5))
        apple.tap()
        XCTAssertTrue(app.staticTexts["Tilføjet"].waitForExistence(timeout: 10))
    }

    /// Two passwords that differ are said so before anything is sent. (It ends
    /// there: after it, iOS's password tools keep a test from ever idling.)
    func testLogInAndSecurityPasswordsMustMatch() {
        let app = openSecurity()
        typePasswords(app, "Solskin2026x", "Solskin2026y")
        app.buttons["security.save"].tap()
        XCTAssertTrue(app.staticTexts["Adgangskoderne er ikke ens."].waitForExistence(timeout: 5))
        XCTAssertFalse(app.textFields["security.code"].exists)
    }

    private func openSecurity() -> XCUIApplication {
        let app = launch()
        let target = row(app, "Log ind og sikkerhed")
        XCTAssertTrue(target.waitForExistence(timeout: 10))
        target.tap()
        XCTAssertTrue(app.navigationBars["Log ind og sikkerhed"].waitForExistence(timeout: 10))
        app.buttons["security.setPassword"].tap()
        return app
    }

    private func typePasswords(_ app: XCUIApplication, _ password: String, _ again: String) {
        let field = app.secureTextFields["security.newPassword"]
        XCTAssertTrue(field.waitForExistence(timeout: 5))
        field.tap()
        field.typeText(password)
        let confirm = app.secureTextFields["security.confirm"]
        confirm.tap()
        confirm.typeText(again)
    }

    private func leavesForThePage(_ label: String) {
        let app = launch()
        let target = row(app, label)
        XCTAssertTrue(target.waitForExistence(timeout: 10))
        // A tap on a list still gliding only stops it.
        var still = 0
        var last = target.frame
        for _ in 0..<40 where still < 3 {
            usleep(250_000)
            still = target.frame == last ? still + 1 : 0
            last = target.frame
        }
        target.tap()
        let gone = NSPredicate(format: "exists == false")
        let waited = XCTNSPredicateExpectation(
            predicate: gone, object: app.navigationBars["Profil"])
        XCTAssertEqual(XCTWaiter.wait(for: [waited], timeout: 10), .completed)
    }
}
