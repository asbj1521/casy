import XCTest

/// With CASY_SHOTS set (TEST_RUNNER_CASY_SHOTS for xcodebuild), the screen as it is now, to look at.
/// The colour (r, g, b) of the screen at a point given as fractions of its size.
func colour(_ shot: XCUIScreenshot, x: Double, y: Double) -> [Int] {
    guard let image = shot.image.cgImage,
        let data = image.dataProvider?.data, let bytes = CFDataGetBytePtr(data)
    else { return [] }
    let px = Int(Double(image.width) * x)
    let py = Int(Double(image.height) * y)
    let at = py * image.bytesPerRow + px * (image.bitsPerPixel / 8)
    // BGRA or RGBA: told apart by the bitmap's byte order.
    let bgra = image.bitmapInfo.contains(.byteOrder32Little)
    return bgra ? [Int(bytes[at + 2]), Int(bytes[at + 1]), Int(bytes[at])] : [Int(bytes[at]), Int(bytes[at + 1]), Int(bytes[at + 2])]
}

func shot(_ name: String) {
    guard let shots = ProcessInfo.processInfo.environment["CASY_SHOTS"] else { return }
    try? XCUIScreen.main.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: "\(shots)/\(name).png"))
}

/// Native Kalendere (#200) against the fake backend: Mia's Apple account
/// (Arbejde, Privat, and Familie with no category yet), her Google account's
/// Kor, the Fodbold link, and the Danish holidays.
final class CalendarsUITests: XCTestCase {
    override func setUp() async throws {
        continueAfterFailure = false
        try await reset()
    }

    private func reset(_ body: String = "") async throws {
        var reset = URLRequest(url: URL(string: "\(testBackend)/reset")!)
        reset.httpMethod = "POST"
        reset.httpBody = Data(body.utf8)
        _ = try await URLSession.shared.data(for: reset)
    }

    private func launch(_ screen: String = "calendars", title: String = "Kalendere", phone: String = "synced")
        -> XCUIApplication
    {
        let app = XCUIApplication()
        app.launchArguments = [
            "-casyBackend", testBackend,
            "-casyOpenScreen", screen,
            "-casyPushPermission", "granted",
            "-casyLang", "da",
            "-casyNow", "2026-10-07T08:00:00.000Z",
            "-casyPhoneSync", phone,
        ]
        app.launch()
        XCTAssertTrue(app.navigationBars[title].waitForExistence(timeout: 20))
        return app
    }

    private func open(_ app: XCUIApplication, group: String) {
        let header = app.buttons["calendars.group.\(group)"]
        XCTAssertTrue(header.waitForExistence(timeout: 10))
        header.tap()
    }

    /// A menu's choice, once it reads `value` (it saves, then shows what the server has).
    private func has(_ menu: XCUIElement, _ value: String) -> Bool {
        let shown = NSPredicate(format: "value == %@", value)
        return XCTWaiter().wait(for: [XCTNSPredicateExpectation(predicate: shown, object: menu)], timeout: 10) == .completed
    }

