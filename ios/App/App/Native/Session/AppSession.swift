import CasyAPI
import CasyUI
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

    /// Always, but in a UI test that still plays the page's part itself (#202):
    /// there, only with `-casy.pageFree YES`.
    static var on: Bool {
        #if DEBUG
            if TestLaunch.isActive { return UserDefaults.standard.bool(forKey: key) }
        #endif
        return true
    }
}

/// Without the page and signed out (#202): an invite's or a friend link's
/// screen opened by the bridge over the welcome; false when it isn't one, or
/// the welcome isn't up (signed in, or the login not yet read).
@MainActor
enum PageFreeLinks {
    static var openSignedOut: ((String) -> Bool)?
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
/// publishable key), kept so the app can sign in without it; else what the app
/// was built with (`ProjectBuiltIn`, scripts/native/project-endpoint.sh).
enum ProjectEndpoint {
    private static let urlKey = "casy.project.url"
    private static let apiKeyKey = "casy.project.key"

    static func remember(_ url: URL, apiKey: String) {
        UserDefaults.standard.set(url.absoluteString, forKey: urlKey)
        UserDefaults.standard.set(apiKey, forKey: apiKeyKey)
    }

    static var current: (url: URL, apiKey: String)? {
        #if DEBUG
            // A UI test's made-up login never reaches the real project.
            if let backend = TestLaunch.backend { return (backend, "test-key") }
        #endif
        if let url = UserDefaults.standard.string(forKey: urlKey).flatMap(URL.init(string:)),
            let key = UserDefaults.standard.string(forKey: apiKeyKey)
        {
            return (url, key)
        }
        guard let url = URL(string: ProjectBuiltIn.url), !ProjectBuiltIn.apiKey.isEmpty else { return nil }
        return (url, ProjectBuiltIn.apiKey)
    }

    /// Where auth-js keeps the page's login (src/lib/supabase.ts): `sb-<project ref>-auth-token`.
    static var pageStorageKey: String? {
        current?.url.host?.split(separator: ".").first.map { "sb-\($0)-auth-token" }
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
    /// None kept, the page's is taken over once: how someone signed in before the
    /// app owned its login stays signed in (PageLogin).
    func start() {
        NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main
        ) { _ in
            MainActor.assumeIsolated { AppSession.shared.schedule() }
        }
        #if DEBUG
            // `-casyForgetLogin YES`: a test starts with no login of the app's own, the page not yet looked at.
            if TestLaunch.isActive, UserDefaults.standard.bool(forKey: "casyForgetLogin") {
                SessionKeychain.delete()
                UserDefaults.standard.removeObject(forKey: Self.pageLookedKey)
            }
            // `-casyPageLooked YES`: what other tests left in the page's storage is not taken.
            if TestLaunch.isActive, UserDefaults.standard.bool(forKey: "casyPageLooked") {
                UserDefaults.standard.set(true, forKey: Self.pageLookedKey)
            }
        #endif
        if let kept = SessionKeychain.load() {
            adopt(kept)
            return
        }
        // The page looked at once: whatever it had is the app's since.
        guard !UserDefaults.standard.bool(forKey: Self.pageLookedKey) else { return changed(nil) }
        Task {
            guard let stored = await PageLogin.take() else { return changed(nil) }
            UserDefaults.standard.set(true, forKey: Self.pageLookedKey)
            // What the page kept goes first, so the login's arrival finds it (the phone's connection).
            PageCarryOver.adopt(stored.values, userId: stored.login.flatMap(Self.userId(inPageJSON:)))
            if let json = stored.login, takeOver(pageJSON: json) {
                #if DEBUG
                    NSLog("AppSession: the page's login taken over")
                #endif
                // One that ran out long ago is made fresh at once (adopt's schedule), or signed out.
                return
            }
            changed(nil)
        }
    }

    /// A new login: kept, used, passed on.
    func adopt(_ next: AuthSession) {
        session = next
        SessionKeychain.save(next)
        Task { await SessionBox.shared.set(connection(next)) }
        changed(next)
        schedule()
        keepLanguage()
    }

    /// The account's language kept the same as the app's (the web's useAccountLanguage),
    /// for the emails Supabase sends with no page to ask. Only when they differ; a
    /// failure is tried again at the next login.
    func keepLanguage() {
        guard let session, let auth, session.user.lang != CasyStrings.language else { return }
        let lang = CasyStrings.language
        Task {
            guard (try? await auth.setLang(lang, accessToken: session.accessToken)) != nil,
                var now = self.session, now.user.id == session.user.id
            else { return }
            now.user.lang = lang
            self.session = now
            SessionKeychain.save(now)
        }
    }

    /// Signed out here: forgotten everywhere on this phone.
    func forget() {
        WeakPassword.shared.clear()
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

    /// Set once the page's storage has been read at launch (PageLogin).
    static let pageLookedKey = "casy.pageLooked"

    private static func userId(inPageJSON json: String) -> String? {
        guard let data = json.data(using: .utf8),
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return nil }
        return (object["user"] as? [String: Any])?["id"] as? String
    }

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
}
