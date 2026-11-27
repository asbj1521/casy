import CasyCore
import CasyUI
import SwiftUI
import UIKit

/// The app's screens and what happens between them (#192, #198, #202): the
/// home page placed under everything, the sheets presented over it and what
/// each asks for as it closes, the app's own routing for a notification's or a
/// link's address, the login passed on to every part of the app, and the
/// welcome when signed out. Once the bridge to the web view (hence its old
/// name's file); the app has no page any more.
@MainActor
final class AppCoordinator: NSObject, UIAdaptivePresentationControllerDelegate {
    static let shared = AppCoordinator()

    /// The app's root screen: everything is placed in it or presented over it.
    private(set) weak var root: UIViewController?

    /// The screens this app draws: all of them, but in a test that keeps one away.
    private static let nativeScreens: [String] = {
        #if DEBUG
            if TestLaunch.isActive, TestLaunch.webOnly { return [] }
        #endif
        return [
            "settings", "profile", "events", "calendars", "tell", "trip", "prime", "aiConsent", "push", "update",
            "home", "plan", "signIn", "welcome", "invitePaste", "join", "friend",
        ] + (nativeLabels ? ["labels", "dayFacts", "categorize", "tripLegs", "phoneSync", "stars", "votes", "trips", "asks", "notifications"] : [])
    }()

    /// The background work the app does: the event labels and the day facts made of them
    /// (#282, LabelsWork), the calendars sorted by AI (CategorizeWork) and the
    /// trips' legs read from the labelled journeys (TripsWork), and the phone's
    /// calendars sent with the calendar work after (PhoneSyncWork). Not in a UI
    /// test, whose made-up login has no phone calendars to label.
    static let nativeLabels: Bool = {
        #if DEBUG
            if TestLaunch.isActive { return TestLaunch.seedPhone || TestLaunch.parityData }
        #endif
        return true
    }()

    private var openScreen: String? {
        // Planlæg's own sheet over the native home page keeps it shown (placeHome).
        didSet {
            guard openScreen != oldValue else { return }
            if oldValue == "plan" { holdHome() }
            if openScreen == "plan" { planPending = false }
            DispatchQueue.main.async { self.placeHome() }
        }
    }

    /// Whether a screen opened by a test launch, not by the page, is signed in:
    /// a test's made-up login is, unless the page signs in by itself.
    private static var testSignedIn: Bool {
        #if DEBUG
            return TestLaunch.isActive && !TestLaunch.signedOut
        #else
            return false
        #endif
    }
    /// Wired up as the root screen first appears: every model's hooks, then the
    /// login, the welcome or the home page.
    func start(root: UIViewController) {
        guard self.root == nil else { return }
        self.root = root
        do {
            // A no to the AI: the labels and trips it made on this phone go too (#120).
            MyDataModel.shared.onAiConsent = { on in
                guard !on else { return }
                Task { @MainActor in
                    if let id = await SessionBox.shared.current()?.userId { LabelsWork.shared.clear(id) }
                }
            }
            MyDataModel.shared.askLabels = { LabelsWork.on ? LabelsWork.shared.count : 0 }
            EventsModel.shared.writeOnPhone = { [weak self] in
                await self?.writeOnPhone()
            }
            let calendars = CalendarsModel.shared
            calendars.onPrefs = { _, seen in
                if let seen { HomeModel.shared.rememberTourSeen(seen) }
            }
            calendars.syncPhone = { create in
                if PhoneSyncWork.on { return await PhoneSyncWork.shared.sync(create: create) }
                #if DEBUG
                    // A test launch without the phone's work: its made-up answer.
                    if TestLaunch.isActive {
                        return TestLaunch.phoneSync == "denied"
                            ? PhoneSyncOutcome(state: "denied")
                            : PhoneSyncOutcome(state: "synced", calendars: 2, busyBlocks: 5, connectionId: "c-phone")
                    }
                #endif
                return PhoneSyncOutcome(state: "failed", error: CasyStrings.phoneSaveFailed)
            }
            calendars.onPhoneForgotten = {
                if PhoneSyncWork.on { PhoneSyncWork.shared.forget() }
            }
            TripModel.shared.onAction = { action in
                #if DEBUG
                    if TestLaunch.isActive && !HomeTrips.on { return TestLaunch.answer(action) }
                #endif
                if HomeTrips.on { HomeTrips.shared.act(action) }
            }
            // A trip waiting for an answer, tapped on the home month: its sheet.
            HomeModel.shared.openTrip = { [weak self] mark in
                guard let self, let presenter = self.root, self.openScreen == nil,
                    let data = try? JSONEncoder().encode(mark), let object = try? JSONSerialization.jsonObject(with: data)
                else { return }
                self.present("trip", on: presenter, state: ["mark": object])
            }
            // An agreed date's chip in the day view: Aftaler, opened on its event.
            HomeModel.shared.openEvent = { [weak self] id in
                guard let self, let presenter = self.root, self.openScreen == nil else { return }
                self.present("events", on: presenter, state: ["vote": id])
            }
            // The notifications' sheet when the app decides it is time (#202).
            Asks.shared.showPushAsk = { [weak self] reason in
                guard let self, let presenter = self.root, self.openScreen == nil else { return false }
                self.present("push", on: presenter, state: ["reason": reason])
                return true
            }
            // Settled: the sheets made ready, so the first press is as quick as any,
            // and a notification's tap that launched the app opens now (#202).
            HomeModel.shared.onSettled = { [weak self] in
                self?.makeSheetsReady()
                PushWork.shared.settled()
            }
            // Notifications are the app's own (#202): a tap opens its screen here when it can.
            PushWork.shared.openHere = { [weak self] path in self?.open(path: path) ?? false }
            PushWork.shared.takeTaps()
            // The home page's buttons open the app's own sheets (#202): the page isn't asked.
            HomeModel.shared.route = { [weak self] action, day in
                self?.route(action, day) ?? false
            }
        }
        startPageFree()
        #if DEBUG
            startTestLaunch()
        #endif
    }

