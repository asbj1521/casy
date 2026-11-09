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
/// choice, `closed` when one closes, `needSession` for a fresh login.
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
    ]

    /// The screens drawn natively in this build. A screen joins Release only
    /// when it does everything the web's does: until then people get the web's.
    private static let nativeScreens: [String] = {
        #if DEBUG
            return ["settings"]
        #else
            return []
        #endif
    }()

    private var openScreen: String?

    override public func load() {
        Task {
            await SessionBox.shared.setAskWeb { [weak self] in
                self?.notifyListeners("needSession", data: [:])
            }
        }
    }

    @objc func screens(_ call: CAPPluginCall) {
        call.resolve(["screens": Self.nativeScreens])
    }

    /// `{ projectUrl, apiKey, session: { accessToken, expiresAt (epoch s), userId } | null }`.
    @objc func setSession(_ call: CAPPluginCall) {
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
                expiresAt: Date(timeIntervalSince1970: expiresAt), userId: userId)
        }
        Task {
            await SessionBox.shared.set(next)
            call.resolve()
        }
    }

    /// `{ lang, theme }`: what the web view uses now.
    @objc func setPreferences(_ call: CAPPluginCall) {
        let lang = call.getString("lang")
        let theme = call.getString("theme")
        DispatchQueue.main.async {
            let preferences = NativePreferences.shared
            if let lang { preferences.lang = lang }
            if let theme { preferences.theme = theme }
            call.resolve()
        }
    }

    /// `{ screen }`: a native screen as a sheet over the page.
    @objc func open(_ call: CAPPluginCall) {
        let screen = call.getString("screen") ?? ""
        guard Self.nativeScreens.contains(screen) else {
            call.reject("No native screen \(screen)")
            return
        }
        DispatchQueue.main.async {
            guard let presenter = self.bridge?.viewController, self.openScreen == nil else {
                call.reject("Nothing to show the screen on")
                return
            }
            let host = UIHostingController(
                rootView: SettingsScreen(
                    preferences: NativePreferences.shared,
                    onChoose: { [weak self] lang, theme in
                        self?.notifyListeners("preferences", data: ["lang": lang, "theme": theme])
                    },
                    onDone: { [weak self] in self?.dismissOpenScreen() }))
            host.modalPresentationStyle = .pageSheet
            host.sheetPresentationController?.prefersGrabberVisible = true
            // A swipe down closes it too: tell the web either way.
            host.presentationController?.delegate = self
            self.openScreen = screen
            presenter.present(host, animated: true)
            call.resolve()
        }
    }

    private func dismissOpenScreen() {
        bridge?.viewController?.presentedViewController?.dismiss(animated: true) { [weak self] in
            self?.closed()
        }
    }

    public func presentationControllerDidDismiss(
        _ presentationController: UIPresentationController
    ) {
        closed()
    }

    private func closed() {
        guard let screen = openScreen else { return }
        openScreen = nil
        notifyListeners("closed", data: ["screen": screen])
    }
}
