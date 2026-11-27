import Foundation

/// The words of Supabase Realtime's socket (Phoenix, vsn 1.0.0: one JSON object
/// per message), as many as the live pulse needs: join one private topic, keep
/// the socket alive, hand it a fresh login, and hear a broadcast.
public enum RealtimeMessage {
    /// What came in, as far as the pulse cares.
    public enum Incoming: Equatable, Sendable {
        /// The join with this ref was let in.
        case joined(ref: String)
        /// The join with this ref was refused (no login, or not yours).
        case refused(ref: String)
        /// A broadcast on the topic: something you can see may have changed.
        case signal
        /// The server closed the topic or it failed (a login run out).
        case lost
        /// Anything else: heartbeat replies, presence, system notes.
        case other
    }

    /// The socket's address: the project's, wss for https, with the publishable key.
    public static func url(projectURL: URL, apiKey: String) -> URL? {
        guard var parts = URLComponents(url: projectURL, resolvingAgainstBaseURL: false) else { return nil }
        parts.scheme = parts.scheme == "http" ? "ws" : "wss"
        parts.path = (parts.path.hasSuffix("/") ? String(parts.path.dropLast()) : parts.path) + "/realtime/v1/websocket"
        parts.queryItems = [URLQueryItem(name: "apikey", value: apiKey), URLQueryItem(name: "vsn", value: "1.0.0")]
        return parts.url
    }

    /// The topic as Realtime names it.
    public static func topic(_ name: String) -> String { "realtime:\(name)" }

    /// Joining a private topic with the login (realtime-js's channel join).
    public static func join(topic: String, token: String, ref: String) -> Data {
        encode([
            "topic": topic,
            "event": "phx_join",
            "payload": [
                "config": [
                    "broadcast": ["ack": false, "self": false],
                    "presence": ["key": "", "enabled": false],
                    "postgres_changes": [Any](),
                    "private": true,
                ],
                "access_token": token,
            ],
            "ref": ref,
            "join_ref": ref,
        ])
    }

    /// The socket's sign of life, every 25 seconds.
    public static func heartbeat(ref: String) -> Data {
        encode(["topic": "phoenix", "event": "heartbeat", "payload": [String: Any](), "ref": ref])
    }

    /// A refreshed login for a topic already joined, before the old one runs out.
    public static func accessToken(topic: String, token: String, ref: String) -> Data {
        encode(["topic": topic, "event": "access_token", "payload": ["access_token": token], "ref": ref])
    }

    /// What a message means for `topic`.
    public static func read(_ data: Data, topic: String) -> Incoming {
        guard let message = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            message["topic"] as? String == topic,
            let event = message["event"] as? String
        else { return .other }
        let payload = message["payload"] as? [String: Any]
        switch event {
        case "phx_reply":
            guard let ref = message["ref"] as? String, ref == message["join_ref"] as? String ?? ref else {
                return .other
            }
            // Only the join's reply matters; a heartbeat's comes on "phoenix".
            return payload?["status"] as? String == "ok" ? .joined(ref: ref) : .refused(ref: ref)
        case "broadcast":
            return .signal
        case "phx_close", "phx_error":
            return .lost
        case "system":
            return payload?["status"] as? String == "error" ? .lost : .other
        default:
            return .other
        }
    }

    private static func encode(_ object: [String: Any]) -> Data {
        (try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])) ?? Data()
    }
}