    #if DEBUG
        /// The UI tests' way in: a made-up login and a screen open at once.
        private func startTestLaunch() {
            guard let connection = TestLaunch.connection() else { return }
            // Every test starts on one day: the 1/2 day choice is kept on the phone,
            // and a test that left it on two would turn the next test's days by two.
            UserDefaults.standard.removeObject(forKey: "casy.daySpan")
            // `-casyWeakPassword YES`: signed in with a password weaker than today's rules.
            if UserDefaults.standard.bool(forKey: "casyWeakPassword") { WeakPassword.shared.flag() }
            // Nor did an earlier test's ask count against this one's.
            Asks.shared.forget()
            // No animations under test: a sheet or a push is there at once, and
            // the suite runs in a fraction of the time. A test launch only.
            // `-casyMotion YES` keeps them, for filming a moving part (#281).
            if !UserDefaults.standard.bool(forKey: "casyMotion") { UIView.setAnimationsEnabled(false) }
            Task { @MainActor in
                await SessionBox.shared.set(connection)
                LivePulse.shared.signedIn(connection.userId)
                PushWork.shared.takeTaps()
                PushWork.shared.signedIn(connection.userId)
                if TestLaunch.seedPhone {
                    // Every run from an empty book: what a run before kept proves nothing.
                    LabelsWork.shared.clear(nil)
                    Task { @MainActor in
                        guard await TestPhone.seed() else { return }
                        // As the page's setSession would: the phone sends, and the rest follows.
                        PhoneSyncWork.shared.signedIn(
                            connection.userId, pageDevice: nil, pageConnection: TestPhone.connection)
                        LabelsWork.shared.signedIn(connection.userId)
                        CategorizeWork.shared.signedIn(connection.userId)
                    }
                }
                if let lang = TestLaunch.lang { NativePreferences.shared.lang = lang }
                if let theme = TestLaunch.theme { NativePreferences.shared.theme = theme }
                if TestLaunch.nativeHome {
                    let model = HomeModel.shared
                    // The test plays the page: a press the app doesn't answer itself goes nowhere.
                    model.onAction = { _, _ in }
                    while root?.view.window == nil {
                        try? await Task.sleep(for: .milliseconds(100))
                    }
                    // A notification's tap that launched the app (#202): it waits for the home page.
                    if let path = TestLaunch.pushTap { PushWork.shared.open(path) }
                    model.update(TestLaunch.homePage)
                    placeHome()
                    if let path = TestLaunch.path {
                        try? await Task.sleep(for: .milliseconds(500))
                        model.testAction = "path \(path): \(open(path: path) ? "opened" : "the page's")"
                    }
                }
                if TestLaunch.parityData {
                    // A parity shot (#280): as in real use, the login passed on to every part of
                    // the app and its home on its own data, then the screen its address names.
                    await self.apply(connection, phone: "conn-apple")
                    self.showPageFree(signedIn: true)
                    if let address = TestLaunch.webPath {
                        try? await Task.sleep(for: .milliseconds(1500))
                        self.openForTest(address)
                    }
                }
                guard let screen = TestLaunch.screen else { return }
                while root?.view.window == nil {
                    try? await Task.sleep(for: .milliseconds(100))
                }
                if let presenter = root { present(screen, on: presenter) }
            }
        }
        /// What the page's address in a parity shot names (`/?events=ev-1`, `/join/abc`),
        /// opened as the app opens it: the page drew those from its own address.
        private func openForTest(_ address: String) {
            guard let presenter = root, openScreen == nil else { return }
            if appRoute(address) != nil, !address.hasPrefix("/?"), address != "/" {
                _ = open(path: address)
                return
            }
            let query = address.hasPrefix("/?") ? String(address.dropFirst(2)) : ""
            let parts = query.split(separator: "=", maxSplits: 1).map(String.init)
            let value = parts.count > 1 ? parts[1] : nil
            switch parts.first {
            case "profile": present("profile", on: presenter, state: value.map { ["start": $0] } ?? [:])
            case "plan": present("plan", on: presenter)
            case "events": present("events", on: presenter, state: value.map { ["vote": $0] } ?? [:])
            case "calendars": present("calendars", on: presenter, state: value.map { ["start": $0] } ?? [:])
            case "pushAsk": present("push", on: presenter, state: ["reason": value ?? "sent"])
            case "vote": HomeModel.shared.voteToOpen = value
            case "day":
                let ymd = (value ?? "").split(separator: "-").compactMap { Int($0) }
                if ymd.count == 3 { HomeModel.shared.dayToOpen = wallTime(ymd[0], ymd[1] - 1, ymd[2], 0, appTimeZone) }
            default: break
            }
        }
    #endif

    /// A login (or none) passed on to every part of the app: the page's
    /// (`setSession`) or, without the page, the app's own (`AppSession`).
    private func apply(_ next: SessionBox.Connection?, phone: String? = nil, device: String? = nil) async {
        let before = await SessionBox.shared.current()?.userId
        await SessionBox.shared.set(next)
        await MainActor.run {
            HomeModel.shared.signedIn(next?.userId)
            if PhoneSyncWork.on {
                // The app keeps the phone's id and connection, the page's taken over once.
                PhoneSyncWork.shared.signedIn(next?.userId, pageDevice: device, pageConnection: phone)
            } else {
                LabelsWork.shared.thisPhone = phone
            }
            LabelsWork.shared.signedIn(next?.userId)
            CategorizeWork.shared.signedIn(next?.userId)
            LivePulse.shared.signedIn(next?.userId)
            PushWork.shared.takeTaps()
            PushWork.shared.signedIn(next?.userId)
        }
        // Someone else on this phone must never see the last person's choices.
        if before != next?.userId {
            await MainActor.run {
                NotificationsModel.shared.reset()
                ProfileModel.shared.reset()
                GroupsModel.shared.reset()
                MyDataModel.shared.reset()
                AdminModel.shared.reset()
                AdminReviewsModel.shared.reset()
                EventsModel.shared.reset()
                CalendarsModel.shared.reset()
                HomeModel.shared.reset()
            }
        }
    }

