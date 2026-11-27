import CasyAPI
import CasyCore
import CasyUI
import Capacitor
import Foundation
import UIKit
import UserNotifications

/// Push notifications done by the app itself (#202, the web's push.ts and
/// PushLinks): iOS's permission, the phone's APNs token registered with the
/// account (again on each sign-in, as it can change, and when the language
/// changes, as the server writes in it), taken back as the person signs out,
/// a notification shown while the app is open, and a tap opening the screen
/// it is about.
///
/// The tap comes through Capacitor's notification router, whose push handler
/// this becomes (the push plugin's otherwise): the app opens its own screen
/// for the address, waits for its home page when the tap launched it, and
/// hands anything it can't show to the page.
@MainActor
final class PushWork: NSObject {
    static let shared = PushWork()

    static var on: Bool {
        #if DEBUG
            if TestLaunch.isActive { return TestLaunch.push }
        #endif
        return NativeBridgePlugin.nativeLabels
    }

    /// The bridge's: the app's own screen for an address; false when it can't show it now.
    var openHere: (String) -> Bool = { _ in false }
    /// The bridge's: the page goes to an address the app can't show.
    var openOnPage: (String) -> Void = { _ in }

    private let store = UserDefaults.standard
    private static let tokenKey = "casy.push.token"
    private static let tokenWait: Duration = .seconds(15)

    private var userId: String?
    private var homeSettled = false
    private var waitingPath: String?

    /// The address waiting for the home page, taken (signed out, it never comes).
    func takeWaiting() -> String? {
        defer { waitingPath = nil }
        return waitingPath
    }
    private var tokenWaiter: CheckedContinuation<String?, Never>?
    private var observers: [NSObjectProtocol] = []

    /// The token last registered from this phone, to take it back on signing out.
    private(set) var token: String? {
        get { store.string(forKey: Self.tokenKey) }
        set { store.set(newValue, forKey: Self.tokenKey) }
    }

    /// Takes the taps over from the push plugin; again whenever asked, since
    /// the plugin sets itself as it loads.
    func takeTaps(from bridge: CAPBridgeProtocol?) {
        guard Self.on else { return }
        bridge?.notificationRouter.pushNotificationHandler = self
    }

    // MARK: Signing in and out

    /// Signed in: registered again when notifications are allowed (the token
    /// can change, and the phone may have been someone else's).
    func signedIn(_ id: String?) {
        guard Self.on, id != userId else { return }
        userId = id
        guard id != nil else { return }
        Task { if await permission() == "granted" { _ = await register() } }
    }

    /// The language changed: the server writes notifications in the one registered.
    func languageChanged() {
        guard Self.on, userId != nil else { return }
        Task { if await permission() == "granted" { _ = await register() } }
    }

    /// Signing out: this phone's token taken back first, while the login can
    /// still say whose it was. Never in the way of signing out.
    func forget() async {
        guard let token, let api = await Native.api() else { return }
        do {
            try await api.unregisterPushToken(token)
            self.token = nil
        } catch {
            // Offline: the server forgets it once Apple says the app is gone,
            // and the next sign-in on this phone moves it.
        }
    }

    // MARK: Turning them on

    /// What iOS says about notifications for the app now: granted, denied or prompt.
    func permission() async -> String {
        #if DEBUG
            if let faked = TestLaunch.pushPermission { return faked }
        #endif
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        switch settings.authorizationStatus {
        case .notDetermined: return "prompt"
        case .denied: return "denied"
        default: return "granted"
        }
    }

