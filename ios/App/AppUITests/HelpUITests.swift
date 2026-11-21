import XCTest

/// The help pages in Swift (#198): the site's own words (HelpPages.json),
/// pushed inside Profil, their links opening the next page in the app.
final class HelpUITests: XCTestCase {
    private func open(_ label: String) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [
            "-casyBackend", testBackend,
            "-casyOpenScreen", "profile",
            "-casyPushPermission", "granted",
            "-casyLang", "da",
        ]
        app.launch()
        XCTAssertTrue(app.navigationBars["Profil"].waitForExistence(timeout: 20))
        let row = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", label)).firstMatch
        for _ in 0..<6 where !(row.exists && row.isHittable) { app.screenList.swipeUp(velocity: .fast) }
        row.tap()
        return app
    }

    private func scroll(_ app: XCUIApplication, to element: XCUIElement) {
        for _ in 0..<12 where !(element.exists && element.isHittable) {
            app.pageScroll.swipeUp(velocity: .fast)
        }
    }

    /// Privatliv is the policy itself, and Færdig closes the whole sheet.
    func testThePrivacyPolicyIsShownAndClosesWithTheSheet() {
        let app = open("Privatliv")
        XCTAssertTrue(app.navigationBars["Privatlivspolitik"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Kort fortalt"].exists)
        XCTAssertTrue(app.staticTexts["Det gemmer vi"].exists)
        app.navigationBars.buttons["Færdig"].tap()
        XCTAssertTrue(app.navigationBars["Profil"].waitForNonExistence(timeout: 10))
    }

    /// A link to another page pushes it, and back returns to where it was.
    func testALinkOpensThePageItNamesInTheApp() {
        let app = open("Hjælp og kontakt")
        XCTAssertTrue(app.navigationBars["Hjælp og kontakt"].waitForExistence(timeout: 10))
        let link = app.links["vilkårene"]
        scroll(app, to: link)
        link.tap()
        XCTAssertTrue(app.navigationBars["Vilkår for brug"].waitForExistence(timeout: 10))
        app.navigationBars.buttons.element(boundBy: 0).tap()
        XCTAssertTrue(app.navigationBars["Hjælp og kontakt"].waitForExistence(timeout: 10))
    }

    /// Six steps, and Planlæg goes back to the calendar to plan.
    func testHowItWorksShowsTheStepsAndEndsInPlanning() {
        let app = open("Sådan virker det")
        XCTAssertTrue(app.navigationBars["Sådan virker det"].waitForExistence(timeout: 10))
        let first = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "1. Hent appen, og log ind")).firstMatch
        XCTAssertTrue(first.waitForExistence(timeout: 10))
        app.buttons["howItWorks.plan"].tap()
        XCTAssertTrue(app.navigationBars["Profil"].waitForNonExistence(timeout: 10))
    }

    /// Dine data's link to the policy opens the Swift one, inside the sheet.
    func testDineDatasLinkOpensThePolicyInTheSheet() {
        let app = open("Dine data")
        let link = app.links["privatlivspolitikken"].firstMatch
        XCTAssertTrue(link.waitForExistence(timeout: 20))
        // Tapped where the word is drawn, as a finger does: in the Profil sheet
        // below full height, which iOS 26 draws slightly scaled, a link inside
        // a sentence is reported at the sentence's start with no size, and
        // XCUITest's own tap (scroll it into view first) fails. The word is
        // on the sentence's last line, a quarter of the way in.
        let sentence = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Alt, hvad vi gemmer"))
            .firstMatch
        XCTAssertTrue(sentence.exists)
        sentence.coordinate(withNormalizedOffset: CGVector(dx: 0.25, dy: 1)).withOffset(CGVector(dx: 0, dy: -10)).tap()
        XCTAssertTrue(app.navigationBars["Privatlivspolitik"].waitForExistence(timeout: 10))
    }
}
