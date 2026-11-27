// Supabase Auth, spoken by the app itself (#202): the calls the page's
// auth-js makes (src/lib/nativeAuth.ts, appleSignIn.ts), as plain requests to
// /auth/v1 with the same headers and the same answers, so the server can't
// tell the two apart. The session it answers is the app's to keep (the
// Keychain) and to refresh; nothing here stores anything.

import Foundation

/// A login: what every call is made with, and how to make a new one.
public struct AuthSession: Codable, Sendable, Equatable {
    public var accessToken: String
    public var refreshToken: String
    /// When the access token runs out.
    public var expiresAt: Date
    public var user: AuthUser

    public init(accessToken: String, refreshToken: String, expiresAt: Date, user: AuthUser) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.expiresAt = expiresAt
        self.user = user
    }
}

/// Who is signed in, as far as the app needs: the id, the email, when the
/// account was made, and its ways in (a new Apple account is asked about).
public struct AuthUser: Codable, Sendable, Equatable {
    public var id: String
    public var email: String?
    public var createdAt: String?
    /// The providers of its identities ("email", "apple").
    public var providers: [String]

    public init(id: String, email: String?, createdAt: String?, providers: [String]) {
        self.id = id
        self.email = email
        self.createdAt = createdAt
        self.providers = providers
    }

    public var hasApple: Bool { providers.contains("apple") }
}

/// A refusal from Supabase Auth: its code (`invalid_credentials`), the HTTP
/// status, and its own English words for anything without a code.
public struct AuthError: LocalizedError, Equatable, Sendable {
    public var code: String?
    public var status: Int
    public var message: String

    public init(code: String?, status: Int, message: String) {
        self.code = code
        self.status = status
        self.message = message
    }

    public var errorDescription: String? { message }
    /// No answer at all (offline, or it took too long).
    public static let network = AuthError(code: "network", status: 0, message: "network")
}

/// What signing up came to.
public enum SignUpOutcome: Sendable, Equatable {
    /// Signed in at once (no email to confirm).
    case signedIn(AuthSession)
    /// The account waits for its email's link.
    case confirm
    /// The address has an account already (Supabase answers a stand-in with no identities).
    case exists
}

public struct AuthClient: Sendable {
    private let base: URL
    private let apiKey: String
    private let transport: any HTTPTransport

    public init(projectURL: URL, apiKey: String, transport: any HTTPTransport = URLSessionTransport()) {
        self.base = projectURL.appending(path: "auth/v1")
        self.apiKey = apiKey
        self.transport = transport
    }

    // MARK: Signing in

    /// A password sign-in; `weak` when Supabase says the password falls short of today's rules.
    public func signIn(email: String, password: String) async throws -> (session: AuthSession, weak: Bool) {
        let answer = try await send(
            "POST", "token", query: ["grant_type": "password"], body: ["email": email, "password": password])
        let session = try Self.session(answer)
        let reasons = (answer["weak_password"] as? [String: Any])?["reasons"] as? [Any]
        return (session, !(reasons ?? []).isEmpty)
    }

    /// A new account with a password, its name and language for the emails.
    public func signUp(email: String, password: String, name: String, lang: String, redirectTo: String) async throws
        -> SignUpOutcome
    {
        let answer = try await send(
            "POST", "signup", query: ["redirect_to": redirectTo],
            body: ["email": email, "password": password, "data": ["lang": lang, "full_name": name]])
        if answer["access_token"] != nil { return .signedIn(try Self.session(answer)) }
        // Without a session the answer is the user itself.
        let user = (answer["user"] as? [String: Any]) ?? answer
        if let identities = user["identities"] as? [Any], identities.isEmpty { return .exists }
        return .confirm
    }

    /// Signing in with Apple's identity token (Sign in with Apple's sheet).
    public func signInWithApple(idToken: String, nonce: String) async throws -> AuthSession {
        try Self.session(
            try await send(
                "POST", "token", query: ["grant_type": "id_token"],
                body: ["provider": "apple", "id_token": idToken, "nonce": nonce]))
    }

    /// Apple added to the account signed in as a second way in (#245).
    public func linkApple(idToken: String, nonce: String, accessToken: String) async throws -> AuthSession {
        try Self.session(
            try await send(
                "POST", "token", query: ["grant_type": "id_token"],
                body: ["provider": "apple", "id_token": idToken, "nonce": nonce, "link_identity": true],
                token: accessToken))
    }

    /// A fresh login from the refresh token (which Supabase then replaces: use it once).
    public func refresh(_ refreshToken: String) async throws -> AuthSession {
        try Self.session(
            try await send(
                "POST", "token", query: ["grant_type": "refresh_token"], body: ["refresh_token": refreshToken]))
    }

