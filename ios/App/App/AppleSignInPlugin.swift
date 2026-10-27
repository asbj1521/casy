import AuthenticationServices
import Capacitor
import CryptoKit
import UIKit

/// Sign in with Apple (#138): iOS's own sheet (Face ID, the Apple account
/// already on the phone), whose identity token the page hands Supabase Auth.
///
/// A fresh random nonce goes to Apple hashed (SHA-256) and back to the page
/// as it is: Supabase checks that the token carries the hash of the nonce it
/// is given, so a token caught on its way can't be replayed. The one-time
/// authorization code goes to Casy's server, which keeps what it takes to
/// revoke the sign-in when the account is deleted (_shared/appleSignIn.ts).
public class AppleSignInPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppleSignInPlugin"
    public let jsName = "AppleSignIn"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise)
    ]

    /// The call waiting for the sheet to close, and the nonce it was given.
    /// One at a time: a second sheet can't open over the first anyway.
    private var pendingCall: CAPPluginCall?
    private var pendingNonce: String?

    /// The identity token, authorization code and nonce, with the person's
    /// name the first time they sign in (Apple sends it only then);
    /// `cancelled` when they close the sheet.
    @objc func signIn(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let nonce = Self.randomNonce()
            self.pendingCall = call
            self.pendingNonce = nonce
            let request = ASAuthorizationAppleIDProvider().createRequest()
            request.requestedScopes = [.fullName, .email]
            request.nonce = Self.sha256(nonce)
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }

    private static func randomNonce() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return bytes.map { String(format: "%02x", $0) }.joined()
    }

    private static func sha256(_ text: String) -> String {
        SHA256.hash(data: Data(text.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    private func finish(_ result: [String: Any]) {
        pendingCall?.resolve(result)
        pendingCall = nil
        pendingNonce = nil
    }

    private func fail(_ message: String) {
        pendingCall?.reject(message)
        pendingCall = nil
        pendingNonce = nil
    }
}

extension AppleSignInPlugin: ASAuthorizationControllerDelegate {
    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
            let tokenData = credential.identityToken,
            let identityToken = String(data: tokenData, encoding: .utf8),
            let codeData = credential.authorizationCode,
            let authorizationCode = String(data: codeData, encoding: .utf8),
            let nonce = pendingNonce
        else {
            fail("Apple gave no identity token")
            return
        }
        finish([
            "identityToken": identityToken,
            "authorizationCode": authorizationCode,
            "nonce": nonce,
            "givenName": credential.fullName?.givenName ?? "",
            "familyName": credential.fullName?.familyName ?? "",
        ])
    }

    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        if (error as? ASAuthorizationError)?.code == .canceled {
            finish(["cancelled": true])
        } else {
            fail(error.localizedDescription)
        }
    }
}

extension AppleSignInPlugin: ASAuthorizationControllerPresentationContextProviding {
    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        bridge?.webView?.window ?? ASPresentationAnchor()
    }
}