    private func present(
        _ screen: String, on presenter: UIViewController, build: String = "dev",
        userAgent: String = "", state: [String: Any] = [:]
    ) {
        // "calendars:accounts" in a test launch: the sheet on one of its screens.
        let parts = screen.split(separator: ":", maxSplits: 1).map(String.init)
        let screen = parts.first ?? screen
        var state = state
        if parts.count > 1 { state["start"] = parts[1] }
        let onChoose: (String, String) -> Void = { [weak self] lang, theme in
            _ = self
            NativePreferences.shared.lang = lang
            NativePreferences.shared.theme = theme
            AppSession.shared.keepLanguage()
        }
        let onDone: () -> Void = { [weak self] in self?.dismissOpenScreen() }
        let enablePush: () async -> String = { [weak self] in
            await self?.enablePush() ?? "failed"
        }
        let leave: (LeavingProfile) -> Void = { [weak self] leaving in
            switch leaving {
            case .webScreen(let address):
                self?.dismissOpenScreen(["next": address])
            case .signOut:
                self?.dismissOpenScreen(["signOut": true])
            case .joined:
                self?.dismissOpenScreen(["joined": true])
            case .accountDeleted:
                self?.dismissOpenScreen(["accountDeleted": true])
            case .added(let start):
                self?.dismissOpenScreen(["added": start])
            case .plan:
                self?.dismissOpenScreen(["plan": true])
            case .findDates:
                self?.showPile()
            }
        }
        // A sheet as tall as what is in it (the trip's, #281), told by the screen.
        let fit = SheetFit()
        let root: AnyView =
            screen == "calendars"
            ? AnyView(calendarsSheet(state, onDone: onDone, leave: leave))
            : screen == "tell"
            ? AnyView(
                TellSheet(preferences: NativePreferences.shared, onDone: onDone, leave: leave)
                    .environment(\.growSheet) { [weak self] in self?.growOpenSheet() })
            : screen == "trip"
            ? AnyView(
                tripSheet(state, onDone: onDone)
                    .environment(\.fitSheet) { [weak self] height in self?.fitOpenSheet(height, fit) })
            : screen == "aiConsent"
            ? AnyView(
                AiConsentSheet(leave: leave, yes: onDone, close: onDone)
                    .nativeSheetLook(NativePreferences.shared)
                    .environment(\.fitSheet) { [weak self] height in self?.fitOpenSheet(height, fit) })
            : screen == "push"
            ? AnyView(
                PushAskSheet(
                    preferences: NativePreferences.shared, reason: state["reason"] as? String ?? "sent",
                    enablePush: enablePush, onDone: onDone
                )
                .environment(\.fitSheet) { [weak self] height in self?.fitOpenSheet(height, fit) })
            : screen == "invitePaste"
            ? AnyView(
                InvitePasteSheet(
                    preferences: NativePreferences.shared, found: state["found"] as? Bool == true,
                    open: { [weak self] path in self?.dismissOpenScreen(["next": path]) }, onCancel: onDone
                )
                .environment(\.fitSheet) { [weak self] height in self?.fitOpenSheet(height, fit) })
            : screen == "join"
            ? AnyView(
                JoinScreen(
                    // "join:<token>" in a test launch: a test's made-up login is signed in.
                    preferences: NativePreferences.shared, token: state["token"] as? String ?? state["start"] as? String ?? "",
                    signedIn: state["signedIn"] as? Bool ?? Self.testSignedIn, autoJoin: state["autoJoin"] as? Bool == true,
                    onChoose: onChoose,
                    finish: { [weak self, state] outcome in
                        switch outcome {
                        case .joined: self?.dismissOpenScreen(["joined": true])
                        case .group(let id): self?.dismissOpenScreen(["group": id])
                        case .signUp:
                            let token = state["token"] as? String ?? state["start"] as? String ?? ""
                            self?.dismissOpenScreen(["signUp": true, "path": "/join/\(token)"])
                        case .home: self?.dismissOpenScreen(["next": "/"])
                        }
                    }))
            : screen == "friend"
            ? AnyView(
                FriendLinkScreen(
                    preferences: NativePreferences.shared, token: state["token"] as? String ?? state["start"] as? String ?? "",
                    signedIn: state["signedIn"] as? Bool ?? Self.testSignedIn, autoAdd: state["autoAdd"] as? Bool == true,
                    onChoose: onChoose,
                    finish: { [weak self, state] outcome in
                        switch outcome {
                        case .added: self?.dismissOpenScreen(["friendAdded": true])
                        case .signUp:
                            let token = state["token"] as? String ?? state["start"] as? String ?? ""
                            self?.dismissOpenScreen(["signUp": true, "path": "/friend/\(token)"])
                        case .home: self?.dismissOpenScreen(["next": "/"])
                        }
                    }))
            : screen == "welcome"
            ? AnyView(
                WelcomeScreen(
                    preferences: NativePreferences.shared, startOn: state["signIn"] as? String,
                    signedIn: { [weak self] in self?.dismissOpenScreen(["signedIn": true]) },
                    openInvite: { [weak self] path in self?.dismissOpenScreen(["next": path]) }, onChoose: onChoose,
                    leave: leave))
            : screen == "signIn"
            ? AnyView(
                SignInScreen(
                    preferences: NativePreferences.shared, signup: state["signup"] as? Bool == true, onClose: onDone,
                    signedIn: { [weak self] in self?.dismissOpenScreen(["signedIn": true]) }, onChoose: onChoose,
                    leave: leave
                )
                .nativeSheetLook(NativePreferences.shared))
            : screen == "update"
            ? AnyView(
                UpdateRequiredScreen(
                    preferences: NativePreferences.shared,
                    storeURL: (state["storeUrl"] as? String).flatMap(URL.init(string:))))
            : screen == "prime"
            ? AnyView(
                PrimeDateSheet(
                    preferences: NativePreferences.shared, prime: Self.decode(PrimeDate.self, state["prime"]) ?? Self.testPrime,
                    onDone: onDone, leave: leave
                )
                .environment(\.fitSheet) { [weak self] height in self?.fitOpenSheet(height, fit) })
            : screen == "plan"
            ? AnyView(
                Self.planSheet(
                    Self.decode(PrimeDate.self, state["prime"]) ?? Self.testPrime, keep: state["keep"] as? Bool == true,
                    onDone: { [weak self] in
                        // A vote searched again goes back to the vote (#240).
                        if PlanModel.shared.again != nil { self?.backToVote() } else { onDone() }
                    },
                    leave: leave, onFind: { [weak self] in self?.showPile() }))
            : screen == "events"
            ? AnyView(
                EventsSheet(
                    preferences: NativePreferences.shared, onDone: onDone, leave: leave, vote: state["vote"] as? String))
            : screen == "profile"
            ? AnyView(
                ProfileScreen(
                    preferences: NativePreferences.shared, build: build, userAgent: userAgent,
                    onChoose: onChoose, onDone: onDone, enablePush: enablePush, leave: leave,
                    start: ProfileStart(state["start"] as? String)))
            : AnyView(
                SettingsScreen(
                    preferences: NativePreferences.shared, onChoose: onChoose, onDone: onDone,
                    enablePush: enablePush))
        // Sign-in's colour is light in either theme: the clock over it stays dark, as on the web.
        let host = screen == "signIn" ? DarkStatusHost(rootView: root) : UIHostingController(rootView: root)
        // The sheet's frame and its glass at half height are iOS's, outside
        // SwiftUI: tell it Casy's own light or dark, not only the phone's.
        let theme = NativePreferences.shared.theme
        host.overrideUserInterfaceStyle = theme == "dark" ? .dark : theme == "light" ? .light : .unspecified
        if screen == "update" {
            // Over everything, with no way out but the App Store.
            host.modalPresentationStyle = .fullScreen
            host.isModalInPresentation = true
        } else if screen == "join" || screen == "friend" {
            // A page of its own, as the web's: what the link leads to, and the one answer.
            host.modalPresentationStyle = .fullScreen
            host.modalTransitionStyle = .crossDissolve
        } else if screen == "welcome" {
            // The way in: nothing to swipe away, the page under it has nothing to show.
            host.modalPresentationStyle = .fullScreen
            host.modalTransitionStyle = .crossDissolve
            host.isModalInPresentation = true
        } else if screen == "signIn" {
            // The welcome's colour fills the screen, as on the web; Tilbage closes it.
            host.modalPresentationStyle = .fullScreen
            host.modalTransitionStyle = .crossDissolve
        } else {
            host.modalPresentationStyle = .pageSheet
            host.sheetPresentationController?.prefersGrabberVisible = true
        }
        // The push ask leads only to iOS's question: no swipe puts it away.
        if screen == "push" { host.isModalInPresentation = true }
        // The small asks, as the web's: half the screen, larger if the text needs it.
        // The plus, too, as the web's small box: whole once Casy has answered.
        // Profil, as the web's stacked BottomSheet (h-[85dvh], #169): 85 % of the
        // screen, the calendar still showing above it; below full height, iOS 26
        // draws the sheet in its own glass, as the web imitates (#281).
        // Aftaler and Kalendere too: the web's EventsSheet and CalendarsSheet
        // are the same stacked BottomSheet.
        // Tilføj til kalender in the same glass (#281): half height, then the
        // 85 % once there is an answer (`growOpenSheet`), never whole, where
        // iOS would draw the sheet solid.
        if ["profile", "events", "calendars", "tell", "plan"].contains(screen) {
            // Nothing painted over the glass: the hosting view's own white hid it.
            host.view.backgroundColor = .clear
            let height = presenter.view.window?.bounds.height ?? presenter.view.bounds.height
            let stacked = UISheetPresentationController.Detent.custom(identifier: Self.stacked) { context in
                min(context.maximumDetentValue, height * 0.85)
            }
            host.sheetPresentationController?.detents = screen == "tell" ? [.medium(), stacked] : [stacked]
        }
        // A trip's sheet, as the web's BottomSheet: as tall as what is in it,
        // in iOS's glass, never whole (where iOS would draw it solid).
        if ["trip", "prime", "aiConsent", "push", "invitePaste"].contains(screen) {
            host.view.backgroundColor = .clear
            host.sheetPresentationController?.detents = [
                .custom(identifier: .init("casy.fit")) { context in
                    min(context.maximumDetentValue - 1, fit.height)
                }
            ]
        }
        // A swipe down closes it too: tell the web either way.
        host.presentationController?.delegate = self
        openScreen = screen
        presenter.present(host, animated: true)
    }

