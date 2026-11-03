import Capacitor
import SwiftUI
import UIKit

/// The bridge between the web view and the app's native screens (#192, #196).
///
/// Until the home page is native (Phase 6), the web view keeps the login, the
/// address and the cached data, and native screens borrow what they need:
/// - `setSession`: the web sends the login on every change (SessionBox);
/// - `setPreferences`: the web sends the language and theme it uses;
/// - `screens`: which screens this build draws natively, asked once;
/// - `open`: the web asks for a native screen in place of its own.
/// Back to the web: `preferences` when a native screen changed a choice (the
/// web applies it as its own rows do), `closed` when a native screen closes.
public class NativeBridgePlugin: CAPPlugin, CAPBridgedPlugin, UIAdaptivePresentationControllerDelegate {
    public let identifier = "NativeBridgePlugin"
    public let jsName = "NativeBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "screens", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setPreferences", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise),
    ]

    /// The screens drawn natively in this build.
    private static let nativeScreens = ["settings"]

    /// The screen open now, to tell the web which one closed.
    private var openScreen: String?

    override public func load() {
        #if DEBUG
        // The spike's sheet experiment draws over the page (#196).
        DispatchQueue.main.async { GlassLab.shared.host = self.bridge?.viewController }
        // The storage test, when launched with -casyStorageProbe (#196, step 7).
        DispatchQueue.main.async { WebStorageReader.probeIfAsked(page: self.bridge?.webView) }
        #endif
    }

    @objc func screens(_ call: CAPPluginCall) {
        call.resolve(["screens": Self.nativeScreens])
    }

    /// `{ functionsUrl, apiKey, session: { accessToken, expiresAt (epoch s), userId } | null }`.
    @objc func setSession(_ call: CAPPluginCall) {
        let session = call.getObject("session")
        var next: SessionBox.Connection?
        if let session,
            let url = call.getString("functionsUrl").flatMap(URL.init(string:)),
            let apiKey = call.getString("apiKey"),
            let token = session["accessToken"] as? String,
            let expiresAt = session["expiresAt"] as? Double,
            let userId = session["userId"] as? String
        {
            next = SessionBox.Connection(
                functionsURL: url, apiKey: apiKey, accessToken: token,
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

    public func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
        closed()
    }

    private func closed() {
        guard let screen = openScreen else { return }
        openScreen = nil
        notifyListeners("closed", data: ["screen": screen])
    }
}
