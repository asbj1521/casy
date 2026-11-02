import Foundation

/// Calling one of Casy's Edge Functions with the borrowed login (#196), as
/// `callFunction` in src/lib/supabaseFunctions.ts does: the publishable key,
/// the access token, `?lang=` for the answer's language, a minute at most, and
/// the function's own `error` text when it fails. The spike's version; the
/// real client is CasyAPI (Phase 1, #197).
enum EdgeFunctions {
    enum Failure: LocalizedError {
        case signedOut
        case server(String)

        var errorDescription: String? {
            switch self {
            case .signedOut: return "Not signed in"
            case .server(let message): return message
            }
        }
    }

    static func call<Answer: Decodable>(
        _ name: String, body: [String: Any], lang: String, as _: Answer.Type = Answer.self
    ) async throws -> Answer {
        guard let login = await SessionBox.shared.current() else { throw Failure.signedOut }
        var url = URLComponents(
            url: login.functionsURL.appendingPathComponent(name), resolvingAgainstBaseURL: false)!
        url.queryItems = [URLQueryItem(name: "lang", value: lang)]
        var request = URLRequest(url: url.url!, timeoutInterval: 60)
        request.httpMethod = "POST"
        request.setValue(login.apiKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(login.accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let own = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"]
            throw Failure.server(own as? String ?? "\(name) failed (HTTP \(status))")
        }
        return try JSONDecoder().decode(Answer.self, from: data)
    }
}
