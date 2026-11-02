import Foundation

/// The signed-in person's login, borrowed from the web view (#196).
///
/// Until the native app owns the session (Phase 6), the web view does: auth-js
/// keeps it and refreshes it, and sends every change here (`setSession`). This
/// keeps the access token in memory only, never on disk, and never refreshes
/// it: Supabase rotates refresh tokens, so two clients refreshing one session
/// would sign the person out.
actor SessionBox {
    static let shared = SessionBox()

    /// Where the Edge Functions are, and the token to call them with.
    struct Connection: Sendable {
        let functionsURL: URL
        let apiKey: String
        let accessToken: String
        let expiresAt: Date
        let userId: String
    }

    private var connection: Connection?

    func set(_ next: Connection?) {
        connection = next
    }

    /// The login, or nil when signed out or once the token has run out (the
    /// web view sends the refreshed one as soon as auth-js has it).
    func current() -> Connection? {
        guard let connection, connection.expiresAt > Date() else { return nil }
        return connection
    }
}
