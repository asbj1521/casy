// How the app calls an Edge Function: src/lib/supabaseFunctions.ts. The same
// headers, the same `lang` parameter, the same 60 seconds and the same rule
// for errors, so a function can't tell the two apart.

import CasyCore
import Foundation

/// Where the backend is. Supplied by the app; nothing here knows a real project.
public struct APIConfiguration: Sendable {
    public var projectURL: URL
    public var publishableKey: String
    public var timeout: Duration

    public init(projectURL: URL, publishableKey: String, timeout: Duration = .seconds(60)) {
        self.projectURL = projectURL
        self.publishableKey = publishableKey
        self.timeout = timeout
    }
}

/// Who is asking. Until the session moves to native it is borrowed from the
/// web view, in memory only. Nil when signed out.
public protocol SessionProviding: Sendable {
    func accessToken() async -> String?
}

/// What actually carries a request, so the tests need no network.
public protocol HTTPTransport: Sendable {
    func send(_ request: URLRequest) async throws -> (Data, URLResponse)
}

public struct URLSessionTransport: HTTPTransport {
    private let session: URLSession

    public init(session: URLSession = .shared) {
        self.session = session
    }

    public func send(_ request: URLRequest) async throws -> (Data, URLResponse) {
        try await session.data(for: request)
    }
}

/// A call that failed, with what to show the person.
public enum APIError: LocalizedError, Equatable, Sendable {
    case offline(String)
    case timedOut(String)
    /// The function said no: its own words, or the fallback.
    case failed(status: Int, message: String)
    /// A successful answer that doesn't have the expected shape.
    case unreadable(String)

    public var errorDescription: String? {
        switch self {
        case .offline(let message), .timedOut(let message), .unreadable(let message):
            return message
        case .failed(_, let message):
            return message
        }
    }
}

private func offlineWords(_ lang: Lang) -> String {
    lang == .da
        ? "Ingen forbindelse til Casy. Tjek dit internet, og prøv igen."
        : "Couldn't reach Casy. Check your connection and try again."
}

private func timeoutWords(_ lang: Lang) -> String {
    lang == .da ? "Casy svarede ikke i tide. Prøv igen." : "Casy took too long to answer. Try again."
}

private func failedWords(_ name: String, _ status: Int, _ lang: Lang) -> String {
    lang == .da ? "\(name) fejlede (HTTP \(status))" : "\(name) failed (HTTP \(status))"
}

private struct OwnError: Decodable {
    let error: String?
}

public struct EdgeFunctions: Sendable {
    private let configuration: APIConfiguration
    private let session: any SessionProviding
    private let transport: any HTTPTransport
    private let language: @Sendable () -> Lang

    public init(
        configuration: APIConfiguration,
        session: any SessionProviding,
        transport: any HTTPTransport = URLSessionTransport(),
        language: @escaping @Sendable () -> Lang
    ) {
        self.configuration = configuration
        self.session = session
        self.transport = transport
        self.language = language
    }

    /// Call one Edge Function. A `body` makes it a POST. A function's own
    /// `error` wins over `errorMessage`, being written for the person reading.
    public func call<Answer: Decodable>(
        _ name: String,
        params: [String: String] = [:],
        body: (any Encodable & Sendable)? = nil,
        errorMessage: String? = nil,
        as type: Answer.Type = Answer.self
    ) async throws -> Answer {
        let lang = language()
        let request = try await makeRequest(name, params: params, body: body, lang: lang)
        let (data, response) = try await sendWithinTimeout(request, lang: lang)

        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let own = (try? JSONDecoder().decode(OwnError.self, from: data))?.error
            let fallback =
                errorMessage.map { "\($0) (HTTP \(status))" }
                ?? failedWords(name, status, lang)
            throw APIError.failed(status: status, message: own ?? fallback)
        }

        // As on the web, a success with a body that won't parse counts as `{}`.
        let usable = (try? JSONSerialization.jsonObject(with: data)) != nil ? data : Data("{}".utf8)
        do {
            return try JSONDecoder().decode(Answer.self, from: usable)
        } catch {
            throw APIError.unreadable(failedWords(name, status, lang))
        }
    }

    private func makeRequest(
        _ name: String,
        params: [String: String],
        body: (any Encodable & Sendable)?,
        lang: Lang
    ) async throws -> URLRequest {
        let base = configuration.projectURL.appending(path: "functions/v1/\(name)")
        var parts = URLComponents(url: base, resolvingAgainstBaseURL: false)
        var items = params.sorted { $0.key < $1.key }
            .filter { $0.key != "lang" }
            .map { URLQueryItem(name: $0.key, value: $0.value) }
        items.append(URLQueryItem(name: "lang", value: lang.rawValue))
        parts?.queryItems = items
        guard let url = parts?.url else {
            throw APIError.unreadable(failedWords(name, 0, lang))
        }

        var request = URLRequest(url: url)
        let token = await session.accessToken() ?? configuration.publishableKey
        request.setValue(configuration.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        if let body {
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(body)
        }
        return request
    }

    private func sendWithinTimeout(
        _ request: URLRequest,
        lang: Lang
    ) async throws -> (Data, URLResponse) {
        let transport = self.transport
        let timeout = configuration.timeout
        do {
            return try await withThrowingTaskGroup(of: (Data, URLResponse).self) { group in
                group.addTask { try await transport.send(request) }
                group.addTask {
                    try await Task.sleep(for: timeout)
                    throw URLError(.timedOut)
                }
                defer { group.cancelAll() }
                guard let first = try await group.next() else { throw URLError(.unknown) }
                return first
            }
        } catch is CancellationError {
            throw CancellationError()
        } catch let error as URLError where error.code == .cancelled {
            throw CancellationError()
        } catch let error as URLError where error.code == .timedOut {
            throw APIError.timedOut(timeoutWords(lang))
        } catch {
            throw APIError.offline(offlineWords(lang))
        }
    }
}
