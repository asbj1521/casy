import CasyAPI
import Foundation
import Security
import UIKit

/// The app without its page (#202): a Debug switch (Admin, "Uden side") under
/// which the web view loads nothing and the app owns the login itself. It is
/// how the page's last jobs are found and moved before the page goes for good.
///
/// One owner at a time: Supabase rotates refresh tokens, so a page and the app
/// refreshing the same login would sign the person out. Switching on, the page
/// hands its login over and forgets it (`handOver`); switching off, the app's
/// goes back into the page's storage before the page's first line runs.
enum PageFree {
    private static let key = "casy.pageFree"

    static var on: Bool {
        #if DEBUG
            return UserDefaults.standard.bool(forKey: key)
        #else
            return false
        #endif
    }

    static func set(_ on: Bool) { UserDefaults.standard.set(on, forKey: key) }

    /// The app's login waiting for the page, as the switch went off.
    static let handBackKey = "casy.pageFree.handBack"
}

/// Admin's switch reaches the bridge through this (set as it loads).
@MainActor
enum PageFreeSwitch {
    static var run: ((Bool) async -> Bool)?
}

/// The login kept in the Keychain, on this phone only, readable once it has been unlocked.
enum SessionKeychain {
    private static let service = "app.casy.session"
    private static let account = "session"

    static func load() -> AuthSession? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess, let data = item as? Data else {
            return nil
        }
        return try? JSONDecoder().decode(AuthSession.self, from: data)
    }

    static func save(_ session: AuthSession) {
        guard let data = try? JSONEncoder().encode(session) else { return }
        let match: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        let update: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        if SecItemUpdate(match as CFDictionary, update as CFDictionary) == errSecItemNotFound {
            SecItemAdd(match.merging(update) { $1 } as CFDictionary, nil)
        }
    }

    static func delete() {
        let match: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(match as CFDictionary)
    }
}

/// Where the project is: what the page said (its build's Supabase address and
/// publishable key), kept so the app can sign in without it.
enum ProjectEndpoint {
    private static let urlKey = "casy.project.url"
    private static let apiKeyKey = "casy.project.key"

    static func remember(_ url: URL, apiKey: String) {
        UserDefaults.standard.set(url.absoluteString, forKey: urlKey)
        UserDefaults.standard.set(apiKey, forKey: apiKeyKey)
    }

    static var current: (url: URL, apiKey: String)? {
        guard let url = UserDefaults.standard.string(forKey: urlKey).flatMap(URL.init(string:)),
            let key = UserDefaults.standard.string(forKey: apiKeyKey)
        else { return nil }
        return (url, key)
    }
}

/// The login the app owns, without its page (#202): read from the Keychain at
/// launch, refreshed a minute before it runs out (and whenever a call finds it
/// stale), kept again after every refresh, handed to SessionBox for the calls.
@MainActor
final class AppSession {
    static let shared = AppSession()

    /// Signed in or out: the bridge passes it on to every part of the app.
    var changed: (AuthSession?) -> Void = { _ in }

    private(set) var session: AuthSession?
    private var refreshing: Task<Bool, Never>?
    private var timer: Task<Void, Never>?

    var auth: AuthClient? {
        ProjectEndpoint.current.map { AuthClient(projectURL: $0.url, apiKey: $0.apiKey) }
    }

