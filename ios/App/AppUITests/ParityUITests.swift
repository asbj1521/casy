import XCTest

/// The native screens' look against the web's (#280, docs/native-visual-parity.md).
/// Every test here runs twice on iPhone 17e, through scripts/native/parity.sh:
/// CASY_PARITY_MODE=web, where no screen is native and the page draws each one
/// itself (`-casyWebOnly`), and CASY_PARITY_MODE=native. Both open the same
/// screen in the same made-up world, clock, theme and language, with the page
/// signed in as Mia (`-casyWebSession`): native, the page hands the native
/// screen its data as in real use. Each shot is saved as `<name>-<mode>.png`.
///
/// Without CASY_PARITY_MODE (the ordinary UI test run) these are skipped.
@MainActor
final class ParityUITests: XCTestCase {
    private static let backend = "http://localhost:4318"
    private static let now = "2026-10-07T08:00:00.000Z"

    private var mode: String { ProcessInfo.processInfo.environment["CASY_PARITY_MODE"] ?? "" }

    override func setUp() async throws {
        continueAfterFailure = false
        try XCTSkipUnless(["web", "native"].contains(mode), "parity shots run through parity.sh")
        var reset = URLRequest(url: URL(string: "\(Self.backend)/reset")!)
        reset.httpMethod = "POST"
        _ = try await URLSession.shared.data(for: reset)
    }

    /// The app on `path` (`/`, `/?day=2026-10-15`), in `theme`, in this run's mode.
    private func launch(_ path: String, theme: String, extra: [String] = []) async throws -> XCUIApplication {
        let (session, _) = try await URLSession.shared.data(from: URL(string: "\(Self.backend)/parity/session")!)
        let app = XCUIApplication()
        app.launchArguments = [
            "-casyBackend", Self.backend,
            "-casyLang", "da",
            "-casyNow", Self.now,
            "-casyTheme", theme,
            "-casy.appearance", theme,
            // Base64: iOS reads a launch argument starting with "{" as a dictionary.
            "-casyWebSession", session.base64EncodedString(),
            "-casyWebPath", path,
        ]
        app.launchArguments += mode == "web" ? ["-casyWebOnly", "YES"] : ["-casy.nativeHome", "YES"]
        app.launchArguments += extra
        app.launch()
        return app
    }

    /// Waits for `words` on screen, makes sure the screen is the one this mode
    /// is about, lets fonts, images and the page's own entrances settle, then
    /// saves the shot as `<name>-<mode>.png`.
    ///
    /// `native` is an element only the Swift screen has (`home.title`). Web
    /// only, the words must be visible on the page and that element nowhere: the
    /// reference is always the web screen people have in the App Store build
    /// (no native screens), never a Swift one. Native, the element must be
    /// visible. Visible means on top, where a tap would reach it (`isHittable`):
    /// an element merely present can be covered by something else.
    private func shoot(_ app: XCUIApplication, _ name: String, when words: String, native: String) {
        let containing = NSPredicate(format: "label CONTAINS[c] %@", words)
        let swift = app.descendants(matching: .any)[native]
        let shown: XCUIElement
        if mode == "web" {
            shown = app.webViews.descendants(matching: .any).matching(containing).firstMatch
        } else {
            shown = swift
        }
        if !visible(shown) {
            // What was on screen instead, to look at: `<name>-<mode>-failed.png`.
            shot("\(name)-\(mode)-failed")
            XCTFail(
                "\(mode == "web" ? words : native) never showed on top"
                    + " (exists: \(shown.exists), frame: \(shown.exists ? shown.frame : .zero))")
            return
        }
        if mode == "web" { XCTAssertFalse(swift.exists, "a native screen (\(native)) is in the web reference") }
        _ = XCTWaiter.wait(for: [expectation(description: "settle")], timeout: 2)
        XCTAssertTrue(shown.isHittable, "\(mode == "web" ? words : native) was covered while settling")
        if mode == "web" { XCTAssertFalse(swift.exists, "a native screen (\(native)) came up while settling") }
        shot("\(name)-\(mode)")
    }

    /// Whether `element` comes up on top within 30 seconds.
    private func visible(_ element: XCUIElement) -> Bool {
        let hittable = expectation(for: NSPredicate(format: "isHittable == true"), evaluatedWith: element)
        return XCTWaiter.wait(for: [hittable], timeout: 30) == .completed
    }

    // MARK: The home page (#201)

    func testHomeMonthLight() async throws {
        let app = try await launch("/", theme: "light")
        shoot(app, "home-month-light", when: "Oktober", native: "home.title")
    }

    func testHomeMonthDark() async throws {
        let app = try await launch("/", theme: "dark")
        shoot(app, "home-month-dark", when: "Oktober", native: "home.title")
    }

    // MARK: The day view (#281)

    /// Thursday 8 October: the web opens it from its address, the native month
    /// zooms it out of the day's cell, as a tap does.
    private func openDay(theme: String) async throws -> XCUIApplication {
        if mode == "web" { return try await launch("/?day=2026-10-08", theme: theme) }
        let app = try await launch("/", theme: theme)
        let cell = app.buttons["day.2026-10-08"]
        XCTAssertTrue(cell.waitForExistence(timeout: 30))
        cell.tap()
        return app
    }

