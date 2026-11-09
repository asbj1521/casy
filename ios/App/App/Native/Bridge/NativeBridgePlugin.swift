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
/// choice, `closed` when one closes (with where to go next, if anywhere), `needSession` for a fresh login.
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
    ]

    /// The screens drawn natively in this build. None in a Release build: the
    /// Swift rewrite reaches people all at once, as its own update, so until
    /// then App Store releases carry only the web's screens and its fixes.
    private static let nativeScreens: [String] = {
        #if DEBUG
            ["settings", "profile"]
        #else
            []
        #endif
    }()

    private var openScreen: String?
    /// A native screen waiting for the web view to turn notifications on.
    private var pushAnswer: CheckedContinuation<String, Never>?

    override public func load() {
        let askWeb: @Sendable () -> Void = { [weak self] in
            self?.notifyListeners("needSession", data: [:])
        }
        Task { await SessionBox.shared.setAskWeb(askWeb) }
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
        guard Self.nativeScreens.contains(screen) else {
            call.reject("No native screen \(screen)")
            return
        }
        DispatchQueue.main.async {
            guard let presenter = self.bridge?.viewController, self.openScreen == nil else {
                call.reject("Nothing to show the screen on")
                return
            }
            self.present(screen, on: presenter, build: build, userAgent: userAgent)
            call.resolve()
        }
    }

    private func present(
        _ screen: String, on presenter: UIViewController, build: String = "dev",
        userAgent: String = ""
    ) {
        let onChoose: (String, String) -> Void = { [weak self] lang, theme in
            self?.notifyListeners("preferences", data: ["lang": lang, "theme": theme])
        }
        let onDone: () -> Void = { [weak self] in self?.dismissOpenScreen() }
        let enablePush: () async -> String = { [weak self] in
            await self?.enablePush() ?? "failed"
        }
        let root: AnyView =
            screen == "profile"
            ? AnyView(
                ProfileScreen(
                    preferences: NativePreferences.shared, build: build, userAgent: userAgent,
                    onChoose: onChoose, onDone: onDone, enablePush: enablePush,
                    leave: { [weak self] leaving in
                        switch leaving {
                        case .webScreen(let address):
                            self?.dismissOpenScreen(["next": address])
                        case .signOut:
                            self?.dismissOpenScreen(["signOut": true])
                        }
                    }))
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
