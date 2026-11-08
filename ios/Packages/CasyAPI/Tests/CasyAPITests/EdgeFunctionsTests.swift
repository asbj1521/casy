import CasyCore
import Foundation
import Testing

@testable import CasyAPI

private struct Session: SessionProviding {
    let token: String?
    func accessToken() async -> String? { token }
}

private actor Recorder {
    var requests: [URLRequest] = []
    func add(_ request: URLRequest) { requests.append(request) }
}

private struct Fake: HTTPTransport {
    let recorder = Recorder()
    var status = 200
    var body = "{}"
    var fails: (any Error)?
    var delay: Duration?

    func send(_ request: URLRequest) async throws -> (Data, URLResponse) {
        await recorder.add(request)
        if let delay { try await Task.sleep(for: delay) }
        if let fails { throw fails }
        let response = HTTPURLResponse(
            url: try #require(request.url), statusCode: status, httpVersion: nil,
            headerFields: nil)
        return (Data(body.utf8), try #require(response))
    }
}

private func client(
    _ fake: Fake,
    token: String? = "user-token",
    lang: Lang = .da,
    timeout: Duration = .seconds(5)
) throws -> EdgeFunctions {
    EdgeFunctions(
        configuration: APIConfiguration(
            projectURL: try #require(URL(string: "https://example.supabase.co")),
            publishableKey: "publishable", timeout: timeout),
        session: Session(token: token),
        transport: fake,
        language: { lang }
    )
}

private struct Body: Encodable, Sendable {
    let action: String
}

private func failure(_ work: () async throws -> Void) async -> APIError? {
    do {
        try await work()
        return nil
    } catch {
        return error as? APIError
    }
}

@Test func aPostCarriesTheHeadersTheWebSends() async throws {
    let fake = Fake()
    let _: NoAnswer = try await client(fake).call("groups", body: Body(action: "list"))
    let request = try #require(await fake.recorder.requests.first)
    #expect(request.httpMethod == "POST")
    #expect(request.value(forHTTPHeaderField: "apikey") == "publishable")
    #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer user-token")
    #expect(request.value(forHTTPHeaderField: "Content-Type") == "application/json")
    #expect(request.url?.absoluteString == "https://example.supabase.co/functions/v1/groups?lang=da")
    #expect(request.httpBody == Data(#"{"action":"list"}"#.utf8))
}

@Test func aCallWithoutABodyIsAGetWithItsParameters() async throws {
    let fake = Fake()
    let _: NoAnswer = try await client(fake, lang: .en).call(
        "calendar-busy", params: ["from": "a", "to": "b"])
    let request = try #require(await fake.recorder.requests.first)
    #expect(request.httpMethod == "GET")
    #expect(request.httpBody == nil)
    #expect(request.value(forHTTPHeaderField: "Content-Type") == nil)
    #expect(request.url?.query == "from=a&to=b&lang=en")
}

@Test func signedOutTheKeyStandsInForTheToken() async throws {
    let fake = Fake()
    let _: NoAnswer = try await client(fake, token: nil).call("health")
    let request = try #require(await fake.recorder.requests.first)
    #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer publishable")
}

@Test func aFunctionsOwnErrorWins() async throws {
    var fake = Fake()
    fake.status = 400
    fake.body = #"{"error":"Gruppen findes ikke"}"#
    let api = try client(fake)
    let error = await failure {
        let _: NoAnswer = try await api.call("groups", errorMessage: "Kunne ikke hente")
    }
    #expect(error == .failed(status: 400, message: "Gruppen findes ikke"))
}

@Test func withoutOneTheScreensFallbackIsUsed() async throws {
    var fake = Fake()
    fake.status = 500
    fake.body = "Internal error"
    let api = try client(fake)
    let error = await failure {
        let _: NoAnswer = try await api.call("groups", errorMessage: "Kunne ikke hente")
    }
    #expect(error == .failed(status: 500, message: "Kunne ikke hente (HTTP 500)"))
}

@Test func withNoFallbackTheFunctionIsNamed() async throws {
    var fake = Fake()
    fake.status = 503
    fake.body = ""
    let api = try client(fake, lang: .en)
    let error = await failure { let _: NoAnswer = try await api.call("groups") }
    #expect(error == .failed(status: 503, message: "groups failed (HTTP 503)"))
}

@Test func noConnectionIsSaidInTheLanguage() async throws {
    var fake = Fake()
    fake.fails = URLError(.notConnectedToInternet)
    let api = try client(fake)
    let error = await failure { let _: NoAnswer = try await api.call("groups") }
    #expect(error == .offline("Ingen forbindelse til Casy. Tjek dit internet, og prøv igen."))
}

@Test func aCallThatHangsGivesUp() async throws {
    var fake = Fake()
    fake.delay = .seconds(30)
    let api = try client(fake, lang: .en, timeout: .milliseconds(20))
    let error = await failure { let _: NoAnswer = try await api.call("groups") }
    #expect(error == .timedOut("Casy took too long to answer. Try again."))
}

@Test func aSuccessWithAnUnreadableBodyCountsAsEmpty() async throws {
    var fake = Fake()
    fake.body = "not json"
    let _: NoAnswer = try await client(fake).call("groups")
}

@Test func aSuccessOfTheWrongShapeIsAnErrorNotACrash() async throws {
    var fake = Fake()
    fake.body = #"{"nope":true}"#
    let api = try client(fake, lang: .en)
    let error = await failure {
        let _: AdminStatus = try await api.call("admin")
    }
    #expect(error == .unreadable("admin failed (HTTP 200)"))
}

@Test func deletingAnAccountSendsTheServersGuard() async throws {
    let fake = Fake()
    try await client(fake).deleteMyAccount()
    let request = try #require(await fake.recorder.requests.first)
    let sent = try #require(request.httpBody)
    let object = try #require(JSONSerialization.jsonObject(with: sent) as? [String: Any])
    #expect(object["action"] as? String == "delete")
    #expect(object["confirm"] as? Bool == true)
}