    func testHomeDayLight() async throws {
        let app = try await openDay(theme: "light")
        shoot(app, "home-day-light", when: "torsdag", native: "day.back")
    }

    /// The zoom out of the day's cell and back, with animations on and pauses
    /// between, for filming both modes (`xcrun simctl io recordVideo`): the
    /// moving part compared as the guide's rule 6 asks. Takes no shot.
    func testHomeDayZoom() async throws {
        let app = try await launch("/", theme: "light", extra: ["-casyMotion", "YES"])
        let cell =
            mode == "web"
            ? app.buttons.matching(NSPredicate(format: "label BEGINSWITH[c] %@", "torsdag 8. oktober")).firstMatch
            : app.buttons["day.2026-10-08"]
        XCTAssertTrue(cell.waitForExistence(timeout: 30), "the 8 October cell never showed")
        _ = XCTWaiter.wait(for: [expectation(description: "still")], timeout: 2)
        cell.tap()
        _ = XCTWaiter.wait(for: [expectation(description: "open")], timeout: 4)
        let back =
            mode == "web"
            ? app.buttons.matching(NSPredicate(format: "label ==[c] %@", "vis oktober")).firstMatch
            : app.buttons["day.back"]
        XCTAssertTrue(back.waitForExistence(timeout: 10), "the way back never showed")
        back.tap()
        _ = XCTWaiter.wait(for: [expectation(description: "closed")], timeout: 2)
    }

    /// The week row's glass lens and the zoom back into the date's circle,
    /// native only (asked for on 18 Nov 2026; the web has neither), for filming.
    func testHomeWeekLens() async throws {
        try XCTSkipUnless(mode == "native", "the lens is the native app's own")
        let app = try await launch("/", theme: "light", extra: ["-casyMotion", "YES"])
        let cell = app.buttons["day.2026-10-08"]
        XCTAssertTrue(cell.waitForExistence(timeout: 30), "the 8 October cell never showed")
        cell.tap()
        _ = XCTWaiter.wait(for: [expectation(description: "open")], timeout: 4)
        app.buttons["week.2026-10-06"].tap()
        _ = XCTWaiter.wait(for: [expectation(description: "lens")], timeout: 2)
        app.buttons["week.2026-10-10"].tap()
        _ = XCTWaiter.wait(for: [expectation(description: "lens")], timeout: 2)
        app.buttons["day.back"].tap()
        _ = XCTWaiter.wait(for: [expectation(description: "closed")], timeout: 2)
    }

    /// Drags across the week row with the real page underneath, two days in
    /// view and animations on (the app froze so on 18 Nov 2026), native only.
    func testHomeWeekDrag() async throws {
        try XCTSkipUnless(mode == "native", "the native app's own")
        let app = try await launch("/", theme: "dark", extra: ["-casyMotion", "YES"])
        // Today (the world's 7 October), as when it froze: the time now in view.
        let cell = app.buttons["day.2026-10-07"]
        XCTAssertTrue(cell.waitForExistence(timeout: 30), "today's cell never showed")
        cell.tap()
        XCTAssertTrue(app.buttons["day.span"].waitForExistence(timeout: 10))
        app.buttons["day.span"].tap()
        // Each drag turns the week (right: the one before, left: the next), so
        // each starts in the week the last one turned to.
        for (a, b) in [("week.2026-10-07", "week.2026-10-09"), ("week.2026-09-30", "week.2026-09-28"),
                       ("week.2026-10-07", "week.2026-10-05"), ("week.2026-10-15", "week.2026-10-17"),
                       ("week.2026-10-08", "week.2026-10-06")] {
            let start = app.buttons[a]
            XCTAssertTrue(start.waitForExistence(timeout: 10), "\(a) never showed (frozen?)")
            start.press(forDuration: 0.6, thenDragTo: app.buttons[b], withVelocity: .slow, thenHoldForDuration: 0.4)
        }
        app.buttons["day.back"].tap()
        XCTAssertTrue(app.buttons["day.back"].waitForNonExistence(timeout: 10), "never closed (frozen?)")
    }

    func testHomeDayDark() async throws {
        let app = try await openDay(theme: "dark")
        shoot(app, "home-day-dark", when: "torsdag", native: "day.back")
    }

    // MARK: Profil (#281)

    func testProfileLight() async throws {
        let app = try await launch("/?profile", theme: "light")
        shoot(app, "profile-light", when: "Indstillinger", native: "profile.list")
    }

    func testProfileDark() async throws {
        let app = try await launch("/?profile", theme: "dark")
        shoot(app, "profile-dark", when: "Indstillinger", native: "profile.list")
    }

    // MARK: Indstillinger (#281)

    /// Pushed inside Profil: the web opens it from its address, the native
    /// list pushes it, as a tap on its row does.
    private func openSettings(theme: String) async throws -> XCUIApplication {
        if mode == "web" { return try await launch("/?profile=settings", theme: theme) }
        let app = try await launch("/?profile", theme: theme)
        let row = app.buttons["profile.settings"]
        XCTAssertTrue(row.waitForExistence(timeout: 30), "the Indstillinger row never showed")
        row.tap()
        return app
    }