    // MARK: Emails

    /// A sign-in link to the address, making the account if there is none.
    public func sendLink(email: String, redirectTo: String) async throws {
        _ = try await send(
            "POST", "otp", query: ["redirect_to": redirectTo],
            body: ["email": email, "data": [String: Any](), "create_user": true])
    }

    public func resetPassword(email: String, redirectTo: String) async throws {
        _ = try await send("POST", "recover", query: ["redirect_to": redirectTo], body: ["email": email])
    }

    /// The new account's confirmation sent again.
    public func resendSignup(email: String, redirectTo: String) async throws {
        _ = try await send(
            "POST", "resend", query: ["redirect_to": redirectTo], body: ["type": "signup", "email": email])
    }

    // MARK: Signed in

    public func user(accessToken: String) async throws -> AuthUser {
        try Self.user(try await send("GET", "user", token: accessToken))
    }

    /// The user as Supabase writes it, every field kept: for handing a login back to auth-js.
    public func userJSON(accessToken: String) async throws -> Data {
        try JSONSerialization.data(withJSONObject: try await send("GET", "user", token: accessToken))
    }

    /// A new password; `code` the one Supabase emailed when it asked for it (`reauthentication_needed`).
    public func setPassword(_ password: String, code: String?, accessToken: String) async throws {
        var body: [String: Any] = ["password": password]
        if let code { body["nonce"] = code }
        _ = try await send("PUT", "user", body: body, token: accessToken)
    }

    /// The name kept with the account (Apple's, the first time).
    public func setName(_ name: String, accessToken: String) async throws {
        _ = try await send("PUT", "user", body: ["data": ["full_name": name]], token: accessToken)
    }

    /// A code emailed for changing the password.
    public func reauthenticate(accessToken: String) async throws {
        _ = try await send("GET", "reauthenticate", token: accessToken)
    }

    /// Signed out: "local" this login, "others" every other, "global" all.
    public func signOut(scope: String, accessToken: String) async throws {
        _ = try await send("POST", "logout", query: ["scope": scope], token: accessToken)
    }

    // MARK: The wire

    private func send(
        _ method: String, _ path: String, query: [String: String] = [:], body: [String: Any]? = nil,
        token: String? = nil
    ) async throws -> [String: Any] {
        var parts = URLComponents(url: base.appending(path: path), resolvingAgainstBaseURL: false)
        if !query.isEmpty {
            parts?.queryItems = query.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        guard let url = parts?.url else { throw AuthError.network }
        var request = URLRequest(url: url, timeoutInterval: 30)
        request.httpMethod = method
        request.setValue(apiKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token ?? apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("2024-01-01", forHTTPHeaderField: "X-Supabase-Api-Version")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let body { request.httpBody = try JSONSerialization.data(withJSONObject: body) }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await transport.send(request)
        } catch {
            throw AuthError.network
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        guard (200..<300).contains(status) else { throw Self.error(json, status: status) }
        return json
    }

    /// auth-js's handleError: the code from `code` (API 2024-01-01) or
    /// `error_code`, a weak password said as such, the words from whichever field has them.
    static func error(_ json: [String: Any], status: Int) -> AuthError {
        var code = (json["code"] as? String) ?? (json["error_code"] as? String)
        if json["weak_password"] != nil { code = "weak_password" }
        let message =
            (json["msg"] as? String) ?? (json["message"] as? String) ?? (json["error_description"] as? String)
            ?? (json["error"] as? String) ?? "HTTP \(status)"
        return AuthError(code: code, status: status, message: message)
    }

    static func session(_ json: [String: Any]) throws -> AuthSession {
        guard let access = json["access_token"] as? String, let refresh = json["refresh_token"] as? String,
            let user = json["user"] as? [String: Any]
        else { throw AuthError(code: nil, status: 200, message: "Supabase answered no session") }
        let expiresAt: Date
        if let at = json["expires_at"] as? Double {
            expiresAt = Date(timeIntervalSince1970: at)
        } else {
            expiresAt = Date().addingTimeInterval((json["expires_in"] as? Double) ?? 3600)
        }
        return AuthSession(accessToken: access, refreshToken: refresh, expiresAt: expiresAt, user: try Self.user(user))
    }

    static func user(_ json: [String: Any]) throws -> AuthUser {
        guard let id = json["id"] as? String else {
            throw AuthError(code: nil, status: 200, message: "Supabase answered no user")
        }
        let identities = (json["identities"] as? [[String: Any]]) ?? []
        return AuthUser(
            id: id, email: json["email"] as? String, createdAt: json["created_at"] as? String,
            providers: identities.compactMap { $0["provider"] as? String })
    }
}