    private func text(_ app: XCUIApplication, containing words: String) -> XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", words)).firstMatch
    }

    /// Every calendar by brand, folded until opened; the one wanting a category
    /// is counted on the tour's row, first.
    func testTheListIsByBrandAndCountsWhatWantsALook() {
        let app = launch()
        XCTAssertTrue(app.buttons["calendars.group.apple"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["calendars.group.google"].exists)
        XCTAssertTrue(app.buttons["calendars.group.builtin"].exists)
        XCTAssertTrue(text(app, containing: "1 kalender er ikke sat op").exists)
        XCTAssertFalse(app.buttons["calendars.tick.cal-work"].exists)
        open(app, group: "apple")
        XCTAssertTrue(app.buttons["calendars.tick.cal-work"].waitForExistence(timeout: 5))
        XCTAssertTrue(has(app.buttons["calendars.category.cal-family"], "Ingen kategori"))
        // The primary calendar is badged.
        XCTAssertTrue(app.staticTexts["Primær"].exists)
        shot("calendars-list")
    }

    /// Unticked, a calendar waits under Tæller ikke med, and ticking it there brings it back.
    func testUntickingMovesItDownAndBack() {
        let app = launch()
        open(app, group: "apple")
        let tick = app.buttons["calendars.tick.cal-family"]
        XCTAssertTrue(tick.waitForExistence(timeout: 5))
        tick.tap()
        XCTAssertTrue(tick.waitForNonExistence(timeout: 10))
        app.swipeUp()
        let uncounted = app.buttons["calendars.uncounted"]
        XCTAssertTrue(uncounted.waitForExistence(timeout: 10))
        XCTAssertTrue(uncounted.label.contains("(1)"), uncounted.label)
        uncounted.tap()
        let back = app.buttons["Tæl Familie med"]
        XCTAssertTrue(back.waitForExistence(timeout: 5))
        back.tap()
        XCTAssertTrue(uncounted.waitForNonExistence(timeout: 10))
    }

    /// The holidays' tick stays on this phone: they move down without asking the server.
    func testTheHolidaysTickIsKeptHere() {
        let app = launch()
        open(app, group: "builtin")
        let tick = app.buttons["calendars.tick.builtin:dk-holidays"]
        XCTAssertTrue(tick.waitForExistence(timeout: 5))
        tick.tap()
        XCTAssertTrue(app.buttons["calendars.group.builtin"].waitForNonExistence(timeout: 5))
        app.swipeUp()
        XCTAssertTrue(app.buttons["calendars.uncounted"].waitForExistence(timeout: 5))
    }

    /// A category picked from its menu is saved, and the tour's count goes.
    func testPickingACategorySavesIt() {
        let app = launch()
        open(app, group: "apple")
        let menu = app.buttons["calendars.category.cal-family"]
        XCTAssertTrue(menu.waitForExistence(timeout: 5))
        menu.tap()
        app.buttons["Privat"].firstMatch.tap()
        XCTAssertTrue(has(menu, "Privat"))
        XCTAssertTrue(text(app, containing: "Én ad gangen").waitForExistence(timeout: 10))
    }

    /// A priority is picked by the tour's names for it.
    func testPickingAPrioritySavesIt() {
        let app = launch()
        open(app, group: "apple")
        let menu = app.buttons["calendars.priority.cal-work"]
        XCTAssertTrue(menu.waitForExistence(timeout: 5))
        menu.tap()
        app.buttons["Høj prioritet"].firstMatch.tap()
        XCTAssertTrue(has(menu, "Høj prioritet"))
    }

    /// A new name is shown, with the original under it.
    func testRenamingKeepsTheOriginalName() {
        let app = launch()
        open(app, group: "apple")
        let pencil = app.buttons["Omdøb Arbejde"]
        XCTAssertTrue(pencil.waitForExistence(timeout: 5))
        pencil.tap()
        let field = app.alerts.textFields.firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 5))
        field.tap()
        field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: 12) + "Job")
        // The iPhone 17e simulator's keyboard swallows the first tap after typing.
        app.alerts.staticTexts.firstMatch.tap()
        app.alerts.buttons["Gem"].tap()
        XCTAssertTrue(text(app, containing: "Oprindeligt navn: Arbejde").waitForExistence(timeout: 10))
    }

    /// A category of your own, made from the menu, goes on the calendar.
    func testANewCategoryOfYourOwn() {
        let app = launch()
        open(app, group: "apple")
        let menu = app.buttons["calendars.category.cal-family"]
        XCTAssertTrue(menu.waitForExistence(timeout: 5))
        menu.tap()
        app.buttons["Ny kategori"].firstMatch.tap()
        let field = app.textFields["Navn"]
        XCTAssertTrue(field.waitForExistence(timeout: 5))
        field.tap()
        field.typeText("Kor")
        app.buttons["Gem kategori"].tap()
        XCTAssertTrue(has(menu, "Kor"))
    }

    /// The tour goes through the one wanting a look, saves it, and ends with the reward.
    func testTheTourSortsWhatWantsALook() {
        let app = launch("calendars:tour", title: "Dine kalendere")
        XCTAssertTrue(app.staticTexts["Familie"].waitForExistence(timeout: 10))
        shot("tour-card")
        app.buttons["Privat"].tap()
        XCTAssertTrue(app.buttons["Privat"].isSelected)
        app.buttons["tour.next"].tap()
        XCTAssertTrue(app.staticTexts["Så er dine kalendere klar"].waitForExistence(timeout: 5))
        sleep(2)
        shot("tour-done")
        app.navigationBars.buttons["Kalendere"].tap()
        open(app, group: "apple")
        XCTAssertTrue(has(app.buttons["calendars.category.cal-family"], "Privat"))
        XCTAssertFalse(text(app, containing: "ikke sat op").exists)
    }

    /// Switched off in the tour, a calendar stops counting.
    func testTheTourCanSwitchOneOff() {
        let app = launch("calendars:tour", title: "Dine kalendere")
        let slider = app.sliders["tour.slider"]
        XCTAssertTrue(slider.waitForExistence(timeout: 10))
        slider.adjust(toNormalizedSliderPosition: 0)
        XCTAssertEqual(slider.value as? String, "Tæller ikke med")
        app.buttons["tour.next"].tap()
        XCTAssertTrue(app.staticTexts["Så er dine kalendere klar"].waitForExistence(timeout: 5))
        app.navigationBars.buttons["Kalendere"].tap()
        XCTAssertTrue(app.buttons["calendars.group.apple"].waitForExistence(timeout: 10))
        app.swipeUp()
        XCTAssertTrue(app.buttons["calendars.uncounted"].waitForExistence(timeout: 10))
    }

    /// Every account, newest synced, and Synkronisér nu says how it went.
    func testTheAccountsAndSyncingNow() {
        let app = launch("calendars:accounts", title: "Forbundne kalendere")
        XCTAssertTrue(app.staticTexts["mia@icloud.com"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["mia@example.com"].exists)
        XCTAssertTrue(text(app, containing: "for 20 min siden").exists)
        shot("accounts")
        app.buttons["accounts.sync"].tap()
        XCTAssertTrue(text(app, containing: "Synkroniserede 3 konti").waitForExistence(timeout: 10))
    }

    /// Removing an account says what goes first.
    func testRemovingAnAccountIsAskedFirst() {
        let app = launch("calendars:accounts", title: "Forbundne kalendere")
        let remove = app.buttons["accounts.remove.conn-ics"]
        XCTAssertTrue(remove.waitForExistence(timeout: 10))
        remove.tap()
        XCTAssertTrue(text(app, containing: "Fjern Fodbold?").waitForExistence(timeout: 5))
        app.buttons["Fjern"].tap()
        XCTAssertTrue(remove.waitForNonExistence(timeout: 10))
    }

    /// A calendar link from the other ways to connect.
    func testAddingALink() {
        let app = launch("calendars:accounts", title: "Forbundne kalendere")
        let more = app.buttons["accounts.more"]
        XCTAssertTrue(more.waitForExistence(timeout: 10))
        more.tap()
        shot("accounts-more")
        app.buttons["accounts.add.ics"].tap()
        XCTAssertTrue(app.navigationBars["Kalenderlink (ICS)"].waitForExistence(timeout: 5))
        let url = app.textFields["Kalenderlink"]
        url.tap()
        url.typeText("https://example.com/skema.ics")
        let name = app.textFields["Navn (valgfrit)"]
        name.tap()
        name.typeText("Skema")
        app.buttons["Tilføj link"].tap()
        XCTAssertTrue(app.staticTexts["Skema"].waitForExistence(timeout: 10))
        app.swipeUp()
        XCTAssertTrue(text(app, containing: "Tilføjede \"Skema\"").waitForExistence(timeout: 10))
    }

    /// The Apple Calendar guide is the app's own list (#202), its button opening the form.
    func testTheAppleGuide() {
        let app = launch("calendars:accounts", title: "Forbundne kalendere")
        let more = app.buttons["accounts.more"]
        XCTAssertTrue(more.waitForExistence(timeout: 10))
        more.tap()
        app.links["Apple"].firstMatch.tap()
        XCTAssertTrue(app.descendants(matching: .any)["help.appleGuide"].waitForExistence(timeout: 5))
        XCTAssertTrue(text(app, containing: "Åbn Safari").exists)
        app.buttons["guide.copyAddress"].tap()
        XCTAssertTrue(app.staticTexts["Kopieret"].waitForExistence(timeout: 2))
        shot("guide-apple")
        app.buttons["appleGuide.next"].tap()
        XCTAssertTrue(app.textFields["Apple-konto (e-mail)"].waitForExistence(timeout: 5))
    }

    /// Finding a calendar's link is the app's own guide (#202).
    func testTheLinkGuide() {
        let app = launch("calendars:accounts", title: "Forbundne kalendere")
        let more = app.buttons["accounts.more"]
        XCTAssertTrue(more.waitForExistence(timeout: 10))
        more.tap()
        // The footnote's second link answers with no size: tapped just after the first.
        let apple = app.links["Apple"].firstMatch
        XCTAssertTrue(apple.waitForExistence(timeout: 5))
        apple.coordinate(withNormalizedOffset: CGVector(dx: 1, dy: 0.5)).withOffset(CGVector(dx: 40, dy: 0)).tap()
        XCTAssertTrue(app.descendants(matching: .any)["help.linkGuide"].waitForExistence(timeout: 5))
        XCTAssertTrue(text(app, containing: "Hemmelig adresse i iCal-format").exists)
        shot("guide-link")
        app.swipeUp()
        shot("guide-link-drawings")
        app.swipeUp()
        app.swipeUp()
        shot("guide-link-end")
    }

    /// An ordinary password is warned about and refused; an app-specific one connects.
    func testConnectingAnAppleAccount() {
        let app = launch("calendars:accounts", title: "Forbundne kalendere")
        let more = app.buttons["accounts.more"]
        XCTAssertTrue(more.waitForExistence(timeout: 10))
        more.tap()
        app.buttons["accounts.add.apple"].tap()
        XCTAssertTrue(app.navigationBars["Apple-kalender"].waitForExistence(timeout: 5))
        let email = app.textFields["Apple-konto (e-mail)"]
        email.tap()
        email.typeText("mia2@icloud.com")
        let password = app.secureTextFields["App-specifik adgangskode"]
        password.tap()
        password.typeText("MyPassword1")
        app.buttons["Forbind"].tap()
        XCTAssertTrue(text(app, containing: "Det ligner ikke en app-specifik adgangskode").waitForExistence(timeout: 5))
        XCTAssertTrue(text(app, containing: "Apple didn't accept").waitForExistence(timeout: 10))
        shot("apple-form")
        password.tap()
        password.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: 14) + "abcd-efgh-ijkl-mnop")
        app.buttons["Forbind"].tap()
        XCTAssertTrue(app.staticTexts["mia2@icloud.com"].waitForExistence(timeout: 10))
        app.swipeUp()
        XCTAssertTrue(text(app, containing: "Forbundet mia2@icloud.com").waitForExistence(timeout: 10))
    }

    /// Changing the primary calendar asks first, since events already added stay.
    func testChangingThePrimaryCalendarAsksFirst() {
        let app = launch("calendars:accounts", title: "Forbundne kalendere")
        let primary = app.buttons["accounts.primary"]
        XCTAssertTrue(primary.waitForExistence(timeout: 10))
        XCTAssertTrue(primary.label.contains("Privat"), primary.label)
        primary.tap()
        XCTAssertTrue(app.navigationBars["Primær kalender"].waitForExistence(timeout: 5))
        shot("primary")
        app.buttons["Arbejde"].tap()
        XCTAssertTrue(text(app, containing: "Gør Arbejde til din primære kalender?").waitForExistence(timeout: 5))
        app.buttons["Ja, skift"].tap()
        XCTAssertTrue(app.navigationBars["Forbundne kalendere"].waitForExistence(timeout: 10))
        XCTAssertTrue(primary.label.contains("Arbejde"), primary.label)
    }
}

