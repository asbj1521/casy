import Foundation
import Testing

@testable import CasyAPI

// Supabase Auth as auth-js speaks it (#202): the same requests, the same answers read.

private actor Sent {
    var requests: [URLRequest] = []
    func add(_ request: URLRequest) { requests.append(request) }
    var last: URLRequest? { requests.last }
}

private struct Wire: HTTPTransport {
    let sent = Sent()
    var status = 200
    var body: String

    func send(_ request: URLRequest) async throws -> (Data, URLResponse) {
        await sent.add(request)
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
        return (Data(body.utf8), response)
    }
}

private let session = """
    {"access_token":"at","token_type":"bearer","expires_in":3600,"expires_at":1800000000,
     "refresh_token":"rt","user":{"id":"u1","email":"mia@example.com","created_at":"2026-01-01T00:00:00Z",
     "user_metadata":{"lang":"en","full_name":"Mia"},
     "identities":[{"provider":"email"},{"provider":"apple"}]}}
    """

private func client(_ wire: Wire) -> AuthClient {
    AuthClient(projectURL: URL(string: "https://abc.supabase.co")!, apiKey: "pk", transport: wire)
}

private func body(_ request: URLRequest?) -> [String: Any] {
    (try? JSONSerialization.jsonObject(with: request?.httpBody ?? Data()) as? [String: Any]) ?? [:]
}

@Test func aPasswordSignInIsAuthJssRequest() async throws {
    let wire = Wire(body: session)
    let (signedIn, weak) = try await client(wire).signIn(email: "mia@example.com", password: "pw")
    let request = await wire.sent.last
    #expect(request?.url?.absoluteString == "https://abc.supabase.co/auth/v1/token?grant_type=password")
    #expect(request?.httpMethod == "POST")
    #expect(request?.value(forHTTPHeaderField: "apikey") == "pk")
    #expect(request?.value(forHTTPHeaderField: "Authorization") == "Bearer pk")
    #expect(request?.value(forHTTPHeaderField: "X-Supabase-Api-Version") == "2024-01-01")
    #expect(body(request)["email"] as? String == "mia@example.com")
    #expect(signedIn.accessToken == "at" && signedIn.refreshToken == "rt")
    #expect(signedIn.expiresAt == Date(timeIntervalSince1970: 1_800_000_000))
    #expect(signedIn.user.id == "u1" && signedIn.user.hasApple)
    #expect(signedIn.user.lang == "en")
    #expect(!weak)
}

@Test func aWeakPasswordIsSaid() async throws {
    let weakSession = session.replacingOccurrences(
        of: "\"refresh_token\"", with: "\"weak_password\":{\"reasons\":[\"length\"]},\"refresh_token\"")
    let (_, weak) = try await client(Wire(body: weakSession)).signIn(email: "a", password: "b")
    #expect(weak)
}

@Test func aRefusalCarriesItsCode() async {
    let wire = Wire(status: 400, body: #"{"code":"invalid_credentials","message":"Invalid login credentials"}"#)
    await #expect(throws: AuthError(code: "invalid_credentials", status: 400, message: "Invalid login credentials")) {
        _ = try await client(wire).signIn(email: "a", password: "b")
    }
    let old = Wire(status: 429, body: #"{"error_code":"over_email_send_rate_limit","msg":"slow down"}"#)
    await #expect(throws: AuthError(code: "over_email_send_rate_limit", status: 429, message: "slow down")) {
        try await client(old).sendLink(email: "a", redirectTo: "https://casy.app/sign-in?lang=da")
    }
}

@Test func signingUpTellsTheThreeOutcomes() async throws {
    let wire = Wire(body: #"{"id":"u2","email":"new@example.com","identities":[{"provider":"email"}]}"#)
    let outcome = try await client(wire).signUp(
        email: "new@example.com", password: "pw", name: "Ny", lang: "da", redirectTo: "https://casy.app/sign-in?lang=da")
    #expect(outcome == .confirm)
    let request = await wire.sent.last
    #expect(request?.url?.absoluteString == "https://abc.supabase.co/auth/v1/signup?redirect_to=https://casy.app/sign-in?lang%3Dda")
    #expect((body(request)["data"] as? [String: Any])?["full_name"] as? String == "Ny")
    let exists = try await client(Wire(body: #"{"id":"u3","identities":[]}"#)).signUp(
        email: "a", password: "b", name: "", lang: "da", redirectTo: "x")
    #expect(exists == .exists)
    if case .signedIn(let s) = try await client(Wire(body: session)).signUp(
        email: "a", password: "b", name: "", lang: "da", redirectTo: "x")
    {
        #expect(s.user.id == "u1")
    } else {
        Issue.record("a session answer signs in")
    }
}

@Test func appleSignsInAndLinksWithTheIdToken() async throws {
    let wire = Wire(body: session)
    _ = try await client(wire).signInWithApple(idToken: "idt", nonce: "n")
    var request = await wire.sent.last
    #expect(request?.url?.absoluteString == "https://abc.supabase.co/auth/v1/token?grant_type=id_token")
    #expect(body(request)["provider"] as? String == "apple")
    #expect(body(request)["link_identity"] == nil)
    _ = try await client(wire).linkApple(idToken: "idt", nonce: "n", accessToken: "user")
    request = await wire.sent.last
    #expect(body(request)["link_identity"] as? Bool == true)
    #expect(request?.value(forHTTPHeaderField: "Authorization") == "Bearer user")
}

@Test func signedInCallsCarryTheLogin() async throws {
    let wire = Wire(body: "{}")
    let auth = client(wire)
    try await auth.setPassword("new", code: "123456", accessToken: "user")
    var request = await wire.sent.last
    #expect(request?.httpMethod == "PUT" && request?.url?.path == "/auth/v1/user")
    #expect(body(request)["nonce"] as? String == "123456")
    try await auth.signOut(scope: "others", accessToken: "user")
    request = await wire.sent.last
    #expect(request?.url?.absoluteString == "https://abc.supabase.co/auth/v1/logout?scope=others")
    try await auth.reauthenticate(accessToken: "user")
    request = await wire.sent.last
    #expect(request?.httpMethod == "GET" && request?.url?.path == "/auth/v1/reauthenticate")
}

@Test func theAccountsLanguageIsKeptInItsData() async throws {
    let wire = Wire(body: "{}")
    try await client(wire).setLang("da", accessToken: "user")
    let request = await wire.sent.last
    #expect(request?.httpMethod == "PUT" && request?.url?.path == "/auth/v1/user")
    #expect((body(request)["data"] as? [String: Any])?["lang"] as? String == "da")
}

@Test func aLoginKeptBeforeTheLanguageWasStillReads() throws {
    let old = #"{"accessToken":"a","refreshToken":"r","expiresAt":0,"user":{"id":"u1","providers":["email"]}}"#
    let session = try JSONDecoder().decode(AuthSession.self, from: Data(old.utf8))
    #expect(session.user.lang == nil)
}
