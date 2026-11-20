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
    private func shoot(
        _ app: XCUIApplication, _ name: String, when words: String, native: String, tappable: Bool = true
    ) {
        let containing = NSPredicate(format: "label CONTAINS[c] %@", words)
        let swift = app.descendants(matching: .any)[native]
        let shown: XCUIElement
        if mode == "web" {
            shown = app.webViews.descendants(matching: .any).matching(containing).firstMatch
        } else {
            shown = swift
        }
        if !(tappable || mode == "web" ? visible(shown) : shown.waitForExistence(timeout: 30)) {
            // What was on screen instead, to look at: `<name>-<mode>-failed.png`.
            shot("\(name)-\(mode)-failed")
            XCTFail(
                "\(mode == "web" ? words : native) never showed on top"
                    + " (exists: \(shown.exists), frame: \(shown.exists ? shown.frame : .zero))")
            return
        }
        if mode == "web" { XCTAssertFalse(swift.exists, "a native screen (\(native)) is in the web reference") }
        _ = XCTWaiter.wait(for: [expectation(description: "settle")], timeout: 2)
        if tappable || mode == "web" {
            XCTAssertTrue(shown.isHittable, "\(mode == "web" ? words : native) was covered while settling")
        }
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

    /// Admin, with Mia an admin and reports and corrections waiting: its top, then its end.
    private func openAdmin(theme: String) async throws -> XCUIApplication {
        var reset = URLRequest(url: URL(string: "\(Self.backend)/reset")!)
        reset.httpMethod = "POST"
        reset.httpBody = Data(#"{"admin":true,"reviews":true}"#.utf8)
        _ = try await URLSession.shared.data(for: reset)
        if mode == "web" { return try await launch("/?profile=admin", theme: theme) }
        let app = try await launch("/?profile", theme: theme)
        let row = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Admin")).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 30), "the Admin row never showed")
        for _ in 0..<4 where !row.isHittable { app.screenList.swipeUp() }
        row.tap()
        return app
    }

    private func shootAdmin(theme: String) async throws {
        let app = try await openAdmin(theme: theme)
        shoot(app, "admin-\(theme)", when: "Kalendersynkroniseringen virker", native: "admin.screen")
        for _ in 0..<12 { app.swipeUp(velocity: .fast) }
        _ = XCTWaiter.wait(for: [expectation(description: "settle")], timeout: 2)
        shot("admin-end-\(theme)-\(mode)")
    }

    /// Admin's other states, each pushed to the end: the Brugere tab, then
    /// Rapporter opened, then Rettelser til AI'en opened.
    private func shootAdminParts(theme: String) async throws {
        let app = try await openAdmin(theme: theme)
        shoot(app, "admin-parts-\(theme)", when: "Kalendersynkroniseringen virker", native: "admin.screen")
        func toEnd() {
            for _ in 0..<12 { app.swipeUp(velocity: .fast) }
            _ = XCTWaiter.wait(for: [expectation(description: "settle")], timeout: 2)
        }
        func tap(_ label: String) {
            let button = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", label)).firstMatch
            XCTAssertTrue(button.waitForExistence(timeout: 10), "\(label) never showed")
            button.tap()
        }
        toEnd()
        tap("Brugere")
        toEnd()
        shot("admin-users-\(theme)-\(mode)")
        tap("Rapporter")
        toEnd()
        shot("admin-reports-\(theme)-\(mode)")
        tap("Rapporter")
        tap("Rettelser")
        toEnd()
        shot("admin-corrections-\(theme)-\(mode)")
    }

    func testAdminPartsLight() async throws { try await shootAdminParts(theme: "light") }

    func testAdminPartsDark() async throws { try await shootAdminParts(theme: "dark") }

    func testAdminLight() async throws { try await shootAdmin(theme: "light") }

    func testAdminDark() async throws { try await shootAdmin(theme: "dark") }

    /// A help page: the web's own page (/support), the Swift one pushed from
    /// its Profil row; its top, then its end.
    private func shootHelp(_ path: String, row: String, name: String, words: String, theme: String) async throws {
        let app: XCUIApplication
        if mode == "web" {
            app = try await launch(path, theme: theme)
        } else {
            app = try await launch("/?profile", theme: theme)
            let link = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", row)).firstMatch
            XCTAssertTrue(link.waitForExistence(timeout: 30), "the \(row) row never showed")
            for _ in 0..<6 where !link.isHittable { app.screenList.swipeUp() }
            link.tap()
        }
        shoot(app, "\(name)-\(theme)", when: words, native: "help.\(name)")
        if mode == "web" {
            for _ in 0..<40 { app.swipeUp(velocity: .fast) }
        } else {
            // Drags in the sheet's upper half: a swipe starting on Planlæg
            // at the end would press it, and it closes the sheet.
            let page = app.scrollViews["help.\(name)"]
            for _ in 0..<40 {
                page.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.45))
                    .press(forDuration: 0.01, thenDragTo: page.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.0)))
            }
        }
        _ = XCTWaiter.wait(for: [expectation(description: "settle")], timeout: 2)
        shot("\(name)-end-\(theme)-\(mode)")
    }

    func testSupportLight() async throws {
        try await shootHelp("/support", row: "Hjælp og kontakt", name: "support", words: "Hjælp og kontakt", theme: "light")
    }

    func testSupportDark() async throws {
        try await shootHelp("/support", row: "Hjælp og kontakt", name: "support", words: "Hjælp og kontakt", theme: "dark")
    }

    func testHowItWorksLight() async throws {
        try await shootHelp(
            "/how-it-works", row: "Sådan virker det", name: "how", words: "Sådan virker det", theme: "light")
    }

    func testHowItWorksDark() async throws {
        try await shootHelp(
            "/how-it-works", row: "Sådan virker det", name: "how", words: "Sådan virker det", theme: "dark")
    }

    func testTermsLight() async throws {
        try await shootHelp("/terms", row: "Vilkår", name: "terms", words: "Vilkår", theme: "light")
    }

    func testPrivacyLight() async throws {
        try await shootHelp("/privacy", row: "Privatliv", name: "privacy", words: "Privatliv", theme: "light")
    }

    // MARK: Kalendere (#281)

    /// A Kalendere screen by its address, the same in both modes; its top, then its end.
    private func shootCalendars(_ path: String, name: String, words: String, theme: String) async throws {
        let app = try await launch(path, theme: theme)
        shoot(app, "\(name)-\(theme)", when: words, native: "\(name).screen")
        for _ in 0..<12 {
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.6))
                .press(forDuration: 0.01, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.25)))
        }
        _ = XCTWaiter.wait(for: [expectation(description: "settle")], timeout: 2)
        shot("\(name)-end-\(theme)-\(mode)")
    }

    func testCalendarsLight() async throws {
        try await shootCalendars("/?calendars", name: "calendars", words: "Forbundne kalendere", theme: "light")
    }

    func testCalendarsDark() async throws {
        try await shootCalendars("/?calendars", name: "calendars", words: "Forbundne kalendere", theme: "dark")
    }

    func testAccountsLight() async throws {
        try await shootCalendars("/?calendars=accounts", name: "accounts", words: "Primær kalender", theme: "light")
    }

    func testAccountsDark() async throws {
        try await shootCalendars("/?calendars=accounts", name: "accounts", words: "Primær kalender", theme: "dark")
    }

    func testTourLight() async throws {
        try await shootCalendars("/?calendars=tour", name: "tour", words: "Familie", theme: "light")
    }

    // MARK: Ny kategori, Tilføj en ven, Ny gruppe (#281)

    /// A button in either mode by its words: the page's on the web, the Swift one natively.
    private func press(_ app: XCUIApplication, _ words: String) {
        let button =
            (mode == "web" ? app.webViews.buttons : app.buttons)
            .matching(NSPredicate(format: "label BEGINSWITH %@", words)).firstMatch
        XCTAssertTrue(button.waitForExistence(timeout: 30), "no \(words)")
        _ = XCTWaiter.wait(for: [expectation(description: "settle")], timeout: 1)
        button.tap()
    }

    /// Ny kategori, from the calendar tour's dashed button.
    private func shootCategory(theme: String) async throws {
        let app = try await launch("/?calendars=tour", theme: theme)
        press(app, "Ny kategori")
        shoot(app, "category-\(theme)", when: "Må en tur ligge oven i det?", native: "category.screen")
    }

    func testCategoryLight() async throws { try await shootCategory(theme: "light") }

    func testCategoryDark() async throws { try await shootCategory(theme: "dark") }

    /// Tilføj en ven, from Venner; then with its link made and the QR code shown.
    private func shootAddFriend(theme: String) async throws {
        let app = try await openFriends(theme: theme)
        press(app, "Tilføj en ven")
        shoot(app, "friend-\(theme)", when: "Lav et link", native: "addFriend.screen")
        press(app, "Vis QR-kode")
        _ = XCTWaiter.wait(for: [expectation(description: "the link")], timeout: 3)
        shot("friend-qr-\(theme)-\(mode)")
    }

    func testAddFriendLight() async throws { try await shootAddFriend(theme: "light") }

    func testAddFriendDark() async throws { try await shootAddFriend(theme: "dark") }

    /// Ny gruppe from Grupper: its name step, then, named and made, its invite.
    private func shootNewGroup(theme: String) async throws {
        let app = try await openGroups(theme: theme)
        press(app, "Lav en gruppe")
        shoot(app, "newgroup-\(theme)", when: "Gruppenavn", native: "newGroup.screen")
        let field = (mode == "web" ? app.webViews.textFields : app.textFields).firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        field.tap()
        // Return sends the web's form (its keyboard covers Næste); natively it
        // only puts the keyboard away, and Næste makes the group.
        field.typeText("Klatring\n")
        if mode == "native" { press(app, "Næste") }
        shoot(app, "invite-\(theme)", when: "Invitér fra kontakter", native: "invite.screen")
    }

    func testNewGroupLight() async throws { try await shootNewGroup(theme: "light") }

    func testNewGroupDark() async throws { try await shootNewGroup(theme: "dark") }

    // MARK: Rediger gruppe, Rapportér, an invitation, the crop, an event (#281)

    /// The first button on top whose words begin with `words`, in either mode.
    private func pressShown(_ app: XCUIApplication, _ words: String) {
        // A web row that leads somewhere is a link.
        let all = (mode == "web" ? app.webViews.descendants(matching: .any) : app.buttons)
            .matching(
                NSPredicate(
                    format: "(elementType == %d OR elementType == %d) AND label BEGINSWITH %@",
                    XCUIElement.ElementType.button.rawValue, XCUIElement.ElementType.link.rawValue, words))
        XCTAssertTrue(all.firstMatch.waitForExistence(timeout: 30), "no \(words)")
        _ = XCTWaiter.wait(for: [expectation(description: "settle")], timeout: 1)
        let shown = all.allElementsBoundByIndex.first { $0.isHittable } ?? all.firstMatch
        shown.tap()
    }

    /// Fredagsbar's Rediger gruppe.
    private func shootEditGroup(theme: String) async throws {
        let app = try await openGroup(theme: theme)
        pressShown(app, "Rediger gruppe")
        shoot(app, "editgroup-\(theme)", when: "Gruppenavn", native: "editGroup.screen")
    }

    func testEditGroupLight() async throws { try await shootEditGroup(theme: "light") }

    func testEditGroupDark() async throws { try await shootEditGroup(theme: "dark") }

    /// Fredagsbar's Rapportér eller bloker, scrolled to.
    private func shootReport(theme: String) async throws {
        let app = try await openGroup(theme: theme)
        let row = (mode == "web" ? app.webViews.buttons : app.buttons)
            .matching(NSPredicate(format: "label BEGINSWITH %@", "Rapportér eller bloker")).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 30))
        for _ in 0..<8 where !row.isHittable { app.swipeUp() }
        row.tap()
        shoot(app, "report-\(theme)", when: "Hvad drejer det sig om?", native: "report.screen")
    }

    func testReportLight() async throws { try await shootReport(theme: "light") }

    func testReportDark() async throws { try await shootReport(theme: "dark") }

    /// Badminton's invitation, from its row in Grupper.
    private func shootInvitation(theme: String) async throws {
        let app = try await openGroups(theme: theme)
        pressShown(app, "Badminton")
        shoot(app, "invitation-\(theme)", when: "Bliv medlem", native: "invitation.screen")
    }

    func testInvitationLight() async throws { try await shootInvitation(theme: "light") }

    func testInvitationDark() async throws { try await shootInvitation(theme: "dark") }

    /// Profil's picture, the made-up photo picked: its crop. Natively the
    /// picture is a menu first (Fotobibliotek); the web's parity build skips
    /// iOS's photo picker.
    private func shootCrop(theme: String) async throws {
        let app = try await launch("/?profile", theme: theme, extra: ["-casyTestPicture", "YES"])
        pressShown(app, "Tilføj profilbillede")
        if mode == "native" { pressShown(app, "Fotobibliotek") }
        shoot(app, "crop-\(theme)", when: "Færdig", native: "crop.screen")
    }

    func testCropLight() async throws { try await shootCrop(theme: "light") }

    func testCropDark() async throws { try await shootCrop(theme: "dark") }

    /// Thursday 8 October's Arbejde, tapped in the day.
    private func shootEventSheet(theme: String) async throws {
        let app = try await openDay(theme: theme)
        _ = XCTWaiter.wait(for: [expectation(description: "open")], timeout: 2)
        pressShown(app, "Arbejde")
        shoot(app, "eventsheet-\(theme)", when: "Torsdag 8. oktober", native: "event.sheet")
    }

    func testEventSheetLight() async throws { try await shootEventSheet(theme: "light") }

    func testEventSheetDark() async throws { try await shootEventSheet(theme: "dark") }

    // MARK: Votes on the home page (#282)

    /// Brætspilsaften's three dates answered over the day view: from the
    /// pill natively, from its address on the web (the same press there).
    private func openHomeVote(theme: String) async throws -> XCUIApplication {
        if mode == "web" { return try await launch("/?vote=ev-boardgames", theme: theme) }
        let app = try await launch("/", theme: theme)
        let pill = app.buttons["home.pill"]
        XCTAssertTrue(pill.waitForExistence(timeout: 30))
        pill.tap()
        return app
    }

    private func shootHomeVote(theme: String) async throws {
        let app = try await openHomeVote(theme: theme)
        shoot(app, "homevote-\(theme)", when: "Dato 1 af 3", native: "vote.panel")
    }

    func testHomeVoteLight() async throws { try await shootHomeVote(theme: "light") }

    func testHomeVoteDark() async throws { try await shootHomeVote(theme: "dark") }

    /// The first date answered Kan: stamped on its date, the second up.
    private func shootHomeVoteAnswered(theme: String) async throws {
        let app = try await openHomeVote(theme: theme)
        let card = NSPredicate(format: "label CONTAINS[c] %@", "Dato 1 af 3")
        XCTAssertTrue(app.descendants(matching: .any).matching(card).firstMatch.waitForExistence(timeout: 30))
        _ = XCTWaiter.wait(for: [expectation(description: "open")], timeout: 2)
        // Every answer begins "Jeg kan": the yes by its exact words.
        let yes =
            mode == "web"
            ? app.webViews.buttons.matching(NSPredicate(format: "label == %@", "Jeg kan")).firstMatch
            : app.buttons["vote.accepted"]
        XCTAssertTrue(yes.waitForExistence(timeout: 10))
        yes.tap()
        shoot(app, "homevote-answered-\(theme)", when: "Dato 2 af 3", native: "vote.panel")
    }

    func testHomeVoteAnsweredLight() async throws { try await shootHomeVoteAnswered(theme: "light") }

    func testHomeVoteAnsweredDark() async throws { try await shootHomeVoteAnswered(theme: "dark") }

    /// A finger on the day folds the card down to itself, Senere over it.
    private func shootHomeVoteFolded(theme: String) async throws {
        let app = try await openHomeVote(theme: theme)
        let card = NSPredicate(format: "label CONTAINS[c] %@", "Dato 1 af 3")
        XCTAssertTrue(app.descendants(matching: .any).matching(card).firstMatch.waitForExistence(timeout: 30))
        _ = XCTWaiter.wait(for: [expectation(description: "open")], timeout: 2)
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.6, dy: 0.3)).tap()
        shoot(app, "homevote-folded-\(theme)", when: "Senere", native: "vote.later")
    }

    func testHomeVoteFoldedLight() async throws { try await shootHomeVoteFolded(theme: "light") }

    func testHomeVoteFoldedDark() async throws { try await shootHomeVoteFolded(theme: "dark") }

    /// "‹ Oktober" while answering: the vote out onto the month, folded.
    private func shootHomeVoteMonth(theme: String) async throws {
        let app = try await openHomeVote(theme: theme)
        let card = NSPredicate(format: "label CONTAINS[c] %@", "Dato 1 af 3")
        XCTAssertTrue(app.descendants(matching: .any).matching(card).firstMatch.waitForExistence(timeout: 30))
        _ = XCTWaiter.wait(for: [expectation(description: "open")], timeout: 2)
        pressShown(app, "Vis Oktober")
        _ = XCTWaiter.wait(for: [expectation(description: "month")], timeout: 2)
        shoot(app, "homevote-month-\(theme)", when: "Senere", native: "vote.later")
    }

    func testHomeVoteMonthLight() async throws { try await shootHomeVoteMonth(theme: "light") }

    func testHomeVoteMonthDark() async throws { try await shootHomeVoteMonth(theme: "dark") }

    /// Løbetur, agreed since this phone last looked: said over the month.
    private func shootAgreed(theme: String) async throws {
        let app = try await launch("/?agreed=ev-run", theme: theme, extra: ["-casyAgreed", "ev-run"])
        shoot(app, "agreed-\(theme)", when: "Alle har svaret", native: "agreed.show",
            // Over the page's web view in this mode, its hit test lands on the page (HomeUITests taps it).
            tappable: false)
    }

    func testAgreedLight() async throws { try await shootAgreed(theme: "light") }

    func testAgreedDark() async throws { try await shootAgreed(theme: "dark") }

    /// The agreed date closing and flying into its day with its confetti,
    /// animations on, for filming both modes (PARITY_VIDEO=1). Takes no shot.
    func testAgreedFlight() async throws {
        let app = try await launch(
            "/?agreed=ev-run", theme: "light", extra: ["-casyAgreed", "ev-run", "-casyMotion", "YES"])
        let show =
            mode == "web"
            ? app.webViews.buttons.matching(NSPredicate(format: "label == %@", "Se den i kalenderen")).firstMatch
            : app.buttons["agreed.show"]
        XCTAssertTrue(show.waitForExistence(timeout: 30), "the agreed card never showed")
        _ = XCTWaiter.wait(for: [expectation(description: "still")], timeout: 2)
        show.tap()
        _ = XCTWaiter.wait(for: [expectation(description: "flight")], timeout: 5)
    }

    // MARK: Tilføj til kalender (#281)

    /// The plus at the top of the month, in both modes: the web has no address for it.
    private func openTell(theme: String) async throws -> XCUIApplication {
        let app = try await launch("/", theme: theme)
        let plus =
            mode == "web"
            ? app.webViews.buttons["Tilføj til kalender"].firstMatch : app.buttons["home.tell"]
        XCTAssertTrue(plus.waitForExistence(timeout: 30))
        _ = XCTWaiter.wait(for: [expectation(description: "settle")], timeout: 2)
        plus.tap()
        return app
    }

    private func shootTell(theme: String) async throws {
        let app = try await openTell(theme: theme)
        shoot(app, "tell-\(theme)", when: "Fx jeg rejser", native: "tell.box")
        // Said, and what the AI made of it.
        let box = mode == "web" ? app.webViews.textViews.firstMatch : app.textViews["tell.box"]
        XCTAssertTrue(box.waitForExistence(timeout: 10))
        box.tap()
        box.typeText("Jeg rejser fra den 12. til den 19. oktober")
        // The 17e's keyboard swallows the first tap after typing (TellUITests.write).
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.12)).tap()
        let send = mode == "web" ? app.webViews.buttons["Tilføj"].firstMatch : app.buttons["tell.send"]
        send.tap()
        shoot(app, "tell-proposal-\(theme)", when: "Sådan forstod vi det", native: "tell.save")
    }

    func testTellLight() async throws { try await shootTell(theme: "light") }

    func testTellDark() async throws { try await shootTell(theme: "dark") }

    // MARK: A trip's sheet (#281)

    /// A tap on a day of a trip in the parity world's October (src/lib/parityTrips.ts),
    /// in both modes, as a person opens it: Rome (a trip to say yes to) on the
    /// 13th, Berlin (when are you back?) on the 27th.
    private func shootTrip(_ day: Int, name: String, when words: String, theme: String) async throws {
        let app = try await launch("/", theme: theme)
        let cell =
            mode == "web"
            ? app.webViews.buttons.matching(NSPredicate(format: "label CONTAINS %@", "\(day). oktober")).firstMatch
            : app.buttons["day.2026-10-\(day)"]
        XCTAssertTrue(cell.waitForExistence(timeout: 30))
        _ = XCTWaiter.wait(for: [expectation(description: "settle")], timeout: 2)
        cell.tap()
        shoot(app, "\(name)-\(theme)", when: words, native: "trip.screen")
    }

    func testTripLight() async throws { try await shootTrip(13, name: "trip", when: "Rom", theme: "light") }

    func testTripDark() async throws { try await shootTrip(13, name: "trip", when: "Rom", theme: "dark") }

    func testTripReturnLight() async throws {
        try await shootTrip(27, name: "trip-return", when: "Berlin", theme: "light")
    }

    // MARK: Tid til hinanden (#281)

    /// The first starred day of the parity world's month, tapped in both modes:
    /// its label ends ", Tid til hinanden" on the web and in Swift alike.
    private func shootPrime(theme: String) async throws {
        let app = try await launch("/", theme: theme)
        let starred = NSPredicate(format: "label ENDSWITH %@", ", Tid til hinanden")
        let day =
            mode == "web"
            ? app.webViews.buttons.matching(starred).firstMatch : app.buttons.matching(starred).firstMatch
        XCTAssertTrue(day.waitForExistence(timeout: 30), "a starred day")
        _ = XCTWaiter.wait(for: [expectation(description: "settle")], timeout: 2)
        day.tap()
        shoot(app, "prime-\(theme)", when: "er fri", native: "prime.screen")
    }

    func testPrimeLight() async throws { try await shootPrime(theme: "light") }

    func testPrimeDark() async throws { try await shootPrime(theme: "dark") }

    // MARK: The AI's question (#281)

    /// Without the yes to the AI, the month asks for it as it opens (the web's
    /// AiConsentPrompt, the app's own sheet for it), in both modes: its first
    /// page, and its last.
    private func shootConsent(theme: String) async throws {
        var reset = URLRequest(url: URL(string: "\(Self.backend)/reset")!)
        reset.httpMethod = "POST"
        reset.httpBody = Data(#"{"aiConsent":false}"#.utf8)
        _ = try await URLSession.shared.data(for: reset)
        let app = try await launch("/", theme: theme)
        shoot(app, "consent-\(theme)", when: "Hvad det giver", native: "aiConsent.screen")
        let next = mode == "web" ? app.webViews.buttons["Næste"].firstMatch : app.buttons["aiConsent.next"]
        for _ in 0..<3 {
            next.tap()
            _ = XCTWaiter.wait(for: [expectation(description: "turn")], timeout: 1)
        }
        shoot(app, "consent-last-\(theme)", when: "Tillad", native: "aiConsent.screen")
    }

    func testConsentLight() async throws { try await shootConsent(theme: "light") }

    func testConsentDark() async throws { try await shootConsent(theme: "dark") }

    // MARK: The push ask (#281)

    /// What we say before iOS's question, after something was sent: the
    /// parity build asks from its address in both modes.
    private func shootPush(theme: String) async throws {
        let app = try await launch("/?pushAsk=sent", theme: theme)
        shoot(app, "push-\(theme)", when: "Fortsæt", native: "push.screen")
    }

    func testPushLight() async throws { try await shootPush(theme: "light") }

    func testPushDark() async throws { try await shootPush(theme: "dark") }

    // MARK: Opdater (#281)

    /// An app too old: every app is after a reset with `{ outdated: true }`,
    /// and the page asks it to update as it opens, in both modes.
    private func shootUpdate(theme: String) async throws {
        var reset = URLRequest(url: URL(string: "\(Self.backend)/reset")!)
        reset.httpMethod = "POST"
        reset.httpBody = Data(#"{"outdated":true}"#.utf8)
        _ = try await URLSession.shared.data(for: reset)
        let app = try await launch("/", theme: theme)
        shoot(app, "update-\(theme)", when: "Opdater", native: "update.screen")
    }

    func testUpdateLight() async throws { try await shootUpdate(theme: "light") }

    func testUpdateDark() async throws { try await shootUpdate(theme: "dark") }

    /// "Er du sikker?": cancelling your own Julefrokost from its screen, in both modes.
    private func shootConfirm(theme: String) async throws {
        let app: XCUIApplication
        if mode == "web" {
            app = try await launch("/?events=ev-party", theme: theme)
        } else {
            app = try await launch("/?events", theme: theme)
            let link = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Julefrokost")).firstMatch
            XCTAssertTrue(link.waitForExistence(timeout: 30), "the Julefrokost row never showed")
            link.tap()
        }
        let exit = mode == "web"
            ? app.webViews.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Aflys aftale")).firstMatch
            : app.buttons["dated.exit"]
        XCTAssertTrue(exit.waitForExistence(timeout: 30), "no way to cancel it")
        for _ in 0..<6 where !exit.isHittable { app.swipeUp() }
        exit.tap()
        shoot(app, "confirm-\(theme)", when: "Aflys aftalen for alle?", native: "confirm.screen")
    }

    func testConfirmLight() async throws { try await shootConfirm(theme: "light") }

    func testConfirmDark() async throws { try await shootConfirm(theme: "dark") }

    // MARK: Planlæg (#282)

    /// The plan sheet: the web opens it from its address, the native build opens
    /// its own sheet over the home page at launch.
    private func shootPlan(theme: String) async throws {
        let app: XCUIApplication
        if mode == "web" {
            app = try await launch("/?plan", theme: theme)
        } else {
            app = try await launch("/", theme: theme, extra: ["-casyOpenScreen", "plan"])
        }
        shoot(app, "plan-\(theme)", when: "Find dato", native: "plan.screen")
    }

    /// The AI filling the sheet in from a description, filmed with PARITY_VIDEO=1;
    /// the sheet as it ends up, shot.
    func testPlanAiFill() async throws {
        let motion = ["-casyMotion", "YES"]
        let app =
            mode == "web"
            ? try await launch("/?plan", theme: "light", extra: motion)
            : try await launch("/", theme: "light", extra: ["-casyOpenScreen", "plan"] + motion)
        let field =
            mode == "web" ? app.webViews.textFields.firstMatch : app.textFields["plan.name"]
        XCTAssertTrue(field.waitForExistence(timeout: 30), "the name field never showed")
        _ = XCTWaiter.wait(for: [expectation(description: "still")], timeout: 2)
        field.tap()
        field.typeText("møde om formiddagen på hverdage i oktober\n")
        _ = XCTWaiter.wait(for: [expectation(description: "fill")], timeout: 9)
        shoot(app, "plan-ai-light", when: "Hverdage", native: "plan.screen")
    }

    func testPlanLight() async throws { try await shootPlan(theme: "light") }

    func testPlanDark() async throws { try await shootPlan(theme: "dark") }

    // MARK: Aftaler (#281)

    private func shootEvents(theme: String) async throws {
        let app = try await launch("/?events", theme: theme)
        shoot(app, "events-\(theme)", when: "Kommende", native: "events.list")
        for _ in 0..<12 { app.swipeUp(velocity: .fast) }
        _ = XCTWaiter.wait(for: [expectation(description: "settle")], timeout: 2)
        shot("events-end-\(theme)-\(mode)")
    }

    /// An event's own screen, pushed from its row in Aftaler; its top, then its end.
    private func shootEvent(_ id: String, row: String, name: String, words: String, theme: String) async throws {
        let app: XCUIApplication
        if mode == "web" {
            app = try await launch("/?events=\(id)", theme: theme)
        } else {
            app = try await launch("/?events", theme: theme)
            let link = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", row)).firstMatch
            XCTAssertTrue(link.waitForExistence(timeout: 30), "the \(row) row never showed")
            link.tap()
        }
        shoot(app, "\(name)-\(theme)", when: words, native: "\(name).screen")
        for _ in 0..<12 {
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.55))
                .press(forDuration: 0.01, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.25)))
        }
        _ = XCTWaiter.wait(for: [expectation(description: "settle")], timeout: 2)
        shot("\(name)-end-\(theme)-\(mode)")
    }

    func testDatedLight() async throws {
        try await shootEvent("ev-run", row: "Løbetur", name: "dated", words: "Tilføj til min kalender", theme: "light")
    }

    func testDatedDark() async throws {
        try await shootEvent("ev-run", row: "Løbetur", name: "dated", words: "Tilføj til min kalender", theme: "dark")
    }

    func testVoteLight() async throws {
        try await shootEvent("ev-cinema", row: "Biograf", name: "vote", words: "Biograf", theme: "light")
    }

    func testVoteDark() async throws {
        try await shootEvent("ev-cinema", row: "Biograf", name: "vote", words: "Biograf", theme: "dark")
    }

    func testEventsLight() async throws { try await shootEvents(theme: "light") }

    func testEventsDark() async throws { try await shootEvents(theme: "dark") }

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