    func testSettingsLight() async throws {
        let app = try await openSettings(theme: "light")
        shoot(app, "settings-light", when: "Udseende", native: "settings.list")
    }

    func testSettingsDark() async throws {
        let app = try await openSettings(theme: "dark")
        shoot(app, "settings-dark", when: "Udseende", native: "settings.list")
    }

    // MARK: Grupper (#281)

    private func openGroups(theme: String) async throws -> XCUIApplication {
        if mode == "web" { return try await launch("/?profile=groups", theme: theme) }
        let app = try await launch("/?profile", theme: theme)
        let row = app.buttons["profile.groups"]
        XCTAssertTrue(row.waitForExistence(timeout: 30), "the Grupper row never showed")
        row.tap()
        return app
    }

    func testGroupsLight() async throws {
        let app = try await openGroups(theme: "light")
        shoot(app, "groups-light", when: "Lav en gruppe", native: "groups.list")
    }

    func testGroupsDark() async throws {
        let app = try await openGroups(theme: "dark")
        shoot(app, "groups-dark", when: "Lav en gruppe", native: "groups.list")
    }

    /// Fredagsbar (four members: Tid til hinanden shows), pushed from Grupper.
    /// Venner, with Tilde from a group since gone, so Fjern shows too.
    private func openFriends(theme: String) async throws -> XCUIApplication {
        var reset = URLRequest(url: URL(string: "\(Self.backend)/reset")!)
        reset.httpMethod = "POST"
        reset.httpBody = Data(#"{"friends":[{"profileId":"p-past","name":"Tilde"}]}"#.utf8)
        _ = try await URLSession.shared.data(for: reset)
        if mode == "web" { return try await launch("/?profile=friends", theme: theme) }
        let app = try await launch("/?profile", theme: theme)
        let row = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Venner")).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 30), "the Venner row never showed")
        row.tap()
        return app
    }

    func testFriendsLight() async throws {
        let app = try await openFriends(theme: "light")
        shoot(app, "friends-light", when: "Tilføj en ven", native: "friends.list")
    }

    func testFriendsDark() async throws {
        let app = try await openFriends(theme: "dark")
        shoot(app, "friends-dark", when: "Tilføj en ven", native: "friends.list")
    }

    /// Dine data: its top, then its end, the screen pushed as far as it
    /// goes so both modes line up along the bottom.
    private func openData(theme: String) async throws -> XCUIApplication {
        if mode == "web" { return try await launch("/?profile=data", theme: theme) }
        let app = try await launch("/?profile", theme: theme)
        let row = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Dine data")).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 30), "the Dine data row never showed")
        app.screenList.swipeUp()
        row.tap()
        return app
    }

    private func shootData(theme: String) async throws {
        let app = try await openData(theme: theme)
        shoot(app, "data-\(theme)", when: "Din konto", native: "mydata.list")
        for _ in 0..<12 { app.swipeUp(velocity: .fast) }
        _ = XCTWaiter.wait(for: [expectation(description: "settle")], timeout: 2)
        shot("data-end-\(theme)-\(mode)")
    }

    func testDataLight() async throws { try await shootData(theme: "light") }

    func testDataDark() async throws { try await shootData(theme: "dark") }

    /// Slet konto: the card, then its "Er du sikker?" sheet with the word to type.
    private func openAccount(theme: String) async throws -> XCUIApplication {
        if mode == "web" { return try await launch("/?profile=account", theme: theme) }
        let app = try await launch("/?profile", theme: theme)
        let row = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Slet konto")).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 30), "the Slet konto row never showed")
        for _ in 0..<4 where !row.isHittable { app.screenList.swipeUp() }
        row.tap()
        return app
    }

    private func shootAccount(theme: String) async throws {
        let app = try await openAccount(theme: theme)
        shoot(app, "account-\(theme)", when: "Slet min konto", native: "account.screen")
        app.buttons["Slet min konto"].firstMatch.tap()
        _ = XCTWaiter.wait(for: [expectation(description: "open")], timeout: 4)
        shot("account-ask-\(theme)-\(mode)")
    }

    func testAccountLight() async throws { try await shootAccount(theme: "light") }

    func testAccountDark() async throws { try await shootAccount(theme: "dark") }

    private func openGroup(theme: String) async throws -> XCUIApplication {
        if mode == "web" { return try await launch("/?profile=groups/g-friday", theme: theme) }
        let app = try await openGroups(theme: theme)
        let row = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Fredagsbar")).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 30), "Fredagsbar's row never showed")
        row.tap()
        return app
    }

    func testGroupLight() async throws {
        let app = try await openGroup(theme: "light")
        shoot(app, "group-light", when: "Rediger gruppe", native: "group.screen")
    }

    func testGroupDark() async throws {
        let app = try await openGroup(theme: "dark")
        shoot(app, "group-dark", when: "Rediger gruppe", native: "group.screen")
    }
}