/// Forbundne kalendere with nothing connected yet: the phone's import is the one way in.
final class CalendarsImportUITests: XCTestCase {
    override func setUp() async throws {
        continueAfterFailure = false
        var reset = URLRequest(url: URL(string: "\(testBackend)/reset")!)
        reset.httpMethod = "POST"
        reset.httpBody = Data(#"{"calendars":"none"}"#.utf8)
        _ = try await URLSession.shared.data(for: reset)
    }

    private func launch(phone: String) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [
            "-casyBackend", testBackend,
            "-casyOpenScreen", "calendars:accounts",
            "-casyLang", "da",
            "-casyNow", "2026-10-07T08:00:00.000Z",
            "-casyPhoneSync", phone,
        ]
        app.launch()
        XCTAssertTrue(app.navigationBars["Forbundne kalendere"].waitForExistence(timeout: 20))
        return app
    }

    private func text(_ app: XCUIApplication, containing words: String) -> XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", words)).firstMatch
    }

    func testImportingThePhone() {
        let app = launch(phone: "synced")
        XCTAssertTrue(app.staticTexts["Link din Apple-kalender"].waitForExistence(timeout: 10))
        shot("import")
        app.buttons["Importér min kalender"].tap()
        XCTAssertTrue(text(app, containing: "Telefonen er forbundet").waitForExistence(timeout: 10))
    }

    /// iOS said no: only its Settings can change that, and the button says so.
    func testADeniedPhoneLeadsToSettings() {
        let app = launch(phone: "denied")
        let button = app.buttons["Importér min kalender"]
        XCTAssertTrue(button.waitForExistence(timeout: 10))
        button.tap()
        XCTAssertTrue(text(app, containing: "Appen har ikke adgang").waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["Åbn Indstillinger"].firstMatch.exists)
    }
}