    /// At launch: the login kept, made fresh if it ran out while the app was closed.
    func start() {
        guard let kept = SessionKeychain.load() else {
            changed(nil)
            return
        }
        adopt(kept)
        NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main
        ) { _ in
            MainActor.assumeIsolated { AppSession.shared.schedule() }
        }
    }

    /// A new login: kept, used, passed on.
    func adopt(_ next: AuthSession) {
        session = next
        SessionKeychain.save(next)
        Task { await SessionBox.shared.set(connection(next)) }
        changed(next)
        schedule()
    }

    /// Signed out here: forgotten everywhere on this phone.
    func forget() {
        timer?.cancel()
        session = nil
        SessionKeychain.delete()
        Task { await SessionBox.shared.set(nil) }
        changed(nil)
    }

    private func connection(_ session: AuthSession) -> SessionBox.Connection? {
        guard let endpoint = ProjectEndpoint.current else { return nil }
        return SessionBox.Connection(
            projectURL: endpoint.url, apiKey: endpoint.apiKey, accessToken: session.accessToken,
            expiresAt: session.expiresAt, userId: session.user.id, email: session.user.email)
    }

    /// The next refresh, a minute before the login runs out (at once if it has).
    private func schedule() {
        timer?.cancel()
        guard let session else { return }
        let wait = max(0, session.expiresAt.timeIntervalSinceNow - 60)
        timer = Task {
            try? await Task.sleep(for: .seconds(wait))
            guard !Task.isCancelled else { return }
            _ = await refresh()
        }
    }

    /// A fresh login, one refresh at a time (the refresh token works once).
    /// False when there is none; a refused refresh signs out.
    @discardableResult
    func refresh() async -> Bool {
        if let refreshing { return await refreshing.value }
        guard let old = session, let auth else { return false }
        let task = Task { () -> Bool in
            do {
                let fresh = try await auth.refresh(old.refreshToken)
                adopt(fresh)
                return true
            } catch let error as AuthError where error.status >= 400 && error.status < 500 {
                #if DEBUG
                    NSLog("AppSession: refresh refused (%@), signed out", error.code ?? error.message)
                #endif
                forget()
                return false
            } catch {
                // Offline: tried again when the app comes back, or a call asks.
                return false
            }
        }
        refreshing = task
        defer { refreshing = nil }
        return await task.value
    }

    /// Signing out: this phone's notifications first, then the login with Supabase, then here.
    func signOut(scope: String = "local") async -> Bool {
        await PushWork.shared.forget()
        if let session, let auth {
            do {
                try await auth.signOut(scope: scope, accessToken: session.accessToken)
            } catch let error as AuthError where scope == "global" && error.status == 0 {
                return false
            } catch {
                // A login Supabase no longer knows is signed out all the same.
            }
        }
        forget()
        return true
    }

    // MARK: The page's login, handed over and back

    /// The page's stored login, as auth-js keeps it, made the app's.
    func takeOver(pageJSON: String) -> Bool {
        guard let data = pageJSON.data(using: .utf8),
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let access = json["access_token"] as? String, let refresh = json["refresh_token"] as? String,
            let expiresAt = json["expires_at"] as? Double, let user = json["user"] as? [String: Any],
            let id = user["id"] as? String
        else { return false }
        let identities = (user["identities"] as? [[String: Any]]) ?? []
        adopt(
            AuthSession(
                accessToken: access, refreshToken: refresh, expiresAt: Date(timeIntervalSince1970: expiresAt),
                user: AuthUser(
                    id: id, email: user["email"] as? String, createdAt: user["created_at"] as? String,
                    providers: identities.compactMap { $0["provider"] as? String })))
        return true
    }

    /// The app's login in auth-js's shape, for the page to take back; the app forgets it.
    /// The whole user as Supabase has it, so the page shows the same name and ways in.
    func handBack() async -> String? {
        guard let session, let auth else { return nil }
        let user =
            (try? await auth.userJSON(accessToken: session.accessToken))
            .flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
            ?? ["id": session.user.id, "email": session.user.email ?? "", "aud": "authenticated"]
        let json: [String: Any] = [
            "access_token": session.accessToken,
            "refresh_token": session.refreshToken,
            "token_type": "bearer",
            "expires_at": Int(session.expiresAt.timeIntervalSince1970),
            "expires_in": max(0, Int(session.expiresAt.timeIntervalSinceNow)),
            "user": user,
        ]
        timer?.cancel()
        self.session = nil
        SessionKeychain.delete()
        guard let data = try? JSONSerialization.data(withJSONObject: json) else { return nil }
        return String(data: data, encoding: .utf8)
    }
}
