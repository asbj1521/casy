import CasyAPI
import CasyCore
import UIKit

/// Whether this app is too old to use (#143), asked by the app itself once it
/// has no page (#202), as the web's UpdateRequired did: on opening, and again
/// on coming back after half an hour. Too old, "Opdater appen" goes over
/// everything (UpdateRequiredScreen) with no way out but the App Store; a
/// failed answer blocks nothing.
@MainActor
final class UpdateCheck {
    static let shared = UpdateCheck()

    /// Shows the update screen, with the App Store's page when there is one (set by the bridge).
    var show: ((URL?) -> Void)?

    private static let staleAfter: TimeInterval = 30 * 60
    private var askedAt: Date?
    private var started = false
    private var shown = false

    func start() {
        guard !started else { return }
        started = true
        NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main
        ) { _ in
            MainActor.assumeIsolated { UpdateCheck.shared.ask() }
        }
        ask()
    }

    private func ask() {
        guard !shown, askedAt.map({ Date().timeIntervalSince($0) > Self.staleAfter }) ?? true else { return }
        askedAt = Date()
        Task {
            guard let api = await Native.publicApi(), let info = try? await api.appVersion() else {
                // Asked again next time, not in half an hour.
                askedAt = nil
                return
            }
            let release = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? ""
            guard isOutdated(release, info.minVersion) else { return }
            shown = true
            show?(info.storeUrl.flatMap(URL.init(string:)))
        }
    }
}
