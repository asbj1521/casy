import BackgroundTasks
import EventKit
import Foundation
import Security

/// Sending the phone's calendars while the app isn't open (#63): iOS wakes
/// the app now and then (Background App Refresh) and this reads the calendars
/// and sends them, without the web page and so without the person's login.
/// It sends with the phone's own device token, which can only update this
/// phone's busy times (see supabase/functions/calendar-phone).
///
/// iOS decides when, if at all: often a few times a day for an app in use,
/// rarely for one seldom opened, never after it is force-quit, in Low Power
/// Mode, or with Background App Refresh switched off. Best effort, on top of
/// the sends whenever the app is opened.
enum PhoneCalendarBackground {
    static let taskId = "app.casy.phone-calendar-refresh"
    private static let configKey = "casy.phoneCalendar.background"
    private static let keychainService = "app.casy.phone-calendar"
    private static let dayMs: Double = 86_400_000

    struct Config: Codable {
        let url: String
        let apiKey: String
        let deviceId: String
        let label: String
    }

    // MARK: What it sends with

    static var isConfigured: Bool { loadConfig() != nil && loadToken() != nil }

    static func save(config: Config, token: String) -> Bool {
        guard let data = try? JSONEncoder().encode(config), saveToken(token) else { return false }
        UserDefaults.standard.set(data, forKey: configKey)
        return true
    }

    static func clear() {
        UserDefaults.standard.removeObject(forKey: configKey)
        SecItemDelete(tokenQuery() as CFDictionary)
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: taskId)
    }

    private static func loadConfig() -> Config? {
        guard let data = UserDefaults.standard.data(forKey: configKey) else { return nil }
        return try? JSONDecoder().decode(Config.self, from: data)
    }

    private static func tokenQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: "device-token",
        ]
    }

    /// Readable once the phone has been unlocked after starting, so a refresh
    /// while it is locked still works; never leaves this phone (no backups).
    private static func saveToken(_ token: String) -> Bool {
        SecItemDelete(tokenQuery() as CFDictionary)
        var add = tokenQuery()
        add[kSecValueData as String] = Data(token.utf8)
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        return SecItemAdd(add as CFDictionary, nil) == errSecSuccess
    }

    private static func loadToken() -> String? {
        var query = tokenQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
            let data = item as? Data
        else { return nil }
        return String(data: data, encoding: .utf8)
    }

    // MARK: The task

    /// Called once at launch (AppDelegate): iOS requires the handler be known
    /// before the app finishes launching.
    static func register() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: taskId, using: nil) { task in
            guard let task = task as? BGAppRefreshTask else {
                task.setTaskCompleted(success: false)
                return
            }
            handle(task)
        }
    }

    /// Ask iOS for the next wake-up, an hour from now at the earliest. Called
    /// when the app goes to the background and after each refresh.
    static func schedule() {
        guard isConfigured else { return }
        let request = BGAppRefreshTaskRequest(identifier: taskId)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 60 * 60)
        // Fails in the simulator and with refresh switched off; nothing to do then.
        try? BGTaskScheduler.shared.submit(request)
    }

    private static func handle(_ task: BGAppRefreshTask) {
        schedule()
        let work = Task { await send() }
        task.expirationHandler = { work.cancel() }
        Task { task.setTaskCompleted(success: await work.value) }
    }

    /// Read and send; true if the server took it.
    static func send() async -> Bool {
        guard let config = loadConfig(), let token = loadToken(),
            PhoneCalendarReader.accessState() == "granted",
            let url = URL(string: config.url + "/functions/v1/calendar-phone")
        else { return false }

        // The server's sync window (phoneWindow in phoneBusy.ts).
        let now = Date().timeIntervalSince1970 * 1000
        let from = now - 7 * dayMs
        let to = now + 360 * dayMs
        let (calendars, events) = PhoneCalendarReader.read(store: EKEventStore(), from: from, to: to)
        // No calendars at all is more likely a hiccup than the truth: send nothing.
        if calendars.isEmpty { return false }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(config.apiKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(config.apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue(token, forHTTPHeaderField: "x-device-token")
        let body: [String: Any] = [
            "deviceId": config.deviceId,
            "label": config.label,
            "calendars": PhoneBusy.push(calendars: calendars, events: events, from: from, to: to),
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: body) else { return false }
        request.httpBody = data

        do {
            let (answer, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { return false }
            // The connection was removed (or the token replaced): stop for good.
            if let json = try? JSONSerialization.jsonObject(with: answer) as? [String: Any],
                json["gone"] as? Bool == true
            {
                clear()
            }
            return true
        } catch {
            return false
        }
    }
}

/// The page's busy rules (src/lib/phoneBusy.ts, which is tested), repeated
/// for the background refresh, which runs without the page. Keep the two in
/// step: what blocks, whole days in Danish time, merging, names, hiding.
enum PhoneBusy {
    private static let danish: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Europe/Copenhagen") ?? .current
        return calendar
    }()

    private static let iso: ISO8601DateFormatter = {
        let format = ISO8601DateFormatter()
        format.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return format
    }()

    /// Local midnight in Danish time of a "YYYY-MM-DD" date, in epoch ms.
    private static func danishMidnight(_ day: String?) -> Double? {
        guard let day else { return nil }
        let parts = day.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3,
            let date = danish.date(
                from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
        else { return nil }
        return date.timeIntervalSince1970 * 1000
    }

    /// busySpan in phoneBusy.ts.
    private static func span(_ e: PhoneEventInfo) -> (start: Double, end: Double)? {
        if e.cancelled || e.declined { return nil }
        if e.allDay {
            guard let start = danishMidnight(e.startDay), let end = danishMidnight(e.endDay),
                end > start
            else { return nil }
            return (start, end)
        }
        if e.free { return nil }
        guard let start = e.start, let end = e.end, end > start else { return nil }
        return (start, end)
    }

    private static func merge(_ spans: [(start: Double, end: Double)]) -> [(start: Double, end: Double)] {
        var merged: [(start: Double, end: Double)] = []
        for s in spans.sorted(by: { $0.start < $1.start }) {
            if let last = merged.last, s.start <= last.end {
                merged[merged.count - 1].end = max(last.end, s.end)
            } else {
                merged.append(s)
            }
        }
        return merged
    }

    /// phoneBusy in phoneBusy.ts: every calendar and its merged blocks in the window.
    static func push(calendars: [PhoneCalendarInfo], events: [PhoneEventInfo], from: Double, to: Double)
        -> [[String: Any]]
    {
        var spans: [String: [(start: Double, end: Double)]] = [:]
        var timedIn = Set<String>()
        var anyIn = Set<String>()
        for e in events {
            anyIn.insert(e.calendarId)
            if !e.allDay { timedIn.insert(e.calendarId) }
            guard let s = span(e), s.end > from, s.start < to else { continue }
            spans[e.calendarId, default: []].append(s)
        }
        var count: [String: Int] = [:]
        for c in calendars { count[c.name, default: 0] += 1 }

        return calendars.map { c in
            let name = (count[c.name] ?? 0) > 1 && !c.account.isEmpty ? "\(c.name) (\(c.account))" : c.name
            let blocks = merge(spans[c.id] ?? []).map { s in
                [
                    "start": iso.string(from: Date(timeIntervalSince1970: s.start / 1000)),
                    "end": iso.string(from: Date(timeIntervalSince1970: s.end / 1000)),
                ]
            }
            return [
                "id": c.id,
                "name": name,
                "hidden": c.subscribed && anyIn.contains(c.id) && !timedIn.contains(c.id),
                "writable": c.writable,
                "blocks": blocks,
            ]
        }
    }
}
