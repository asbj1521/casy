import Capacitor
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
    ]

    /// The screens drawn natively in this build. None in a Release build: the
    /// Swift rewrite reaches people all at once, as its own update, so until
    /// then App Store releases carry only the web's screens and its fixes.
    private static let nativeScreens: [String] = {
        #if DEBUG
            ["settings", "profile", "events", "calendars", "tell"]
        #else
            []
        #endif
    }()

    private var openScreen: String?
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
        Task { @MainActor in
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
                await self?.askLabels() ?? 0
            }
            EventsModel.shared.writeOnPhone = { [weak self] in
                await self?.writeOnPhone()
            }
            let calendars = CalendarsModel.shared
            calendars.onPrefs = { [weak self] hidden, seen in
                var data: [String: Any] = [:]
                if let hidden { data["holidaysHidden"] = hidden }
                if let seen { data["tourSeen"] = seen }
                self?.notifyListeners("calendarPrefs", data: data)
            }
            calendars.onChanged = { [weak self] in
                self?.notifyListeners("calendarsChanged", data: [:])
            }
            calendars.syncPhone = { [weak self] create in
                await self?.syncPhone(create: create)
                    ?? PhoneSyncOutcome(state: "failed", error: CasyStrings.phoneSaveFailed)
            }
            calendars.onPhoneForgotten = { [weak self] in
                self?.notifyListeners("phoneForgotten", data: [:])
            }
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
            // No animations under test: a sheet or a push is there at once, and
            // the suite runs in a fraction of the time. A test launch only.
            UIView.setAnimationsEnabled(false)
            Task { @MainActor in
                await SessionBox.shared.set(connection)
                if let lang = TestLaunch.lang { NativePreferences.shared.lang = lang }
                guard let screen = TestLaunch.screen else { return }
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
        Task {
            let before = await SessionBox.shared.current()?.userId
            await SessionBox.shared.set(next)
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
                }
            }
            call.resolve()
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
        DispatchQueue.main.async {
            guard let presenter = self.bridge?.viewController, self.openScreen == nil else {
                call.reject("Nothing to show the screen on")
                return
            }
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
            }
        }
        let root: AnyView =
            screen == "calendars"
            ? AnyView(calendarsSheet(state, onDone: onDone, leave: leave))
            : screen == "tell"
            ? AnyView(TellSheet(preferences: NativePreferences.shared, onDone: onDone, leave: leave))
            : screen == "events"
            ? AnyView(EventsSheet(preferences: NativePreferences.shared, onDone: onDone, leave: leave))
            : screen == "profile"
            ? AnyView(
                ProfileScreen(
                    preferences: NativePreferences.shared, build: build, userAgent: userAgent,
                    onChoose: onChoose, onDone: onDone, enablePush: enablePush, leave: leave))
            : AnyView(
                SettingsScreen(
                    preferences: NativePreferences.shared, onChoose: onChoose, onDone: onDone,
                    enablePush: enablePush))
        let host = UIHostingController(rootView: root)
        host.modalPresentationStyle = .pageSheet
        host.sheetPresentationController?.prefersGrabberVisible = true
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

    /// `{ id, outcome }`: how the page's send of the phone's calendars went.
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

    /// The web view turns them on: the phone's token reaches only the page.
    @MainActor private func enablePush() async -> String {
        finishPush("failed")
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
    private func dismissOpenScreen(_ then: [String: Any] = [:]) {
        bridge?.viewController?.presentedViewController?.dismiss(animated: true) { [weak self] in
            self?.closed(then)
        }
    }

    public func presentationControllerDidDismiss(
        _ presentationController: UIPresentationController
    ) {
        closed()
    }

    private func closed(_ then: [String: Any] = [:]) {
        finishPush("failed")
        guard let screen = openScreen else { return }
        openScreen = nil
        notifyListeners("closed", data: then.merging(["screen": screen]) { $1 })
    }
}