    /// Kalendere, with what the page keeps on this phone.
    private func calendarsSheet(
        _ state: [String: Any], onDone: @escaping () -> Void, leave: @escaping (LeavingProfile) -> Void
    ) -> some View {
        CalendarsModel.shared.begin(
            holidaysHidden: state["holidaysHidden"] as? Bool ?? false,
            tourSeen: state["tourSeen"] as? [String] ?? [],
            thisPhone: state["thisPhone"] as? String, connect: state["connect"] as? String)
        let start: CalendarsPage? =
            switch state["start"] as? String {
            case "accounts": .accounts
            case "tour": .tour
            default: nil
            }
        return CalendarsSheet(
            preferences: NativePreferences.shared, start: start, connect: state["connect"] as? String,
            onDone: onDone, leave: leave)
    }

    /// The trip sheet, on the trip the page sent (or a test's own).
    private func tripSheet(_ state: [String: Any], onDone: @escaping () -> Void) -> some View {
        let model = TripModel.shared
        model.mark = nil
        model.addedTo = nil
        model.failure = nil
        model.show(Self.decodeMark(state["mark"]))
        #if DEBUG
            if let sample = TestLaunch.trip { model.show(sample) }
        #endif
        return TripSheet(preferences: NativePreferences.shared, onDone: onDone)
    }

    private static func decodeMark(_ object: Any?) -> TripMark? { decode(TripMark.self, object) }

    /// Planlæg, begun from a starred day when the page sends one (#171),
    /// else the plan as it was left.
    /// `keep`: back from the pile (Ret planen), the plan as it was there.
    @MainActor private static func planSheet(
        _ prime: PrimeDate?, keep: Bool, onDone: @escaping () -> Void, leave: @escaping (LeavingProfile) -> Void,
        onFind: @escaping () -> Void
    ) -> PlanSheet {
        if keep {
        } else if let prime {
            PlanModel.shared.begin(prime: prime)
        } else {
            PlanModel.shared.forgetStart()
        }
        return PlanSheet(preferences: NativePreferences.shared, onDone: onDone, leave: leave, onFind: onFind)
    }

