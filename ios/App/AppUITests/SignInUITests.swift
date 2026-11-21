import XCTest

/// Log ind, natively (#282), the page's part played by the test launch
/// (`TestLaunch.authAnswer`): "forkert1" is a wrong password, "password1" a
/// leaked one, a new account waits for its email, and links are sent.
final class SignInUITests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    private func launch() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [
            "-casyBackend", testBackend,
            "-casyOpenScreen", "signIn",
            "-casyLang", "da",
            "-casyNow", "2026-10-07T08:00:00.000Z",
        ]
        app.launch()
        XCTAssertTrue(app.buttons["signin.apple"].waitForExistence(timeout: 20))
        return app
    }

    private func type(_ app: XCUIApplication, _ id: String, _ text: String) {
        let plain = app.textFields[id]
        let field = plain.waitForExistence(timeout: 2) ? plain : app.secureTextFields[id]
        field.tap()
        field.typeText(text)
    }

    private func any(_ app: XCUIApplication, _ words: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", words)).firstMatch
    }

    /// The tabs switch both ways, their capsule gliding over as glass
    /// (filmed when looked at; the selection follows the tap).
    func testTheTabsSwitch() {
        let app = launch()
        let signUp = app.buttons["signin.tab.signUp"]
        let signIn = app.buttons["signin.tab.signIn"]
        for _ in 0..<2 {
            signUp.tap()
            XCTAssertTrue(signUp.isSelected)
            _ = XCTWaiter.wait(for: [expectation(description: "glide")], timeout: 1.2)
            signIn.tap()
            XCTAssertTrue(signIn.isSelected)
            _ = XCTWaiter.wait(for: [expectation(description: "glide")], timeout: 1.2)
        }
    }

    /// A wrong password says so in the page's words; a right one closes the screen.
    func testAPasswordSignsIn() {
        let app = launch()
        type(app, "signin.email", "mia@eksempel.dk")
        type(app, "signin.password", "forkert1")
        app.buttons["signin.submit"].tap()
        XCTAssertTrue(any(app, "Forkert e-mail eller adgangskode").waitForExistence(timeout: 5))
        let password = app.secureTextFields.firstMatch
        password.tap()
        password.typeText(XCUIKeyboardKey.delete.rawValue + "2")
        app.buttons["signin.submit"].tap()
        XCTAssertTrue(app.buttons["signin.apple"].waitForNonExistence(timeout: 10), "signed in, the screen goes")
    }

    /// Opret konto: the rules tick off as they are met, a leaked password is
    /// refused, and a new account waits for its email.
    func testANewAccountWaitsForItsEmail() {
        let app = launch()
        app.buttons["signin.tab.signUp"].tap()
        type(app, "signin.name", "Mia Jensen")
        type(app, "signin.email", "mia@eksempel.dk")
        type(app, "signin.newPassword", "password1")
        app.buttons["signin.create"].tap()
        XCTAssertTrue(any(app, "kendte datalæk").waitForExistence(timeout: 5), "a leaked one refused")
        let password = app.secureTextFields.firstMatch
        password.tap()
        password.typeText("x")
        app.buttons["signin.create"].tap()
        XCTAssertTrue(any(app, "Tjek din indbakke").waitForExistence(timeout: 5))
    }

    /// An email link instead of a password; "Glemt adgangskode?" without an email asks for one.
    func testALinkAndAForgottenPassword() {
        let app = launch()
        app.buttons["signin.forgot"].tap()
        XCTAssertTrue(any(app, "Skriv din e-mail her").waitForExistence(timeout: 5))
        app.buttons["signin.switchMode"].tap()
        type(app, "signin.email", "mia@eksempel.dk")
        app.buttons["signin.sendLink"].tap()
        XCTAssertTrue(any(app, "login-link til mia@eksempel.dk").waitForExistence(timeout: 5))
    }

    /// Tilbage closes it.
    func testBackCloses() {
        let app = launch()
        app.buttons["signin.back"].tap()
        XCTAssertTrue(app.buttons["signin.apple"].waitForNonExistence(timeout: 10))
    }
}
