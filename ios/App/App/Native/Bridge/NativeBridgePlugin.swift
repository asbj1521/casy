import Capacitor
import CasyCore
import CasyUI
import SwiftUI
import UIKit

/// The bridge between the web view and the app's native screens (#192, #198).
///
/// Until the home page is native (Phase 6), the web view keeps the login, the
/// address and the cached data, and native screens borrow what they need:
/// `setSession`, `setPreferences`, `screens` (which screens this build draws),
/// `open`. Back to the web: `preferences` when a native screen changed a
/// choice, `closed` when one closes (with where to go next, if anywhere), `dataChanged` when one changed what the page has cached, `inviteSent` when someone was invited to a group, `needSession` for a fresh login, `needPhoneWrite` to write the phone's calendar.
/// Kalendere (#200) opens with what the page keeps on this phone (`open`'s
/// `state`), and answers with `calendarPrefs` when it changes one,
/// `calendarsChanged`, `needPhoneSync` to send the phone's calendars (answered
/// by `phoneSynced`) and `phoneForgotten` when this phone's connection went.
public class NativeBridgePlugin: CAPPlugin, CAPBridgedPlugin,
    UIAdaptivePresentationControllerDelegate
{
    public let identifier = "NativeBridgePlugin"
    public let jsName = "NativeBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "screens", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setPreferences", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pushResult", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "phoneFacts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "phoneWritten", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "phoneSynced", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authAnswered", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setTrip", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openPath", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "askPush", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "forgetPush", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sessionHandedOver", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "enablePushInApp", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "asksFromPage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setHome", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "labelsFromPage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "legsFromPage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "labelCorrected", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearPhoneAi", returnType: CAPPluginReturnPromise),
    ]

    /// The screens drawn natively in this build. None in a Release build: the
    /// Swift rewrite reaches people all at once, as its own update, so until
    /// then App Store releases carry only the web's screens and its fixes.
    private static let nativeScreens: [String] = {
        #if DEBUG
            if TestLaunch.isActive, TestLaunch.webOnly { return [] }
            return [
                "settings", "profile", "events", "calendars", "tell", "trip", "prime", "aiConsent", "push", "update",
                "home", "plan", "signIn", "welcome", "invitePaste", "join",
            ] + (nativeLabels ? ["labels", "dayFacts", "categorize", "tripLegs", "phoneSync", "stars", "votes", "trips", "asks", "notifications"] : [])
        #else
            return []
        #endif
    }()

    /// The background work this build does natively, named in `screens` too so
    /// the page leaves it: the event labels and the day facts made of them
    /// (#282, LabelsWork), the calendars sorted by AI (CategorizeWork) and the
    /// trips' legs read from the labelled journeys (TripsWork), and the phone's
    /// calendars sent with the calendar work after (PhoneSyncWork). Not in a UI
    /// test, whose made-up login has no phone calendars to label.
    static let nativeLabels: Bool = {
        #if DEBUG
            return !TestLaunch.isActive || TestLaunch.seedPhone
        #else
            return false
        #endif
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
            return TestLaunch.isActive && !TestLaunch.pageAuth
        #else
            return false
        #endif
    }
    /// A native screen waiting for the web view to turn notifications on.
    private var pushAnswer: CheckedContinuation<String, Never>?
    /// Native Dine data waiting for the page to count what it keeps on the phone.
    private var factsAnswer: CheckedContinuation<Int, Never>?
    /// Which question `factsAnswer` waits on, so a late timeout can't end a newer one.
    private var factsAsked = 0
    /// A native screen waiting for the page to write the phone's calendar.
    private var writeAnswer: CheckedContinuation<Void, Never>?
    private var writesAsked = 0
    /// Native Kalendere waiting for the page to send the phone's calendars.
    private var syncAnswer: CheckedContinuation<PhoneSyncOutcome, Never>?
    private var syncsAsked = 0

    override public func load() {
        let askWeb: @Sendable () -> Void = { [weak self] in
            self?.notifyListeners("needSession", data: [:])
        }
        Task { await SessionBox.shared.setAskWeb(askWeb) }
        Task { @MainActor [weak self] in
            ProfileModel.shared.onChange = { [weak self] in
                self?.notifyListeners("dataChanged", data: [:])
            }
            GroupsModel.shared.onInviteSent = { [weak self] groupId in
                self?.notifyListeners("inviteSent", data: ["groupId": groupId])
            }
            MyDataModel.shared.onAiConsent = { [weak self] on in
                self?.notifyListeners("aiConsent", data: ["on": on])
            }
            MyDataModel.shared.askLabels = { [weak self] in
                if LabelsWork.on { return LabelsWork.shared.count }
                return await self?.askLabels() ?? 0
            }
            // Sorted calendars: the page's cached ones read again, as when a screen changed them.
            CategorizeWork.shared.changed = { [weak self] in
                self?.notifyListeners("calendarsChanged", data: [:])
            }
            TripsWork.shared.mirror = { [weak self] userId, legs in
                guard let data = try? JSONEncoder().encode(legs),
                    let object = try? JSONSerialization.jsonObject(with: data)
                else { return }
                self?.notifyListeners("legs", data: ["userId": userId, "legs": object])
            }
            LabelsWork.shared.mirror = { [weak self] userId, book in
                guard let data = try? JSONEncoder().encode(book),
                    let labels = try? JSONSerialization.jsonObject(with: data)
                else { return }
                self?.notifyListeners("labels", data: ["userId": userId, "labels": labels])
            }
            EventsModel.shared.writeOnPhone = { [weak self] in
                await self?.writeOnPhone()
            }
            let calendars = CalendarsModel.shared
            calendars.onPrefs = { [weak self] hidden, seen in
                var data: [String: Any] = [:]
                if let hidden { data["holidaysHidden"] = hidden }
                if let seen {
                    data["tourSeen"] = seen
                    HomeModel.shared.rememberTourSeen(seen)
                }
                self?.notifyListeners("calendarPrefs", data: data)
            }
            calendars.onChanged = { [weak self] in
                self?.notifyListeners("calendarsChanged", data: [:])
            }
            calendars.syncPhone = { [weak self] create in
                // The app sends the phone's calendars itself where it does (#282).
                if PhoneSyncWork.on { return await PhoneSyncWork.shared.sync(create: create) }
                return await self?.syncPhone(create: create)
                    ?? PhoneSyncOutcome(state: "failed", error: CasyStrings.phoneSaveFailed)
            }
            calendars.onPhoneForgotten = { [weak self] in
                if PhoneSyncWork.on { PhoneSyncWork.shared.forget() }
                self?.notifyListeners("phoneForgotten", data: [:])
            }
            PhoneSyncWork.shared.connection = { [weak self] userId, connectionId in
                var data: [String: Any] = ["userId": userId]
                if let connectionId { data["connectionId"] = connectionId }
                self?.notifyListeners("phoneConnection", data: data)
            }
            PhoneSyncWork.shared.changed = { [weak self] in
                self?.notifyListeners("calendarsChanged", data: [:])
            }
            TripModel.shared.onAction = { [weak self] action in
                #if DEBUG
                    if TestLaunch.isActive && !HomeTrips.on { return TestLaunch.answer(action) }
                #endif
                // Found by the app itself (#202): answered here; else the page's.
                if HomeTrips.on { return HomeTrips.shared.act(action) }
                self?.notifyListeners("tripAction", data: Self.tripAction(action))
            }
            PageAuth.shared.send = { [weak self] ask in self?.notifyListeners("authAsk", data: ask) }
            // A trip waiting for an answer, tapped on the home month: its sheet.
            HomeModel.shared.openTrip = { [weak self] mark in
                guard let self, let presenter = self.bridge?.viewController, self.openScreen == nil,
                    let data = try? JSONEncoder().encode(mark), let object = try? JSONSerialization.jsonObject(with: data)
                else { return }
                self.openedHere = true
                self.present("trip", on: presenter, state: ["mark": object])
            }
            // An agreed date's chip in the day view: Aftaler, opened on its event.
            HomeModel.shared.openEvent = { [weak self] id in
                guard let self, let presenter = self.bridge?.viewController, self.openScreen == nil else { return }
                self.openedHere = true
                self.present("events", on: presenter, state: ["vote": id])
            }
            // The notifications' sheet when the app decides it is time (#202).
            Asks.shared.showPushAsk = { [weak self] reason in
                guard let self, let presenter = self.bridge?.viewController, self.openScreen == nil else { return false }
                self.openedHere = true
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
            PushWork.shared.openOnPage = { [weak self] path in
                self?.notifyListeners("openPage", data: ["path": path])
            }
            // After every plugin has loaded: the push plugin takes the taps as it loads.
            PushWork.shared.takeTaps(from: self?.bridge)
            // The home page's buttons open the app's own sheets (#202): the page isn't asked.
            HomeModel.shared.route = { [weak self] action, day in
                self?.route(action, day) ?? false
            }
            HomeModel.shared.onAction = { [weak self] action, day in
                // Planlæg pressed: the page counts it as over the month before it asks for
                // the app's own sheet, and its own home page (on this month) flickered in.
                if action == "plan" { self?.planComing() }
                var data: [String: Any] = ["action": action]
                if let day { data["day"] = Double(day) }
                // A star the app found: the stretch goes with it, for its sheet (the page's to open).
                if action == "prime", let day, let star = HomeStars.shared.star(on: day),
                    let encoded = try? JSONEncoder().encode(star),
                    let object = try? JSONSerialization.jsonObject(with: encoded)
                {
                    data["prime"] = object
                }
                self?.notifyListeners("homeAction", data: data)
            }
            NotificationCenter.default.addObserver(
                forName: NativeHome.switched, object: nil, queue: .main
            ) { [weak self] _ in
                MainActor.assumeIsolated { self?.placeHome() }
            }
        }
        // Without its page (#202): once the controller is on screen, the app's own login and home.
        if PageFree.on {
            PageFreeSwitch.run = { [weak self] on in await self?.switchPageFree(on) ?? false }
            Task { @MainActor [weak self] in
                while self?.bridge?.viewController?.view.window == nil { try? await Task.sleep(for: .milliseconds(50)) }
                self?.startPageFree()
            }
        } else {
            PageFreeSwitch.run = { [weak self] on in await self?.switchPageFree(on) ?? false }
        }
        #if DEBUG
            startTestLaunch()
        #endif
    }

    @objc func screens(_ call: CAPPluginCall) {
        call.resolve(["screens": Self.nativeScreens])
    }

    #if DEBUG
        /// The UI tests' way in: a made-up login and a screen open at once.
        private func startTestLaunch() {
            guard let connection = TestLaunch.connection() else { return }
            // Every test starts on one day: the 1/2 day choice is kept on the phone,
            // and a test that left it on two would turn the next test's days by two.
            UserDefaults.standard.removeObject(forKey: "casy.daySpan")
            // Nor did an earlier test's ask count against this one's.
            Asks.shared.forget()
            // No animations under test: a sheet or a push is there at once, and
            // the suite runs in a fraction of the time. A test launch only.
            // `-casyMotion YES` keeps them, for filming a moving part (#281).
            if !UserDefaults.standard.bool(forKey: "casyMotion") { UIView.setAnimationsEnabled(false) }
            Task { @MainActor in
                await SessionBox.shared.set(connection)
                LivePulse.shared.signedIn(connection.userId)
                PushWork.shared.takeTaps(from: self.bridge)
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
                    while bridge?.viewController?.view.window == nil {
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
                // Web only (#280): the page opens its own screen (`-casyWebPath`).
                guard !TestLaunch.webOnly, let screen = TestLaunch.screen else { return }
                // The web view's own controller has to be on screen first.
                while bridge?.viewController?.view.window == nil {
                    try? await Task.sleep(for: .milliseconds(100))
                }
                if let presenter = bridge?.viewController { present(screen, on: presenter) }
            }
        }
    #endif

    /// `{ projectUrl, apiKey, session: { accessToken, expiresAt (epoch s), userId } | null }`.
    @objc func setSession(_ call: CAPPluginCall) {
        #if DEBUG
            if TestLaunch.isActive { return call.resolve() }
        #endif
        var next: SessionBox.Connection?
        if let url = call.getString("projectUrl").flatMap(URL.init(string:)), let apiKey = call.getString("apiKey") {
            Task { await SessionBox.shared.setEndpoint(url, apiKey: apiKey) }
        }
        if let session = call.getObject("session"),
            let url = call.getString("projectUrl").flatMap(URL.init(string:)),
            let apiKey = call.getString("apiKey"),
            let token = session["accessToken"] as? String,
            let expiresAt = session["expiresAt"] as? Double,
            let userId = session["userId"] as? String
        {
            next = SessionBox.Connection(
                projectURL: url, apiKey: apiKey, accessToken: token,
                expiresAt: Date(timeIntervalSince1970: expiresAt), userId: userId,
                email: session["email"] as? String)
        }
        let phone = call.getString("phoneConnection")
        let device = call.getString("deviceId")
        if let url = call.getString("projectUrl").flatMap(URL.init(string:)), let apiKey = call.getString("apiKey") {
            // Kept for the app without its page (#202), which signs in by itself.
            ProjectEndpoint.remember(url, apiKey: apiKey)
        }
        Task {
            await apply(next, phone: phone, device: device)
            call.resolve()
        }
    }

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
            PushWork.shared.takeTaps(from: self.bridge)
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

    /// `{ lang, theme }`: what the web view uses now.
    @objc func setPreferences(_ call: CAPPluginCall) {
        #if DEBUG
            if TestLaunch.isActive { return call.resolve() }
        #endif
        let lang = call.getString("lang")
        let theme = call.getString("theme")
        DispatchQueue.main.async {
            let preferences = NativePreferences.shared
            if let lang { preferences.lang = lang }
            if let theme { preferences.theme = theme }
            self.placeHome()
            call.resolve()
        }
    }

    /// `{ screen, build, userAgent }`: a native screen as a sheet over the page.
    /// The last two are what Send feedback reports, as the page knows them.
    @objc func open(_ call: CAPPluginCall) {
        let screen = call.getString("screen") ?? ""
        let build = call.getString("build") ?? "dev"
        let userAgent = call.getString("userAgent") ?? ""
        let state = call.getObject("state") ?? [:]
        guard Self.nativeScreens.contains(screen) else {
            call.reject("No native screen \(screen)")
            return
        }
        #if DEBUG
            // Under a home test the test plays a signed-in page, as in `setHome`; the
            // real page under it is signed out and would cover the home with the welcome.
            if TestLaunch.isActive && TestLaunch.nativeHome && (screen == "welcome" || screen == "signIn") {
                return call.resolve()
            }
        #endif
        DispatchQueue.main.async {
            guard let presenter = self.bridge?.viewController, self.openScreen == nil else {
                call.reject("Nothing to show the screen on")
                return
            }
            self.pageBuild = build
            self.pageUserAgent = userAgent
            self.present(screen, on: presenter, build: build, userAgent: userAgent, state: state)
            call.resolve()
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
            // Without the page the app applies it itself (#202); with it, the page does and says so back.
            if PageFree.on {
                NativePreferences.shared.lang = lang
                NativePreferences.shared.theme = theme
            }
            self?.notifyListeners("preferences", data: ["lang": lang, "theme": theme])
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
                    finish: { [weak self] outcome in
                        switch outcome {
                        case .joined: self?.dismissOpenScreen(["joined": true])
                        case .group(let id): self?.dismissOpenScreen(["group": id])
                        case .signUp: self?.dismissOpenScreen(["signUp": true])
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
                    onChoose: onChoose, onDone: onDone, enablePush: enablePush, leave: leave))
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
        } else if screen == "join" {
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

    /// `{ mark, addedTo?, error? }`: the trip as the page has it now, after an answer.
    @objc func setTrip(_ call: CAPPluginCall) {
        let mark = Self.decodeMark(call.getObject("mark"))
        let addedTo = call.getString("addedTo")
        let error = call.getString("error")
        DispatchQueue.main.async {
            let model = TripModel.shared
            model.show(mark)
            if let addedTo { model.addedTo = addedTo }
            model.failure = error
            call.resolve()
        }
    }

    /// The home page as the page has it (#201): whether it is shown, whether
    /// something of the page's is over it, and what it adds to the month.
    @objc func setHome(_ call: CAPPluginCall) {
        #if DEBUG
            // Under a UI test the test plays the page; a page signed in on the simulator mustn't.
            if TestLaunch.isActive && TestLaunch.nativeHome { return call.resolve() }
        #endif
        let extrasRaw: Any? = call.getArray("extras")
        let extras: [MonthItem] = Self.decode([MonthItem].self, extrasRaw) ?? []
        let colorsRaw: Any? = call.getObject("colors")
        let colors: [String: String] = colorsRaw as? [String: String] ?? [:]
        let starredRaw: Any? = call.getArray("starred")
        let starredList: [Double] = starredRaw as? [Double] ?? []
        let starred: Set<Int64> = Set(starredList.map { Int64($0) })
        let shown = call.getBool("shown") ?? false
        let covered = call.getBool("covered") ?? false
        let pill = call.getString("pill")
        let tell = call.getBool("tell") ?? false
        let holidaysHidden = call.getBool("holidaysHidden") ?? false
        let tourSeen = call.getArray("tourSeen")?.compactMap { $0 as? String }
        let dataAt = call.getDouble("dataAt") ?? 0
        let importantRaw: Any? = call.getArray("important")
        let important: [LabelledEvent] = Self.decode([LabelledEvent].self, importantRaw) ?? []
        let badgesRaw: [String: Any] = call.getObject("badges") ?? [:]
        let badges = HomeBadges(
            calendars: badgesRaw["calendars"] as? Int ?? 0, events: badgesRaw["events"] as? Int ?? 0,
            profile: badgesRaw["profile"] as? Int ?? 0)
        DispatchQueue.main.async {
            var fresh = HomeFromPage()
            fresh.shown = shown
            fresh.covered = covered
            fresh.extras = extras
            fresh.colors = colors
            fresh.starred = starred
            fresh.pill = pill
            fresh.tell = tell
            fresh.holidaysHidden = holidaysHidden
            fresh.badges = badges
            fresh.important = important
            fresh.dataAt = dataAt
            HomeModel.shared.update(fresh)
            if let tourSeen { HomeModel.shared.rememberTourSeen(tourSeen) }
            // The page has caught up: nothing of its own is over the month any more.
            if !covered { self.homeHeld = false }
            self.placeHome()
            call.resolve()
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
        guard let main = bridge?.viewController else { return }
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
        // The page's own home page is under it, unseen: not for VoiceOver either.
        bridge?.webView?.scrollView.accessibilityElementsHidden = wanted
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

    /// `{ id, outcome }`: how the page's send of the phone's calendars went.
    /// The page's answer to a sign-in step (#282, nativeAuth.ts).
    @objc func authAnswered(_ call: CAPPluginCall) {
        let id = call.getInt("id") ?? 0
        let said = call.getObject("answer") ?? [:]
        let answer = AuthAnswer(
            outcome: said["outcome"] as? String ?? "failed", error: said["error"] as? String,
            unconfirmed: said["unconfirmed"] as? Bool ?? false, count: said["count"] as? Int)
        DispatchQueue.main.async {
            PageAuth.shared.answered(id, answer)
            call.resolve()
        }
    }

    @objc func phoneSynced(_ call: CAPPluginCall) {
        let id = call.getInt("id")
        let outcome = call.getObject("outcome") ?? [:]
        DispatchQueue.main.async {
            if id == self.syncsAsked {
                self.syncAnswer?.resume(
                    returning: PhoneSyncOutcome(
                        state: outcome["state"] as? String ?? "failed",
                        calendars: outcome["calendars"] as? Int ?? 0,
                        busyBlocks: outcome["busyBlocks"] as? Int ?? 0,
                        error: outcome["error"] as? String,
                        connectionId: outcome["connectionId"] as? String))
                self.syncAnswer = nil
            }
            call.resolve()
        }
    }

    /// The phone's calendars are read and sent by the page (usePhoneCalendarSync):
    /// it asks, and waits up to two minutes, iOS's own question included.
    @MainActor private func syncPhone(create: Bool) async -> PhoneSyncOutcome {
        syncAnswer?.resume(returning: PhoneSyncOutcome(state: "failed", error: CasyStrings.phoneSaveFailed))
        syncAnswer = nil
        #if DEBUG
            if TestLaunch.isActive {
                return TestLaunch.phoneSync == "denied"
                    ? PhoneSyncOutcome(state: "denied")
                    : PhoneSyncOutcome(state: "synced", calendars: 2, busyBlocks: 5, connectionId: "c-phone")
            }
        #endif
        return await withCheckedContinuation { continuation in
            syncAnswer = continuation
            syncsAsked += 1
            let asked = syncsAsked
            notifyListeners("needPhoneSync", data: ["id": asked, "create": create])
            Task { @MainActor [weak self] in
                try? await Task.sleep(for: .seconds(120))
                guard let self, self.syncsAsked == asked else { return }
                self.syncAnswer?.resume(
                    returning: PhoneSyncOutcome(state: "failed", error: CasyStrings.phoneSaveFailed))
                self.syncAnswer = nil
            }
        }
    }

    /// `{ userId, labels, corrections }`: the label book the page kept before the
    /// app labelled, handed over once (#282).
    @objc func labelsFromPage(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId") else { return call.resolve() }
        let labels: LabelBook = Self.decode(LabelBook.self, call.getObject("labels")) ?? [:]
        let corrections: [PhoneLabelCorrection] = Self.decode([PhoneLabelCorrection].self, call.getArray("corrections")) ?? []
        DispatchQueue.main.async {
            LabelsWork.shared.adopt(userId, labels: labels, corrections: corrections)
            call.resolve()
        }
    }

    /// `{ userId, legs }`: the trips' legs the page kept before the app read them (#282).
    @objc func legsFromPage(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId") else { return call.resolve() }
        let legs: LegBook = Self.decode(LegBook.self, call.getObject("legs")) ?? [:]
        let answers = Self.decode(TripAnswers.self, call.getObject("answers"))
        DispatchQueue.main.async {
            TripsWork.shared.adopt(userId, legs: legs)
            if let answers { HomeTrips.shared.adopt(userId, answers: answers) }
            call.resolve()
        }
    }

    /// `{ userId, correction, count }`: a label corrected on the page ("Forkert?").
    @objc func labelCorrected(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId"),
            let correction = Self.decode(PhoneLabelCorrection.self, call.getObject("correction"))
        else { return call.resolve() }
        let count = call.getInt("count") ?? 1
        DispatchQueue.main.async {
            LabelsWork.shared.corrected(userId, correction: correction, count: count)
            call.resolve()
        }
    }

    /// `{ userId? }`: what the AI made of this phone's calendar goes, for one
    /// person (the AI's consent withdrawn) or everyone (signed out).
    @objc func clearPhoneAi(_ call: CAPPluginCall) {
        let userId = call.getString("userId")
        DispatchQueue.main.async {
            LabelsWork.shared.clear(userId)
            call.resolve()
        }
    }

    /// `{ labels }`: how many labels the page keeps on this phone (#112).
    @objc func phoneFacts(_ call: CAPPluginCall) {
        let labels = call.getInt("labels") ?? 0
        DispatchQueue.main.async {
            self.factsAnswer?.resume(returning: labels)
            self.factsAnswer = nil
            call.resolve()
        }
    }

    /// The labels are the page's, kept in its storage: it counts them.
    @MainActor private func askLabels() async -> Int {
        factsAnswer?.resume(returning: 0)
        factsAnswer = nil
        #if DEBUG
            if TestLaunch.isActive { return 0 }
        #endif
        return await withCheckedContinuation { continuation in
            factsAnswer = continuation
            factsAsked += 1
            let asked = factsAsked
            notifyListeners("needPhoneFacts", data: [:])
            // A page that doesn't answer (reloading, not listening yet) must
            // not keep Dine data loading for ever: no count after 3 seconds.
            Task { @MainActor [weak self] in
                try? await Task.sleep(for: .seconds(3))
                guard let self, self.factsAsked == asked else { return }
                self.factsAnswer?.resume(returning: 0)
                self.factsAnswer = nil
            }
        }
    }

    /// The page has written what Casy keeps in the phone's calendar.
    /// `{ id }`: which ask it answers, so a late answer to one that timed out
    /// can't end a newer wait before its write is done.
    @objc func phoneWritten(_ call: CAPPluginCall) {
        let id = call.getInt("id")
        DispatchQueue.main.async {
            if id == self.writesAsked {
                self.writeAnswer?.resume()
                self.writeAnswer = nil
            }
            call.resolve()
        }
    }

    /// The phone's calendar is written by the page's sync (usePhoneCalendarSync):
    /// it asks, and waits up to 15 seconds for it to be done.
    @MainActor private func writeOnPhone() async {
        writeAnswer?.resume()
        writeAnswer = nil
        #if DEBUG
            if TestLaunch.isActive { return }
        #endif
        await withCheckedContinuation { continuation in
            writeAnswer = continuation
            writesAsked += 1
            let asked = writesAsked
            notifyListeners("needPhoneWrite", data: ["id": asked])
            Task { @MainActor [weak self] in
                try? await Task.sleep(for: .seconds(15))
                guard let self, self.writesAsked == asked else { return }
                self.writeAnswer?.resume()
                self.writeAnswer = nil
            }
        }
    }

    /// `{ answer }`: how turning notifications on went, from the web view.
    @objc func pushResult(_ call: CAPPluginCall) {
        let answer = call.getString("answer") ?? "failed"
        DispatchQueue.main.async {
            self.finishPush(answer)
            call.resolve()
        }
    }

    /// Turned on by the app itself (#202), or else by the web view, where the phone's token reaches only the page.
    @MainActor private func enablePush() async -> String {
        if PushWork.on { return await PushWork.shared.enable() }
        finishPush("failed")
        #if DEBUG
            if let answer = TestLaunch.pushAnswer { return answer }
        #endif
        return await withCheckedContinuation { continuation in
            pushAnswer = continuation
            notifyListeners("enablePush", data: [:])
        }
    }

    private func finishPush(_ answer: String) {
        pushAnswer?.resume(returning: answer)
        pushAnswer = nil
    }

    /// `then` goes with `closed`: what the page does next, as one message, so
    /// it can't step the address back before hearing where to go.
    /// The open sheet, if half height, pulled up to the whole screen.
    /// The open sheet as tall as `height` (its bar and content, the screen's
    /// own measure), up to just short of the whole screen.
    private func fitOpenSheet(_ height: CGFloat, _ fit: SheetFit) {
        guard abs(fit.height - height) > 0.5 else { return }
        fit.height = height
        guard let sheet = bridge?.viewController?.presentedViewController?.sheetPresentationController else {
            return
        }
        sheet.animateChanges { sheet.invalidateDetents() }
    }

    /// The 85 % sheet's detent, below full height so iOS keeps its glass.
    private static let stacked = UISheetPresentationController.Detent.Identifier("casy.stacked")

    /// The open sheet as tall as it goes: the 85 % where it has it, else whole.
    private func growOpenSheet() {
        guard let sheet = bridge?.viewController?.presentedViewController?.sheetPresentationController else {
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
        guard let presenter = bridge?.viewController else { return }
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
                        // The vote has its new dates: the page's lists are fetched again.
                        self?.notifyListeners("dataChanged", data: [:])
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
        guard let presenter = bridge?.viewController, let id = PlanModel.shared.again?.eventId else { return }
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
        bridge?.viewController?.presentedViewController?.dismiss(animated: true) { [weak self] in
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
        finishPush("failed")
        guard let screen = openScreen else { return }
        openScreen = nil
        let here = openedHere || PageFree.on
        openedHere = false
        if here {
            closedHere(screen, then)
        } else {
            notifyListeners("closed", data: then.merging(["screen": screen]) { $1 })
        }
    }

    // MARK: The app's own routing (#202)

    /// A sheet the app opened itself, not the page: its closing isn't the page's to hear.
    private var openedHere = false
    /// What the page last said about itself, for Profil's build line and feedback mail.
    private var pageBuild = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "dev"
    private var pageUserAgent = ""
    /// The star a Tid til hinanden sheet opened here is about: its Planlæg begins from it.
    private var openedPrime: Any?

    /// `{ path }`: a push notification's or a link's address (#202). `{ opened }`: the app
    /// showed its own screen for it; otherwise the page goes there itself, as before. Only
    /// while the app's home page is shown and nothing is over it.
    @objc func openPath(_ call: CAPPluginCall) {
        let path = call.getString("path") ?? ""
        DispatchQueue.main.async {
            call.resolve(["opened": self.open(path: path)])
        }
    }

    private func open(path: String) -> Bool {
        guard let route = appRoute(path), let presenter = bridge?.viewController, openScreen == nil,
            NativeHome.on, HomeModel.shared.page.shown
        else { return false }
        func sheet(_ screen: String, _ state: [String: Any]) -> Bool {
            guard Self.nativeScreens.contains(screen) else { return false }
            openedHere = true
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

    /// Signing out on the page (#202): this phone's token taken back by the app first.
    @objc func forgetPush(_ call: CAPPluginCall) {
        Task { @MainActor in
            await PushWork.shared.forget()
            call.resolve()
        }
    }

    /// Turning notifications on from one of the page's screens (#202): done by the app.
    @objc func enablePushInApp(_ call: CAPPluginCall) {
        Task { @MainActor in
            call.resolve(["answer": await PushWork.shared.enable()])
        }
    }

    /// `{ reason }`: a moment the page saw that is worth asking for notifications at (#202):
    /// the app decides whether it is time and shows its sheet.
    @objc func askPush(_ call: CAPPluginCall) {
        let reason = call.getString("reason") ?? "sent"
        DispatchQueue.main.async {
            Asks.shared.push(reason)
            call.resolve()
        }
    }

    /// `{ pushAsked, pushLast?, reviewAsked? }`: what the page counted before the app asked itself.
    @objc func asksFromPage(_ call: CAPPluginCall) {
        let asked = call.getInt("pushAsked") ?? 0
        let last = call.getDouble("pushLast")
        let review = call.getDouble("reviewAsked")
        DispatchQueue.main.async {
            Asks.shared.adopt(pushAsked: asked, pushLast: last, reviewAsked: review)
            call.resolve()
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
            Asks.shared.review(in: bridge?.viewController?.view.window?.windowScene)
            return true
        }
        guard Self.nativeScreens.contains(action), let presenter = bridge?.viewController, openScreen == nil else {
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
        openedHere = true
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
        if then["plan"] as? Bool == true, let presenter = bridge?.viewController {
            openedHere = true
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
                if let presenter = bridge?.viewController {
                    openedHere = true
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
        if PageFree.on { return pageFreeLeave(then) }
        notifyListeners("leave", data: then.merging(["screen": screen]) { $1 })
    }

    // MARK: Without the page (#202)

    /// What a sheet closed with that the page would have done, done by the app;
    /// what it can't do yet is logged, the page's last jobs found that way.
    private func pageFreeLeave(_ then: [String: Any]) {
        if then["signOut"] as? Bool == true {
            Task { _ = await AppSession.shared.signOut() }
        } else if then["accountDeleted"] as? Bool == true {
            AppSession.shared.forget()
        } else if then["joined"] as? Bool == true {
            Asks.shared.push("joined")
        } else if then["sent"] != nil {
            Asks.shared.push("sent")
        } else if then["signedIn"] as? Bool == true {
            // AppSession has it already.
        } else {
            NSLog("PageFree: the page would have done %@", "\(then)")
        }
    }

    /// The app on its own: no page loaded (MainViewController), the login the
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
        PageAuth.shared.send = nil
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
        AppSession.shared.start()
    }

    /// Signed in, the app's home page; signed out, the welcome over everything.
    @MainActor private func showPageFree(signedIn: Bool) {
        var page = HomeModel.shared.page
        page.shown = signedIn
        page.covered = false
        if page != HomeModel.shared.page { HomeModel.shared.update(page) }
        placeHome()
        guard let presenter = bridge?.viewController else { return }
        if !signedIn {
            if openScreen == nil {
                present("welcome", on: presenter, build: pageBuild, userAgent: pageUserAgent)
            }
        } else if openScreen == "welcome" || openScreen == "signIn" {
            dismissOpenScreen()
        }
    }

    // MARK: Handing the login between the page and the app (#202, Debug)

    /// `{ session }`: the page's stored login (auth-js's JSON), handed over as
    /// the app goes page-free; the page has forgotten it already.
    @objc func sessionHandedOver(_ call: CAPPluginCall) {
        let json = call.getString("session")
        DispatchQueue.main.async {
            self.handOverWaiter?(json)
            self.handOverWaiter = nil
            call.resolve()
        }
    }

    private var handOverWaiter: ((String?) -> Void)?

    /// Admin's "Uden side" (Debug): on takes the page's login and opens the app
    /// without its page; off gives the app's login back to the page. Either way the app
    /// closes, to open again the other way.
    @MainActor func switchPageFree(_ on: Bool) async -> Bool {
        if on {
            let json: String? = await withCheckedContinuation { waiter in
                handOverWaiter = { waiter.resume(returning: $0) }
                notifyListeners("handOverSession", data: [:])
            }
            guard let json, AppSession.shared.takeOver(pageJSON: json) else { return false }
            PageFree.set(true)
        } else {
            if let json = await AppSession.shared.handBack() {
                UserDefaults.standard.set(json, forKey: PageFree.handBackKey)
            }
            PageFree.set(false)
        }
        exit(0)
    }
}

/// How tall a sheet that fits its content wants to be, as its screen measured it.
final class SheetFit {
    var height: CGFloat = 420
}

/// A screen whose top is light in either theme (sign-in's colour): the
/// clock and battery over it drawn dark.
final class DarkStatusHost: UIHostingController<AnyView> {
    override var preferredStatusBarStyle: UIStatusBarStyle { .darkContent }
}