    private static var testPrime: PrimeDate? {
        #if DEBUG
            TestLaunch.prime
        #else
            nil
        #endif
    }

    /// What the page sent as a JSON object, read as `type`.
    private static func decode<T: Decodable>(_ type: T.Type, _ object: Any?) -> T? {
        guard let object, JSONSerialization.isValidJSONObject(object),
            let data = try? JSONSerialization.data(withJSONObject: object)
        else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }

    private static func tripAction(_ action: TripAction) -> [String: Any] {
        switch action {
        case .accept(let id): ["action": "accept", "id": id]
        case .decline(let id): ["action": "decline", "id": id]
        case .home(let city): ["action": "home", "city": city]
        case .returned(let id, let day): ["action": "return", "id": id, "day": day]
        case .left(let id, let day): ["action": "outbound", "id": id, "day": day]
        case .addToCalendar(let id): ["action": "addToCalendar", "id": id]
        }
    }

    /// The native home over the web view, while the switch is on, the page is
    /// on its home page and nothing only the page draws is over the month.
    private var homeHost: UIHostingController<HomeScreen>?
    /// The paper pile is up: it is thrown onto the native home page (#282), so that stays
    /// shown though the page still counts its Planlæg as over the month (`covered`).
    @MainActor private var pileUp = false {
        didSet {
            guard pileUp != oldValue else { return }
            if oldValue { holdHome() }
            placeHome()
        }
    }
    /// The pile on the screen now, for Ret planen to put Planlæg's sheet over.
    private weak var pileHost: UIViewController?
    /// Planlæg or the pile just gone: the native home page stays until the page says its
    /// Planlæg is no longer over it, else the page's own home page flickered between.
    private var homeHeld = false
    private var holdEnds: DispatchWorkItem?

    /// Planlæg on its way: the native home page stays until its sheet is up (or 2 s).
    private var planPending = false

