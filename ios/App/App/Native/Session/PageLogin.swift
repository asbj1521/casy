import Foundation
import WebKit

/// The page's login, taken over by the app (#202). auth-js kept it in the web
/// view's storage, which belongs to the page's address (`capacitor://localhost`,
/// Capacitor's), not to Capacitor itself: a hidden web view opens a blank page
/// at that address, reads the login and removes it, so the page could never
/// refresh it too (a refresh token works once). Needs no page and no Capacitor,
/// so it still works in the app that has neither.
@MainActor
final class PageLogin: NSObject {
    /// The page's address, as Capacitor serves it.
    private static let origin = URL(string: "capacitor://localhost/")!

    /// The login JSON as auth-js stored it, gone from the page's storage; nil when there is none.
    static func take() async -> String? {
        guard let key = storageKey else { return nil }
        let reader = PageLogin()
        return await reader.read(key)
    }

    /// The page's key; in a UI test, that of the fake backend's web build.
    private static var storageKey: String? {
        #if DEBUG
            if let backend = TestLaunch.backend, let host = backend.host {
                return "sb-\(host.split(separator: ".").first ?? "")-auth-token"
            }
        #endif
        return ProjectEndpoint.pageStorageKey
    }

    private var webView: WKWebView?
    private var loaded: CheckedContinuation<Bool, Never>?

    private func read(_ key: String) async -> String? {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.setURLSchemeHandler(BlankPage(), forURLScheme: Self.origin.scheme!)
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = self
        webView = view
        defer {
            webView?.navigationDelegate = nil
            webView = nil
        }
        let opened = await withCheckedContinuation { waiter in
            loaded = waiter
            view.load(URLRequest(url: Self.origin))
            // Never held up for long: no answer in 5 seconds is no login.
            Task { [weak self] in
                try? await Task.sleep(for: .seconds(5))
                self?.finish(false)
            }
        }
        guard opened else { return nil }
        let script = "const v = localStorage.getItem(key); if (v !== null) localStorage.removeItem(key); return v;"
        let value = try? await view.callAsyncJavaScript(script, arguments: ["key": key], contentWorld: .page)
        return value as? String
    }

    private func finish(_ opened: Bool) {
        let waiter = loaded
        loaded = nil
        waiter?.resume(returning: opened)
    }
}

extension PageLogin: WKNavigationDelegate {
    nonisolated func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        MainActor.assumeIsolated { finish(true) }
    }

    nonisolated func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        MainActor.assumeIsolated { finish(false) }
    }

    nonisolated func webView(
        _ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error
    ) {
        MainActor.assumeIsolated { finish(false) }
    }
}

/// An empty page for any address of the scheme: only its storage is wanted.
private final class BlankPage: NSObject, WKURLSchemeHandler {
    func webView(_ webView: WKWebView, start urlSchemeTask: any WKURLSchemeTask) {
        let data = Data("<!doctype html><html><body></body></html>".utf8)
        urlSchemeTask.didReceive(
            URLResponse(
                url: urlSchemeTask.request.url ?? URL(string: "capacitor://localhost/")!, mimeType: "text/html",
                expectedContentLength: data.count, textEncodingName: "utf-8"))
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: any WKURLSchemeTask) {}
}
