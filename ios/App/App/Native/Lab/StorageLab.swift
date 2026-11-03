#if DEBUG
import SwiftUI
import WebKit

/// The spike's storage test (#196, step 7): can native code read what the web
/// view keeps in localStorage? Phase 6 needs it once, so nobody signs in again
/// or loses their labels and trip answers when the web view goes.
///
/// localStorage belongs to the page's origin, `capacitor://localhost`, in the
/// default website data store (Capacitor's configuration doesn't change it).
/// So a hidden web view on that store, with its own handler serving an empty
/// page at that origin, sees the same storage and reads it with a script.
/// Debug builds only; deleted when the spike ends (Phase 6 builds the real one).
@MainActor
final class WebStorageReader: NSObject, WKURLSchemeHandler, WKNavigationDelegate {
    enum Failure: LocalizedError {
        case unreadable(String)
        var errorDescription: String? {
            switch self { case .unreadable(let why): return why }
        }
    }

    private var webView: WKWebView?
    private var waiting: CheckedContinuation<[String: String], Error>?

    /// Every key and value the page has stored.
    func read() async throws -> [String: String] {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.setURLSchemeHandler(self, forURLScheme: "capacitor")
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        self.webView = webView
        defer { self.webView = nil }
        return try await withCheckedThrowingContinuation { continuation in
            waiting = continuation
            webView.load(URLRequest(url: URL(string: "capacitor://localhost/storage-probe")!))
        }
    }

    // An empty page at the page's own origin.
    func webView(_ webView: WKWebView, start task: any WKURLSchemeTask) {
        let page = Data("<!doctype html><meta charset=utf-8><title>probe</title>".utf8)
        task.didReceive(
            URLResponse(
                url: task.request.url!, mimeType: "text/html", expectedContentLength: page.count,
                textEncodingName: "utf-8"))
        task.didReceive(page)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: any WKURLSchemeTask) {}

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webView.evaluateJavaScript("JSON.stringify(Object.fromEntries(Object.entries(localStorage)))") {
            [weak self] result, error in
            guard let self, let waiting = self.waiting else { return }
            self.waiting = nil
            guard let text = result as? String, let data = text.data(using: .utf8),
                let storage = try? JSONDecoder().decode([String: String].self, from: data)
            else {
                waiting.resume(throwing: Failure.unreadable(error?.localizedDescription ?? "no answer"))
                return
            }
            waiting.resume(returning: storage)
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: any Error) {
        waiting?.resume(throwing: error)
        waiting = nil
    }

    func webView(
        _ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: any Error
    ) {
        waiting?.resume(throwing: error)
        waiting = nil
    }

    /// What was found, without a secret: the session only as whether it holds
    /// a refresh token, other values only for settings that are plain words.
    static func summary(_ storage: [String: String]) -> [String] {
        let plain: Set<String> = [
            "casy-lang", "casy-theme", "casy-day-span", "casy-hide-holidays", "casy-swipe-hint-seen",
            "casy-probe-marker",
        ]
        let lines = storage.keys.sorted().map { key -> String in
            let value = storage[key] ?? ""
            if key.hasPrefix("sb-"), key.hasSuffix("-auth-token") {
                let refresh = value.contains("\"refresh_token\"") ? "with" : "without"
                return "\(key): a session, \(refresh) a refresh token"
            }
            if plain.contains(key) { return "\(key) = \(value)" }
            return "\(key): \(value.count) characters"
        }
        return ["\(storage.count) keys"] + lines
    }

    /// In a Debug build launched with `-casyStorageProbe`: the summary in the
    /// console a moment after launch, to test it without signing in. As a
    /// control, the page's own web view first stores a marker, which the
    /// reader must then find: proof it reads the page's storage, not another.
    static func probeIfAsked(page: WKWebView?) {
        guard ProcessInfo.processInfo.arguments.contains("-casyStorageProbe") else { return }
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(4))
            // `-casyStorageProbeNoMark` reads only: the marker from an earlier
            // launch must still be there, as Phase 6 reads an older release's.
            if !ProcessInfo.processInfo.arguments.contains("-casyStorageProbeNoMark") {
                _ = try? await page?.evaluateJavaScript(
                    "localStorage.setItem('casy-probe-marker', 'from-page'); 'ok'")
            }
            try? await Task.sleep(for: .seconds(1))
            do {
                let storage = try await WebStorageReader().read()
                for line in summary(storage) { print("casy-storage-probe: \(line)") }
            } catch {
                print("casy-storage-probe: failed: \(error.localizedDescription)")
            }
        }
    }
}

struct StorageLab: View {
    @State private var lines: [String] = []
    @State private var failure: String?

    var body: some View {
        List {
            if let failure {
                Text(failure).foregroundStyle(.red)
            }
            Section("What the web view keeps") {
                ForEach(lines, id: \.self) { Text($0).font(.footnote.monospaced()) }
            }
            Button("Read again") { Task { await read() } }
        }
        .navigationTitle("Web view storage")
        .task { await read() }
    }

    private func read() async {
        do {
            lines = WebStorageReader.summary(try await WebStorageReader().read())
            failure = nil
        } catch {
            failure = error.localizedDescription
        }
    }
}
#endif