    private func planComing() {
        planPending = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
            guard let self, self.planPending else { return }
            self.planPending = false
            self.placeHome()
        }
    }

    private func holdHome() {
        homeHeld = true
        holdEnds?.cancel()
        let ends = DispatchWorkItem { [weak self] in
            self?.homeHeld = false
            self?.placeHome()
        }
        holdEnds = ends
        DispatchQueue.main.asyncAfter(deadline: .now() + 2, execute: ends)
    }

    @MainActor private func placeHome() {
        let page = HomeModel.shared.page
        // The page counts its Planlæg as over the month; the app's own Planlæg sheet and pile
        // are over the native home page, which stays: else the page's own home page showed
        // under them, its buttons and rows a little off.
        let wanted = NativeHome.on && page.shown && (!page.covered || pileUp || homeHeld || planPending || openScreen == "plan")
        guard let main = root else { return }
        if wanted && homeHost == nil {
            let host = UIHostingController(rootView: HomeScreen(preferences: NativePreferences.shared))
            host.view.backgroundColor = .clear
            main.addChild(host)
            host.view.translatesAutoresizingMaskIntoConstraints = false
            main.view.addSubview(host.view)
            NSLayoutConstraint.activate([
                host.view.topAnchor.constraint(equalTo: main.view.topAnchor),
                host.view.bottomAnchor.constraint(equalTo: main.view.bottomAnchor),
                host.view.leadingAnchor.constraint(equalTo: main.view.leadingAnchor),
                host.view.trailingAnchor.constraint(equalTo: main.view.trailingAnchor),
            ])
            host.didMove(toParent: main)
            homeHost = host
        }
        homeHost?.view.isHidden = !wanted
        // Casy's own light or dark, which the page may choose apart from the phone's.
        let theme = NativePreferences.shared.theme
        homeHost?.overrideUserInterfaceStyle = theme == "dark" ? .dark : theme == "light" ? .light : .unspecified
        if wanted { HomeModel.shared.loadIfNeeded() }
        if !NativeHome.on, let host = homeHost {
            host.willMove(toParent: nil)
            host.view.removeFromSuperview()
            host.removeFromParent()
            homeHost = nil
        }
    }

    /// The phone's calendar written: by the app's own sync where it sends the phone's
    /// calendars, else by the page's (usePhoneCalendarSync), waited for up to 15 seconds.
    @MainActor private func writeOnPhone() async {
        // The app sends the phone's calendars itself (#282): its sync carries out the writes after.
        guard PhoneSyncWork.on else { return }
        _ = await PhoneSyncWork.shared.sync(create: false)
    }

    /// Turned on by the app itself (#202), or else by the web view, where the phone's token reaches only the page.
    @MainActor private func enablePush() async -> String {
        if PushWork.on { return await PushWork.shared.enable() }
        #if DEBUG
            // A test launch without the app's push work: its made-up answer.
            if let answer = TestLaunch.pushAnswer { return answer }
        #endif
        return "failed"
    }

    /// `then` goes with `closed`: what the page does next, as one message, so
    /// it can't step the address back before hearing where to go.
    /// The open sheet, if half height, pulled up to the whole screen.
    /// The open sheet as tall as `height` (its bar and content, the screen's
    /// own measure), up to just short of the whole screen.
    private func fitOpenSheet(_ height: CGFloat, _ fit: SheetFit) {
        guard abs(fit.height - height) > 0.5 else { return }
        fit.height = height
        guard let sheet = root?.presentedViewController?.sheetPresentationController else {
            return
        }
        sheet.animateChanges { sheet.invalidateDetents() }
    }

    /// The 85 % sheet's detent, below full height so iOS keeps its glass.
    private static let stacked = UISheetPresentationController.Detent.Identifier("casy.stacked")

    /// The open sheet as tall as it goes: the 85 % where it has it, else whole.
    private func growOpenSheet() {
        guard let sheet = root?.presentedViewController?.sheetPresentationController else {
            return
        }
        let tallest: UISheetPresentationController.Detent.Identifier =
            sheet.detents.contains { $0.identifier == Self.stacked } ? Self.stacked : .large
        guard sheet.selectedDetentIdentifier != tallest else { return }
        sheet.animateChanges { sheet.selectedDetentIdentifier = tallest }
    }

    /// Planlæg's Find dato (#282): the sheet goes, and the paper pile takes the
    /// whole screen over the home page. Ret planen brings the sheet back, the
    /// plan as it was; closing or sending ends Planlæg, which the page hears.
    private func showPile() {
        guard let presenter = root else { return }
        // Ret planen's sheet over the pile: it goes, and the pile plays again where it is,
        // from the month it was on (scrolled on only if the dates' month changed).
        if let pile = pileHost, pile.presentingViewController != nil, pile.presentedViewController != nil {
            pile.dismiss(animated: true) { PileModel.shared.start() }
            return
        }
        // Everything over the page goes (a vote's own plan sits on Aftaler, #240).
        presenter.dismiss(animated: true) { [weak self] in
            guard let self else { return }
            // Cleared first: its first frame would otherwise be the last pile.
            PileModel.shared.reset()
            self.pileUp = true
            let pile = PileScreen(
                onChange: { [weak self] in
                    // Planlæg's sheet up over the ranked list, the plan as it was.
                    guard let self, let pile = self.pileHost else { return }
                    self.present("plan", on: pile, state: ["keep": true])
                },
                onClose: { [weak self] in
                    self?.pileUp = false
                    HomeModel.shared.backToToday()
                    if PlanModel.shared.again != nil { self?.backToVote() } else { self?.dismissOpenScreen() }
                },
                onSent: { [weak self] in
                    self?.pileUp = false
                    HomeModel.shared.backToToday()
                    if PlanModel.shared.again != nil {
                        // The vote has its new dates: Aftaler's list fetched again.
                        Task { await EventsModel.shared.load() }
                        self?.backToVote()
                    } else {
                        self?.dismissOpenScreen(["sent": true])
                    }
                }
            )
            .nativeSheetLook(NativePreferences.shared)
            let host = UIHostingController(rootView: AnyView(pile))
            let theme = NativePreferences.shared.theme
            host.overrideUserInterfaceStyle = theme == "dark" ? .dark : theme == "light" ? .light : .unspecified
            host.modalPresentationStyle = .overFullScreen
            host.modalTransitionStyle = .crossDissolve
            // The home page under it shows until the pile has been worked out.
            host.view.backgroundColor = .clear
            self.pileHost = host
            presenter.present(host, animated: true)
        }
    }

    /// Done searching a vote again (#240): Planlæg closes back onto the vote,
    /// in Aftaler as it was, and the plan is as it was before.
    private func backToVote() {
        guard let presenter = root, let id = PlanModel.shared.again?.eventId else { return }
        PlanModel.shared.endAgain()
        let reopen = { [weak self] in self?.present("events", on: presenter, state: ["vote": id]) }
        if presenter.presentedViewController != nil {
            presenter.dismiss(animated: true) { reopen() }
        } else {
            reopen()
        }
    }

    private func dismissOpenScreen(_ then: [String: Any] = [:]) {
        // Planlæg cancelled over the pile: the pile goes with it, the home page back to today.
        if pileUp {
            pileUp = false
            HomeModel.shared.backToToday()
        }
        root?.presentedViewController?.dismiss(animated: true) { [weak self] in
            self?.closed(then)
        }
    }

    public func presentationControllerDidDismiss(
        _ presentationController: UIPresentationController
    ) {
        // Ret planen's sheet swiped away over the pile: back to the ranked list.
        if openScreen == "plan", pileUp, pileHost?.presentingViewController != nil {
            return
        }
        // A vote searched again, its plan swiped away: back onto the vote.
        if openScreen == "plan", PlanModel.shared.again != nil {
            backToVote()
            return
        }
        closed()
    }

    private func closed(_ then: [String: Any] = [:]) {
        guard let screen = openScreen else { return }
        openScreen = nil
        if openProfileOn(then) { return }
        closedHere(screen, then)
        // Signed out: whatever closed, the welcome is what is left.
        if welcomeUp {
            DispatchQueue.main.async {
                if self.openScreen == nil, self.welcomeUp { self.showPageFree(signedIn: false) }
            }
        }
    }

    // MARK: The app's own routing (#202)

    /// An invite to a group you are in, a friend link said yes to: Profil, on
    /// that group or Venner, whoever opened the screen before it.
    private func openProfileOn(_ then: [String: Any]) -> Bool {
        guard let presenter = root, Self.nativeScreens.contains("profile") else { return false }
        let start: ProfileStart
        if let group = then["group"] as? String {
            start = .group(group)
        } else if then["friendAdded"] as? Bool == true {
            start = .friends
        } else {
            return false
        }
        let state: [String: Any] = ["start": start.text]
        present("profile", on: presenter, build: pageBuild, userAgent: pageUserAgent, state: state)
        return true
    }

    /// What the page last said about itself, for Profil's build line and feedback mail.
    private var pageBuild = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "dev"
    private var pageUserAgent = ""
    /// The star a Tid til hinanden sheet opened here is about: its Planlæg begins from it.
    private var openedPrime: Any?

    private func open(path: String) -> Bool {
        guard let route = appRoute(path), let presenter = root, openScreen == nil,
            NativeHome.on, HomeModel.shared.page.shown
        else { return false }
        func sheet(_ screen: String, _ state: [String: Any]) -> Bool {
            guard Self.nativeScreens.contains(screen) else { return false }
            present(screen, on: presenter, build: pageBuild, userAgent: pageUserAgent, state: state)
            return true
        }
        switch route {
        case .home:
            return true
        case .events(let id):
            return sheet("events", id.map { ["vote": $0] } ?? [:])
        case .vote(let id):
            // Still waiting for your answer: answered over the month; else its screen in Aftaler.
            if HomeModel.ownData, waitingVotes(EventsModel.shared.events ?? [], now: Native.now).contains(where: { $0.id == id }) {
                HomeModel.shared.voteToOpen = id
                return true
            }
            return sheet("events", ["vote": id])
        case .join(let token):
            return sheet("join", ["token": token, "signedIn": true])
        case .friend(let token):
            return sheet("friend", ["token": token, "signedIn": true])
        case .profile(let start):
            return sheet("profile", ["start": start])
        case .settings:
            return sheet("settings", [:])
        }
    }

    /// The home page's sheets made ready once it has settled (#202): what each loads
    /// as it opens fetched now, and each screen laid out once off screen, so the
    /// first press opens it as quickly as every later one.
    private var sheetsReady = false
    private func makeSheetsReady() {
        guard !sheetsReady, NativeHome.on else { return }
        sheetsReady = true
        Task { @MainActor in
            async let profile: Void = ProfileModel.shared.load()
            async let calendars: Void = CalendarsModel.shared.data == nil ? CalendarsModel.shared.load() : ()
            async let groups: Void = PlanModel.shared.groups == nil ? PlanModel.shared.loadGroups() : ()
            ShortcutsModel.shared.loadAhead()
            _ = await (profile, calendars, groups)
        }
        let none: (LeavingProfile) -> Void = { _ in }
        let prefs = NativePreferences.shared
        let screens: [AnyView] = [
            AnyView(EventsSheet(preferences: prefs, onDone: {}, leave: none)),
            AnyView(
                ProfileScreen(
                    preferences: prefs, build: pageBuild, userAgent: pageUserAgent, onChoose: { _, _ in }, onDone: {},
                    enablePush: { "failed" }, leave: none)),
            AnyView(CalendarsSheet(preferences: prefs, start: nil, connect: nil, onDone: {}, leave: none)),
            AnyView(TellSheet(preferences: prefs, onDone: {}, leave: none)),
            AnyView(PlanSheet(preferences: prefs, onDone: {}, leave: none)),
        ]
        // One at a time, a frame or so apart, so the home page never stutters for it.
        Task { @MainActor in
            for view in screens {
                try? await Task.sleep(for: .milliseconds(250))
                let host = UIHostingController(rootView: view)
                _ = host.sizeThatFits(in: UIScreen.main.bounds.size)
            }
        }
    }

    /// A home page press the app answers with its own sheet; false leaves it to the page.
    private func route(_ action: String, _ day: Int64?) -> Bool {
        // The moments the app asks at (#202): a vote's last answer, an agreed date landed.
        if Asks.on && action == "answered" {
            Asks.shared.push("answered")
            return true
        }
        if Asks.on && action == "landed" {
            Asks.shared.review(in: root?.view.window?.windowScene)
            return true
        }
        guard Self.nativeScreens.contains(action), let presenter = root, openScreen == nil else {
            return false
        }
        var state: [String: Any] = [:]
        switch action {
        case "events", "plan", "profile", "tell":
            break
        case "calendars":
            let home = HomeModel.shared
            state["holidaysHidden"] = home.holidaysHidden
            state["tourSeen"] = Array(home.tourSeen)
            if let phone = LabelsWork.shared.thisPhone { state["thisPhone"] = phone }
        case "prime":
            guard let day, let star = HomeStars.shared.star(on: day), let data = try? JSONEncoder().encode(star),
                let object = try? JSONSerialization.jsonObject(with: data)
            else { return false }
            state["prime"] = object
            openedPrime = object
        default:
            return false
        }
        present(action, on: presenter, build: pageBuild, userAgent: pageUserAgent, state: state)
        return true
    }

    /// A sheet the app opened has closed: what it asks for next, done here where the app
    /// can (the month to what was added, Planlæg from a star); the rest is still the
    /// page's (signing out, a page it draws, the notifications' ask), told with `leave`.
    private func closedHere(_ screen: String, _ then: [String: Any]) {
        let prime = openedPrime
        openedPrime = nil
        if let added = then["added"] as? String, let start = parseInstant(added) {
            HomeModel.shared.focus = startOfMonth(start, appTimeZone)
            // What was added drawn at once: the calendar read again (the page did it before, #202).
            DayOfCalendar.forgetDays()
            Task { await HomeModel.shared.load() }
            return
        }
        // Hjem from an invite or a friend link: the home page is under it already.
        if then["next"] as? String == "/" { return }
        if then["plan"] as? Bool == true, let presenter = root {
            present("plan", on: presenter, build: pageBuild, userAgent: pageUserAgent, state: prime.map { ["prime": $0] } ?? [:])
            return
        }
        // Aftaler's ways on (#202): a vote answered over the month, Planlæg, a day's view.
        if let next = then["next"] as? String {
            let query = next.hasPrefix("/?") ? String(next.dropFirst(2)) : ""
            let parts = query.split(separator: "=", maxSplits: 1).map(String.init)
            switch parts.first {
            case "vote" where parts.count == 2:
                HomeModel.shared.voteToOpen = parts[1]
                return
            case "plan" where parts.count == 1:
                if let presenter = root {
                    present("plan", on: presenter, build: pageBuild, userAgent: pageUserAgent)
                    return
                }
            case "day" where parts.count == 2:
                let ymd = parts[1].split(separator: "-").compactMap { Int($0) }
                if ymd.count == 3 {
                    HomeModel.shared.dayToOpen = wallTime(ymd[0], ymd[1] - 1, ymd[2], 0, appTimeZone)
                    return
                }
            default: break
            }
        }
        if then.isEmpty { return }
        pageFreeLeave(then)
    }

    // MARK: Without the page (#202)

    /// What a sheet closed with that the page would have done, done by the app;
    /// what it can't do yet is logged, the page's last jobs found that way.
    private func pageFreeLeave(_ then: [String: Any]) {
        #if DEBUG
            NSLog("PageFree: closed with %@ (invite waiting: %@)", "\(then)", pendingInvite ?? "none")
        #endif
        // Bliv medlem signed out: the account first, the invite kept for after (the web's `?join=1`).
        if then["signUp"] as? Bool == true, let path = then["path"] as? String,
            let presenter = root
        {
            pendingInvite = path
            present("signIn", on: presenter, build: pageBuild, userAgent: pageUserAgent, state: ["signup": true])
            return
        }
        if let next = then["next"] as? String, openInviteWithoutPage(next) { return }
        if then["signOut"] as? Bool == true {
            Task { _ = await AppSession.shared.signOut() }
        } else if then["accountDeleted"] as? Bool == true {
            AppSession.shared.forget()
        } else if then["joined"] as? Bool == true {
            Asks.shared.push("joined")
        } else if then["sent"] != nil {
            Asks.shared.push("sent")
        } else if then["signedIn"] as? Bool == true {
            // AppSession has it already; an invite said yes to before the account, carried out now.
            if let invite = pendingInvite {
                pendingInvite = nil
                _ = openInviteWithoutPage(invite, auto: true)
            }
        } else {
            NSLog("PageFree: the page would have done %@", "\(then)")
        }
    }

    /// The app on its own: the login the
    /// app's (AppSession), the native home always on, the welcome when signed out.
    @MainActor private func startPageFree() {
        NativePreferences.shared.applyTheme()
        if let endpoint = ProjectEndpoint.current {
            Task { await SessionBox.shared.setEndpoint(endpoint.url, apiKey: endpoint.apiKey) }
        }
        // A call that finds the login stale asks the app for a fresh one, not the page.
        Task {
            await SessionBox.shared.setAskWeb {
                Task { @MainActor in _ = await AppSession.shared.refresh() }
            }
        }
        AppSession.shared.changed = { [weak self] session in
            guard let self else { return }
            let connection = session.flatMap { s in
                ProjectEndpoint.current.map {
                    SessionBox.Connection(
                        projectURL: $0.url, apiKey: $0.apiKey, accessToken: s.accessToken, expiresAt: s.expiresAt,
                        userId: s.user.id, email: s.user.email)
                }
            }
            let userBefore = HomeModel.shared.page.shown
            Task { @MainActor in
                let wasSomeone = await SessionBox.shared.current()?.userId
                if wasSomeone != connection?.userId || connection == nil || !userBefore {
                    await self.apply(connection)
                } else {
                    // Only refreshed: the same person, a new token.
                    await SessionBox.shared.set(connection)
                }
                self.showPageFree(signedIn: connection != nil)
            }
        }
        PageFreeLinks.openSignedOut = { [weak self] path in
            guard let self, self.welcomeUp else { return false }
            return self.openInviteWithoutPage(path)
        }
        #if DEBUG
            // A test's made-up login is signed in already (startTestLaunch); only a signed-out
            // test (`-casyPageAuth YES`) has the app's own login, or none and the welcome.
            if TestLaunch.isActive, !TestLaunch.signedOut {
                UpdateCheck.shared.show = { [weak self] store in self?.showUpdate(store) }
                UpdateCheck.shared.start()
                return
            }
        #endif
        AppSession.shared.start()
        UpdateCheck.shared.show = { [weak self] store in self?.showUpdate(store) }
        UpdateCheck.shared.start()
    }

    /// "Opdater appen" over everything, whatever was open (#143): nothing else is usable now.
    @MainActor private func showUpdate(_ store: URL?) {
        guard let presenter = root else { return }
        let state: [String: Any] = store.map { ["storeUrl": $0.absoluteString] } ?? [:]
        let up = { [weak self] in
            guard let self else { return }
            self.openScreen = nil
            self.present("update", on: presenter, build: self.pageBuild, userAgent: self.pageUserAgent, state: state)
        }
        if presenter.presentedViewController != nil {
            presenter.dismiss(animated: false, completion: up)
        } else {
            up()
        }
    }

    /// Signed in, the app's home page; signed out, the welcome over everything.
    @MainActor private func showPageFree(signedIn: Bool) {
        #if DEBUG
            NSLog("PageFree: signed %@, %@ open", signedIn ? "in" : "out", openScreen ?? "nothing")
        #endif
        welcomeUp = !signedIn
        var page = HomeModel.shared.page
        page.shown = signedIn
        page.covered = false
        if page != HomeModel.shared.page { HomeModel.shared.update(page) }
        placeHome()
        guard let presenter = root else { return }
        if !signedIn {
            guard openScreen == nil else { return }
            // A link that came before the login was read: its screen instead of the welcome.
            if let waiting = PushWork.shared.takeWaiting(), openInviteWithoutPage(waiting) { return }
            present("welcome", on: presenter, build: pageBuild, userAgent: pageUserAgent)
        } else if openScreen == "welcome" || openScreen == "signIn",
            presenter.presentedViewController?.isBeingDismissed != true
        {
            // Signed in from it (Apple's sheet, or the sign-in screen's own close not yet sent):
            // closed as signed in, so an invite said yes to before is carried out.
            dismissOpenScreen(["signedIn": true])
        }
    }

    /// Without the page, signed out: the welcome is (or will be) what is under everything.
    private var welcomeUp = false
    /// Without the page: an invite or friend link said yes to before there was an account.
    private var pendingInvite: String?

    /// Without the page: an invite's or a friend link's own screen, as the
    /// signed-in or signed-out person sees it; `auto` carries out the yes said
    /// before making the account. False for any other address.
    @MainActor private func openInviteWithoutPage(_ path: String, auto: Bool = false) -> Bool {
        guard let route = appRoute(path), let presenter = root else { return false }
        let signedIn = AppSession.shared.session != nil
        let screen: String
        let state: [String: Any]
        switch route {
        case .join(let token): (screen, state) = ("join", ["token": token, "signedIn": signedIn, "autoJoin": auto])
        case .friend(let token): (screen, state) = ("friend", ["token": token, "signedIn": signedIn, "autoAdd": auto])
        default: return false
        }
        #if DEBUG
            NSLog("PageFree: %@ opened, signed %@", path, signedIn ? "in" : "out")
        #endif
        let show = { [weak self] in
            guard let self else { return }
            self.present(screen, on: presenter, build: self.pageBuild, userAgent: self.pageUserAgent, state: state)
        }
        if let shown = presenter.presentedViewController {
            // The welcome (or sign-in) steps aside; it comes back when the invite closes signed out.
            // Nothing named open: the welcome left behind its paste sheet (closing a screen that
            // shows a sheet closes only the sheet).
            guard openScreen == nil || openScreen == "welcome" || openScreen == "signIn" else { return false }
            openScreen = nil
            shown.dismiss(animated: false, completion: show)
        } else {
            show()
        }
        return true
    }
}

final class SheetFit {
    var height: CGFloat = 420
}

/// A screen whose top is light in either theme (sign-in's colour): the
/// clock and battery over it drawn dark.
final class DarkStatusHost: UIHostingController<AnyView> {
    override var preferredStatusBarStyle: UIStatusBarStyle { .darkContent }
}