    /// iOS asked (its own question, once ever; after that its answer stands),
    /// and with a yes the phone registered: "granted", "denied" or "failed".
    func enable() async -> String {
        #if DEBUG
            if let answer = TestLaunch.pushAnswer { return answer }
        #endif
        let allowed = (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        guard allowed else { return "denied" }
        return await register() ? "granted" : "failed"
    }

    /// The phone's token from iOS, registered with the account.
    private func register() async -> Bool {
        guard let fresh = await deviceToken(), let api = await Native.api() else {
            #if DEBUG
                NSLog("PushWork: no token from iOS")
            #endif
            return false
        }
        let lang: Lang = CasyStrings.language == "en" ? .en : .da
        do {
            try await api.registerPushToken(fresh, lang: lang)
            token = fresh
            #if DEBUG
                NSLog("PushWork: registered %@…, %@", String(fresh.prefix(8)), lang.rawValue)
            #endif
            return true
        } catch {
            #if DEBUG
                NSLog("PushWork: registering failed, %@", "\(error)")
            #endif
            return false
        }
    }

    private func deviceToken() async -> String? {
        if tokenWaiter != nil { return nil }
        watchForToken()
        let answer = await withCheckedContinuation { (waiter: CheckedContinuation<String?, Never>) in
            tokenWaiter = waiter
            UIApplication.shared.registerForRemoteNotifications()
            Task {
                try? await Task.sleep(for: Self.tokenWait)
                self.gotToken(nil)
            }
        }
        return answer
    }

    private func gotToken(_ token: String?) {
        tokenWaiter?.resume(returning: token)
        tokenWaiter = nil
    }

    /// AppDelegate posts what iOS hands it (for the push plugin too, which the page no longer asks).
    private func watchForToken() {
        guard observers.isEmpty else { return }
        let center = NotificationCenter.default
        observers = [
            center.addObserver(forName: .capacitorDidRegisterForRemoteNotifications, object: nil, queue: .main) { note in
                let hex = (note.object as? Data)?.map { String(format: "%02.2hhx", $0) }.joined()
                MainActor.assumeIsolated { PushWork.shared.gotToken(hex) }
            },
            center.addObserver(forName: .capacitorDidFailToRegisterForRemoteNotifications, object: nil, queue: .main) {
                _ in
                MainActor.assumeIsolated { PushWork.shared.gotToken(nil) }
            },
        ]
    }

    // MARK: A tap

    /// The home page has settled: a tap that launched the app opens now.
    func settled() {
        homeSettled = true
        if let path = waitingPath {
            waitingPath = nil
            open(path)
        }
    }

    /// Where a notification (or, without the page, a link) leads: the app's own
    /// screen, the home page first when it launched the app, else the page's.
    func open(_ path: String) {
        #if DEBUG
            NSLog("PushWork: tap to %@", path)
        #endif
        if openHere(path) { return tested(path, "opened") }
        // Without the page, signed out: an invite's own screen over the welcome (#202).
        if PageFreeLinks.openSignedOut?(path) == true { return tested(path, "opened signed out") }
        if NativeHome.on && !homeSettled {
            waitingPath = path
            return
        }
        #if DEBUG
            if PageFree.on { NSLog("PageFree: the page would have opened %@", path) }
        #endif
        openOnPage(path)
        tested(path, "the page's")
    }

    private func tested(_ path: String, _ outcome: String) {
        #if DEBUG
            if TestLaunch.isActive { HomeModel.shared.testAction = "push \(path): \(outcome)" }
        #endif
    }

    /// An address a notification carries: a path inside the app, never elsewhere.
    nonisolated static func path(of content: UNNotificationContent) -> String? {
        guard let url = content.userInfo["url"] as? String, url.hasPrefix("/"), !url.hasPrefix("//") else {
            return nil
        }
        return url
    }
}

extension PushWork: NotificationHandlerProtocol {
    /// Shown while the app is open too, as the push plugin was set to (banner, sound, list).
    nonisolated func willPresent(notification: UNNotification) -> UNNotificationPresentationOptions {
        [.banner, .sound, .list]
    }

    nonisolated func didReceive(response: UNNotificationResponse) {
        guard let path = Self.path(of: response.notification.request.content) else { return }
        Task { @MainActor in PushWork.shared.open(path) }
    }
}
