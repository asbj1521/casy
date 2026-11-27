import XCTest

/// The app without its page (#202). The page's login carried over: someone
/// signed in on the page before the app owned its login stays signed in once
/// the page is gone, and the page's copy is removed as it is taken, so the two
/// never refresh it both. And the app asks itself whether it is too old.
final class PageLoginUITests: XCTestCase {
    override func setUp() async throws {
        continueAfterFailure = false
        var reset = URLRequest(url: URL(string: "\(testBackend)/reset")!)
        reset.httpMethod = "POST"
        _ = try await URLSession.shared.data(for: reset)
    }

    @MainActor private func launch(_ arguments: [String]) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-casyBackend", testBackend, "-casyLang", "da"] + arguments
        app.launch()
        return app
    }

    @MainActor func testThePagesLoginIsTakenOverOnce() async throws {
        // 1. With its page: Mia's login in the page's storage, as auth-js keeps it.
        let session = try await URLSession.shared.data(from: URL(string: "\(testBackend)/parity/session")!).0
        var app = launch([
            "-casy.pageFree", "NO", "-casyForgetLogin", "YES",
            // Base64: iOS reads a launch argument starting with "{" as a dictionary.
            "-casyWebSession", session.base64EncodedString(),
        ])
        // Time for the page to run and its storage to reach the disk.
        _ = app.webViews.firstMatch.waitForExistence(timeout: 20)
        Thread.sleep(forTimeInterval: 4)
        app.terminate()

        // 2. Without the page and no login of the app's own: the page's is taken, no welcome.
        app = launch(["-casy.pageFree", "YES", "-casyForgetLogin", "YES"])
        let welcome = app.descendants(matching: .any)["welcome.screen"]
        XCTAssertFalse(welcome.waitForExistence(timeout: 8), "signed in with the page's login")
        // And what the page kept with it: this phone's calendar connection, not asked for again.
        let carried = app.staticTexts["home.lastAction"]
        XCTAssertTrue(carried.waitForExistence(timeout: 10))
        XCTAssertEqual(carried.label, "carried phone conn-apple")
        app.terminate()

        // 3. The app's login forgotten again: the page's was removed as it was taken.
        app = launch(["-casy.pageFree", "YES", "-casyForgetLogin", "YES"])
        XCTAssertTrue(welcome.waitForExistence(timeout: 15), "nothing left in the page to take")
        app.terminate()
    }

    /// Too old, with no page to say so: "Opdater appen" over everything.
    @MainActor func testWithoutThePageTheAppSaysWhenItIsTooOld() async throws {
        var reset = URLRequest(url: URL(string: "\(testBackend)/reset")!)
        reset.httpMethod = "POST"
        reset.httpBody = Data(#"{"outdated":true}"#.utf8)
        _ = try await URLSession.shared.data(for: reset)
        let app = launch(["-casy.pageFree", "YES"])
        XCTAssertTrue(app.descendants(matching: .any)["update.screen"].waitForExistence(timeout: 20))
        app.terminate()
    }

    /// Signed out, an invite said yes to before there is an account (the web's
    /// `?join=1`): the account first, then the invite joins by itself.
    @MainActor func testAnInviteSaidYesToBeforeTheAccountJoinsAfterSigningIn() {
        let app = launch([
            "-casy.pageFree", "YES", "-casyForgetLogin", "YES", "-casyPageLooked", "YES",
            "-casyCopied", "Kom med: https://casy.app/join/abc123",
        ])
        let paste = app.buttons["welcome.paste"]
        XCTAssertTrue(paste.waitForExistence(timeout: 45), "signed out: the welcome")
        paste.tap()
        let go = app.buttons["invitePaste.go"]
        XCTAssertTrue(go.waitForExistence(timeout: 10))
        go.tap()
        let answer = app.buttons["join.answer"]
        XCTAssertTrue(answer.waitForExistence(timeout: 20), "the invite, signed out")
        XCTAssertTrue(app.staticTexts["Sommerhuset"].exists || app.descendants(matching: .any)["join.screen"].exists)
        answer.tap()
        XCTAssertTrue(app.descendants(matching: .any)["signin.screen"].waitForExistence(timeout: 10), "an account first")
        app.buttons["signin.tab.signIn"].tap()
        for (id, text) in [("signin.email", "mia@eksempel.dk"), ("signin.password", "hemmelig12")] {
            let field = app.descendants(matching: .any)[id].firstMatch
            XCTAssertTrue(field.waitForExistence(timeout: 5), id)
            field.tap()
            field.typeText(text)
        }
        app.buttons["signin.submit"].tap()
        // Back on the invite, joining by itself (too quick to catch under test), then home (the fake backend's join adds no group to look for).
        XCTAssertTrue(app.staticTexts["home.title"].waitForExistence(timeout: 20), "home, signed in")
        XCTAssertFalse(app.descendants(matching: .any)["join.screen"].exists, "joined, the invite gone")
        XCTAssertFalse(app.descendants(matching: .any)["welcome.screen"].exists)
    }
}