/// Being told when your pulse may have moved (#202, the web's livePush.ts): a
/// socket to Supabase Realtime joined to the private topic `pulse:<your id>`,
/// which the database's triggers send an empty broadcast to whenever a write
/// concerns you. A message carries no data, only "ask the pulse again".
///
/// If the socket fails or the join is refused it says so (`.live(false)`) and
/// tries again after 5 s, 15 s, a minute, then every 5 minutes; until it is
/// back the app asks the pulse on its own.
public actor PulseSocket {
    public enum Event: Sendable, Equatable {
        /// Messages arrive now (joined), or not (connecting, failed).
        case live(Bool)
        /// Something you can see may have changed.
        case signal
    }

    public nonisolated let events: AsyncStream<Event>
    private let continuation: AsyncStream<Event>.Continuation

    private let url: URL
    private let topic: String
    private let token: @Sendable () async -> String?
    private let retryDelays: [Duration]
    private let heartbeatEvery: Duration

    private var task: URLSessionWebSocketTask?
    private var running = false
    private var failures = 0
    private var ref = 0
    private var joinRef = ""
    private var sentToken: String?
    private var loops: [Task<Void, Never>] = []

    public init?(
        projectURL: URL, apiKey: String, userId: String,
        token: @escaping @Sendable () async -> String?,
        retryDelays: [Duration] = [.seconds(5), .seconds(15), .seconds(60), .seconds(300)],
        heartbeatEvery: Duration = .seconds(25)
    ) {
        guard let url = RealtimeMessage.url(projectURL: projectURL, apiKey: apiKey) else { return nil }
        self.url = url
        self.topic = RealtimeMessage.topic("pulse:\(userId)")
        self.token = token
        self.retryDelays = retryDelays
        self.heartbeatEvery = heartbeatEvery
        (events, continuation) = AsyncStream.makeStream(bufferingPolicy: .bufferingNewest(8))
    }

    public func start() {
        guard !running else { return }
        running = true
        failures = 0
        connect()
    }

    /// Closed for good; `events` ends.
    public func stop() {
        running = false
        drop()
        continuation.finish()
    }

    private func nextRef() -> String {
        ref += 1
        return String(ref)
    }

    private func connect() {
        guard running else { return }
        let task = URLSession.shared.webSocketTask(with: url)
        self.task = task
        task.resume()
        loops = [
            Task { [weak self] in await self?.join(on: task) },
            Task { [weak self] in await self?.listen(on: task) },
        ]
    }

    private func join(on task: URLSessionWebSocketTask) async {
        guard let token = await token() else { return failed(task) }
        sentToken = token
        joinRef = nextRef()
        do {
            try await task.send(.data(RealtimeMessage.join(topic: topic, token: token, ref: joinRef)))
        } catch {
            return failed(task)
        }
        guard self.task === task else { return }
        loops.append(Task { [weak self] in await self?.beat(on: task) })
    }

    private func beat(on task: URLSessionWebSocketTask) async {
        while !Task.isCancelled {
            try? await Task.sleep(for: heartbeatEvery)
            guard !Task.isCancelled, self.task === task else { return }
            // A refreshed login reaches Realtime before the old one runs out.
            if let fresh = await token(), fresh != sentToken {
                sentToken = fresh
                try? await task.send(.data(RealtimeMessage.accessToken(topic: topic, token: fresh, ref: nextRef())))
            }
            do {
                try await task.send(.data(RealtimeMessage.heartbeat(ref: nextRef())))
            } catch {
                return failed(task)
            }
        }
    }

    private func listen(on task: URLSessionWebSocketTask) async {
        while !Task.isCancelled {
            let message: URLSessionWebSocketTask.Message
            do {
                message = try await task.receive()
            } catch {
                return failed(task)
            }
            guard self.task === task else { return }
            let data: Data
            switch message {
            case .data(let d): data = d
            case .string(let s): data = Data(s.utf8)
            @unknown default: continue
            }
            switch RealtimeMessage.read(data, topic: topic) {
            case .joined(let ref) where ref == joinRef:
                failures = 0
                continuation.yield(.live(true))
            case .refused(let ref) where ref == joinRef:
                return failed(task)
            case .signal:
                continuation.yield(.signal)
            case .lost:
                return failed(task)
            default:
                break
            }
        }
    }

    /// Start over from a fresh socket after a while, rather than trust this one to recover.
    private func failed(_ task: URLSessionWebSocketTask) {
        guard running, self.task === task else { return }
        drop()
        continuation.yield(.live(false))
        let delay = retryDelays[min(failures, retryDelays.count - 1)]
        failures += 1
        loops = [
            Task { [weak self] in
                try? await Task.sleep(for: delay)
                guard !Task.isCancelled else { return }
                await self?.connect()
            }
        ]
    }

    private func drop() {
        for loop in loops { loop.cancel() }
        loops = []
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
    }
}
