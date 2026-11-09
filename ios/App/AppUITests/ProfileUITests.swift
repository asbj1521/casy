import XCTest

/// Native Profil, signed in against the fake backend (scripts/native/ui-tests.sh).
final class ProfileUITests: XCTestCase {
    private func launch() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [
            "-casyTestPicture", "YES",
            "-casyBackend", "http://localhost:4318",
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
        let list = app.collectionViews.firstMatch
        for _ in 0..<6 where !(element.exists && element.isHittable) {
            list.swipeUp(velocity: .slow)
        }
        return element
    }

    func testShowsEveryRow() {
        let app = launch()
        for label in [
            "Grupper", "Venner", "Log ind og sikkerhed", "Send feedback", "Del Casy", "Dine data",
            "Hjælp og kontakt", "Sådan virker det", "Vilkår", "Privatliv", "Log ud", "Slet konto",
        ] {
            XCTAssertTrue(row(app, label).waitForExistence(timeout: 10), label)
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
        app.alerts.buttons["Gem"].tap()

        let saved = NSPredicate(format: "value == %@", name)
        let waited = XCTNSPredicateExpectation(predicate: saved, object: card)
        XCTAssertEqual(XCTWaiter.wait(for: [waited], timeout: 10), .completed)
    }

    /// The whole row is the button, not only its icon: found on a phone,
    /// where Del Casy seemed dead and the help pages opened only from the icon.
    func testARowAnswersFarFromItsIcon() {
        let app = launch()
        let share = row(app, "Del Casy")
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
        let crop = app.navigationBars["Flyt og skalér"]
        XCTAssertTrue(crop.waitForExistence(timeout: 10))
        crop.buttons["Færdig"].tap()
        XCTAssertTrue(app.buttons["Skift profilbillede"].waitForExistence(timeout: 10), "not saved")

        app.buttons["Skift profilbillede"].firstMatch.tap()
        app.buttons["Fjern billede"].firstMatch.tap()
        XCTAssertTrue(app.buttons["Tilføj profilbillede"].waitForExistence(timeout: 10), "not removed")
    }

    /// A screen that is still the page's closes the native sheet.
    func testARowStillOnThePageClosesTheSheet() { leavesForThePage("Grupper") }

    /// Help pages open in the app's own page too, never Safari.
    func testAHelpPageClosesTheSheet() { leavesForThePage("Vilkår") }

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
