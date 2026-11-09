import CasyAPI
import Foundation

/// The signed-in person's login, borrowed from the web view (#198).
///
/// Until the native app owns the session (Phase 6), the web view does: auth-js
/// keeps it and refreshes it, and sends every change here (`setSession`). This
/// keeps the access token in memory only, never on disk, and never refreshes
/// it: Supabase rotates refresh tokens, so two clients refreshing one session
/// would sign the person out. A token about to run out is asked of the web.
actor SessionBox: SessionProviding {
    static let shared = SessionBox()

    struct Connection: Sendable {
        let projectURL: URL
        let apiKey: String
        let accessToken: String
        let expiresAt: Date
        let userId: String
        var email: String?
    }

    /// How long before it runs out a token counts as gone.
    private static let margin: TimeInterval = 30
    /// How long to wait for the web view's fresh token.
    private static let waitForRefresh: Duration = .seconds(5)

    private var connection: Connection?
    private var askWeb: (@Sendable () -> Void)?

    func setAskWeb(_ ask: @escaping @Sendable () -> Void) {
        askWeb = ask
    }

    func set(_ next: Connection?) {
        connection = next
    }

    func current() -> Connection? {
        connection
    }

    private var isFresh: Bool {
        guard let connection else { return false }
        return connection.expiresAt.timeIntervalSinceNow > Self.margin
    }

    /// A token still good, waiting a moment for the web view to refresh one.
    /// Nil when signed out or if no fresh one came.
    func accessToken() async -> String? {
        if isFresh { return connection?.accessToken }
        guard connection != nil else { return nil }
        askWeb?()
        let deadline = ContinuousClock.now + Self.waitForRefresh
        while ContinuousClock.now < deadline {
            try? await Task.sleep(for: .milliseconds(100))
            if isFresh { return connection?.accessToken }
        }
        return nil
    }
}
