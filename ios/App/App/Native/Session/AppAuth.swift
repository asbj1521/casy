import AuthenticationServices
import CasyAPI
import CasyUI
import CryptoKit
import Foundation
import UIKit

/// The sign-in screens' steps done by the app itself without its page (#202):
/// what the page's nativeAuth.ts does with auth-js, here with AuthClient, and
/// answered the same way (`AuthAnswer`), so SignInScreen and SecurityScreen
/// can't tell who did it.
@MainActor
final class AppAuth: NSObject {
    static let shared = AppAuth()

    private var session: AppSession { .shared }

    /// Where an email's link leads: casy.app's sign-in page, in the language in use (#242).
    private var returnTo: String { "https://casy.app/sign-in?lang=\(CasyStrings.language)" }

    func answer(_ action: String, email raw: String, password: String, name: String, code: String) async
        -> AuthAnswer
    {
        let email = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let auth = session.auth else { return .failed(CasyStrings.signIn("appleFailed")) }
        let token = session.session?.accessToken ?? ""
        do {
            switch action {
            case "password":
                let (signedIn, weak) = try await auth.signIn(email: email, password: password)
                session.adopt(signedIn)
                // A password chosen before today's rules is flagged, as the web's sign-in does.
                if weak {
                    WeakPassword.shared.flag()
                } else if !Self.underTest {
                    Task { if let times = await Self.timesLeaked(password), times > 0 { WeakPassword.shared.flag() } }
                }
                return AuthAnswer(outcome: "in")
            case "signUp":
                switch try await auth.signUp(
                    email: email, password: password, name: name.trimmingCharacters(in: .whitespaces),
                    lang: CasyStrings.language, redirectTo: returnTo)
                {
                case .signedIn(let signedIn):
                    session.adopt(signedIn)
                    return AuthAnswer(outcome: "in")
                case .confirm: return AuthAnswer(outcome: "confirm")
                case .exists: return .failed(CasyStrings.authUserExists)
                }
            case "link":
                try await auth.sendLink(email: email, redirectTo: returnTo)
                return AuthAnswer(outcome: "sent")
            case "reset":
                try await auth.resetPassword(email: email, redirectTo: returnTo)
                return AuthAnswer(outcome: "sent")
            case "resend":
                try await auth.resendSignup(email: email, redirectTo: returnTo)
                return AuthAnswer(outcome: "sent")
            case "apple":
                return try await signInWithApple(auth)
            case "appleNew":
                return AuthAnswer(outcome: "done")
            case "appleLeave":
                // The empty account Apple just made goes, for the old way in (#245).
                try? await Native.api()?.deleteMyAccount()
                session.forget()
                return AuthAnswer(outcome: "done")
            case "leaked":
                return AuthAnswer(outcome: "done", count: await Self.timesLeaked(password))
            case "setPassword":
                do {
                    try await auth.setPassword(password, code: code.isEmpty ? nil : code, accessToken: token)
                } catch let error as AuthError where error.code == "reauthentication_needed" {
                    // Signed in over a day ago: Supabase emails a code first.
                    try await auth.reauthenticate(accessToken: token)
                    return AuthAnswer(outcome: "code")
                }
                // Whoever else might be signed in as you is signed out; this phone stays.
                try? await auth.signOut(scope: "others", accessToken: token)
                return AuthAnswer(outcome: "done")
            case "resendCode":
                try await auth.reauthenticate(accessToken: token)
                return AuthAnswer(outcome: "sent")
            case "signOutEverywhere":
                return await session.signOut(scope: "global")
                    ? AuthAnswer(outcome: "done") : .failed(CasyStrings.securityCouldntSignOutEverywhere)
            case "linkApple":
                guard let sheet = try await appleSheet() else { return AuthAnswer(outcome: "cancelled") }
                session.adopt(try await auth.linkApple(idToken: sheet.idToken, nonce: sheet.nonce, accessToken: token))
                return AuthAnswer(outcome: "done")
            case "appleLinked":
                let user = try await auth.user(accessToken: token)
                return AuthAnswer(outcome: "done", count: user.hasApple ? 1 : 0)
            default:
                return .failed(CasyStrings.signIn("appleFailed"))
            }
        } catch let error as AuthError {
            var answer = AuthAnswer.failed(Self.words(error))
            answer.unconfirmed = error.code == "email_not_confirmed"
            return answer
        } catch {
            return .failed(action.hasPrefix("apple") || action == "linkApple" ? CasyStrings.signIn("appleFailed") : error.localizedDescription)
        }
    }

    /// A UI test asks no outside service (the leak check).
    private static var underTest: Bool {
        #if DEBUG
            return TestLaunch.isActive
        #else
            return false
        #endif
    }

    /// The web's authErrorMessage: the errors people run into, in their language; anything else as Supabase said it.
    static func words(_ error: AuthError) -> String {
        switch error.code {
        case "invalid_credentials": CasyStrings.authError("invalidCredentials")
        case "weak_password": CasyStrings.authError("weakPassword")
        case "same_password": CasyStrings.authError("samePassword")
        case "reauthentication_not_valid": CasyStrings.authError("codeInvalid")
        case "over_email_send_rate_limit", "over_request_rate_limit": CasyStrings.authError("rateLimit")
        case "email_not_confirmed": CasyStrings.authError("emailNotConfirmed")
        case "user_already_exists", "email_exists": CasyStrings.authUserExists
        case "identity_already_exists": CasyStrings.authError("appleTaken")
        case "manual_linking_disabled": CasyStrings.authError("linkingOff")
        case "network": CasyStrings.groupsLoadFailed
        default: error.message
        }
    }

    // MARK: Apple

    /// Signed in with Apple: the name Apple gives the first time kept, its code kept for revoking.
    private func signInWithApple(_ auth: AuthClient) async throws -> AuthAnswer {
        guard let sheet = try await appleSheet() else { return AuthAnswer(outcome: "cancelled") }
        let signedIn = try await auth.signInWithApple(idToken: sheet.idToken, nonce: sheet.nonce)
        session.adopt(signedIn)
        if !sheet.name.isEmpty { try? await auth.setName(sheet.name, accessToken: signedIn.accessToken) }
        try? await Native.api()?.saveAppleSignIn(sheet.code)
        // A brand-new account made by Apple alone is asked about first (#245).
        let made = signedIn.user.createdAt.flatMap {
            ISO8601DateFormatter.supabase.date(from: $0) ?? ISO8601DateFormatter.whole.date(from: $0)
        }
        let isNew =
            made.map { Date().timeIntervalSince($0) < 120 } == true && !signedIn.user.providers.isEmpty
            && signedIn.user.providers.allSatisfy { $0 == "apple" }
        return AuthAnswer(outcome: isNew ? "new-account" : "in")
    }

    private struct AppleSheet {
        let idToken: String
        let code: String
        let nonce: String
        let name: String
    }

    private var sheetWaiter: CheckedContinuation<AppleSheet?, Error>?
    private var nonce = ""

    /// Apple's own sheet; nil when the person closed it.
    private func appleSheet() async throws -> AppleSheet? {
        nonce = Self.randomNonce()
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = SHA256.hash(data: Data(nonce.utf8)).map { String(format: "%02x", $0) }.joined()
        return try await withCheckedThrowingContinuation { waiter in
            sheetWaiter = waiter
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }

    private static func randomNonce() -> String {
        let letters = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        return String((0..<32).map { _ in letters.randomElement()! })
    }

    // MARK: A leaked password

    /// How often a password is in known leaks (Have I Been Pwned's range API:
    /// only the hash's first five letters leave the phone), nil when it can't be said.
    static func timesLeaked(_ password: String) async -> Int? {
        let hash = Insecure.SHA1.hash(data: Data(password.utf8)).map { String(format: "%02X", $0) }.joined()
        guard let url = URL(string: "https://api.pwnedpasswords.com/range/\(hash.prefix(5))") else { return nil }
        var request = URLRequest(url: url, timeoutInterval: 4)
        request.setValue("true", forHTTPHeaderField: "Add-Padding")
        guard let (data, response) = try? await URLSession.shared.data(for: request),
            (response as? HTTPURLResponse)?.statusCode == 200, let text = String(data: data, encoding: .utf8)
        else { return nil }
        let rest = hash.dropFirst(5)
        for line in text.split(whereSeparator: \.isNewline) {
            let parts = line.split(separator: ":")
            if parts.count == 2, parts[0].uppercased() == rest { return Int(parts[1].trimmingCharacters(in: .whitespaces)) ?? 0 }
        }
        return 0
    }
}

extension AppAuth: ASAuthorizationControllerDelegate {
    nonisolated func authorizationController(
        controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        let credential = authorization.credential as? ASAuthorizationAppleIDCredential
        let idToken = credential?.identityToken.flatMap { String(data: $0, encoding: .utf8) }
        let code = credential?.authorizationCode.flatMap { String(data: $0, encoding: .utf8) }
        let name = [credential?.fullName?.givenName, credential?.fullName?.familyName]
            .compactMap { $0?.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }.joined(separator: " ")
        MainActor.assumeIsolated {
            let waiter = sheetWaiter
            sheetWaiter = nil
            guard let idToken, let code else {
                waiter?.resume(throwing: AuthError(code: nil, status: 0, message: "Apple gave no identity token"))
                return
            }
            waiter?.resume(returning: AppleSheet(idToken: idToken, code: code, nonce: nonce, name: name))
        }
    }

    nonisolated func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        let cancelled = (error as? ASAuthorizationError)?.code == .canceled
        MainActor.assumeIsolated {
            let waiter = sheetWaiter
            sheetWaiter = nil
            if cancelled { waiter?.resume(returning: nil) } else { waiter?.resume(throwing: error) }
        }
    }
}

extension AppAuth: ASAuthorizationControllerPresentationContextProviding {
    nonisolated func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        MainActor.assumeIsolated {
            UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow }.first
                ?? ASPresentationAnchor()
        }
    }
}

extension ISO8601DateFormatter {
    /// Supabase's timestamps, with or without fractions of a second.
    nonisolated(unsafe) static let supabase: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    nonisolated(unsafe) static let whole = ISO8601DateFormatter()
}
