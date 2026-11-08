// The phone's calendars turned into what Casy stores: src/lib/phoneBusy.ts.
// The app's own PhoneBusy keeps running until the background work goes native
// (Phase 5); this is the version the native screens will use.

public struct PhoneCalendar: Codable, Sendable, Equatable {
    public var id: String
    public var name: String
    public var account: String
    public var subscribed: Bool
    public var writable: Bool

    public init(id: String, name: String, account: String, subscribed: Bool, writable: Bool) {
        self.id = id
        self.name = name
        self.account = account
        self.subscribed = subscribed
        self.writable = writable
    }
}

public struct PhoneEvent: Codable, Sendable, Equatable {
    public var calendarId: String
    public var allDay: Bool
    public var free: Bool
    public var cancelled: Bool
    public var declined: Bool
    public var start: Int64?
    public var end: Int64?
    public var startDay: String?
    public var endDay: String?

    public init(
        calendarId: String,
        allDay: Bool,
        free: Bool,
        cancelled: Bool,
        declined: Bool,
        start: Int64? = nil,
        end: Int64? = nil,
        startDay: String? = nil,
        endDay: String? = nil
    ) {
        self.calendarId = calendarId
        self.allDay = allDay
        self.free = free
        self.cancelled = cancelled
        self.declined = declined
        self.start = start
        self.end = end
        self.startDay = startDay
        self.endDay = endDay
    }
}

public struct PhoneRead: Codable, Sendable, Equatable {
    public var calendars: [PhoneCalendar]
    public var events: [PhoneEvent]

    public init(calendars: [PhoneCalendar], events: [PhoneEvent]) {
        self.calendars = calendars
        self.events = events
    }
}

public struct PhoneBlock: Codable, Sendable, Equatable {
    public var start: String
    public var end: String
}

public struct PhoneCalendarPush: Codable, Sendable, Equatable {
    public var id: String
    public var name: String
    public var hidden: Bool
    public var writable: Bool
    public var blocks: [PhoneBlock]
}

public struct InstantSpan: Codable, Sendable, Equatable {
    public var start: Int64
    public var end: Int64

    public init(start: Int64, end: Int64) {
        self.start = start
        self.end = end
    }
}

public struct PhoneWindow: Codable, Sendable, Equatable {
    public var from: Int64
    public var to: Int64

    public init(from: Int64, to: Int64) {
        self.from = from
        self.to = to
    }
}

private let dayMs: Int64 = 86_400_000

/// The span to read around `now`: the server's sync window, in plain milliseconds.
public func phoneWindow(_ now: Int64) -> PhoneWindow {
    PhoneWindow(from: now - 7 * dayMs, to: now + 12 * 30 * dayMs)
}

private func danishMidnight(_ day: String?) -> Int64? {
    guard let day,
        let m = day.wholeMatch(of: /(\d{4})-(\d{2})-(\d{2})/.asciiOnlyDigits()),
        let year = Int(m.1), let month = Int(m.2), let date = Int(m.3)
    else { return nil }
    return wallTime(year, month - 1, date, 0, appTimeZone)
}

/// The instants an event keeps busy, or nil if it doesn't block at all.
public func busySpan(_ event: PhoneEvent) -> InstantSpan? {
    if event.cancelled || event.declined { return nil }
    if event.allDay {
        guard let start = danishMidnight(event.startDay),
            let end = danishMidnight(event.endDay), end > start
        else { return nil }
        return InstantSpan(start: start, end: end)
    }
    if event.free { return nil }
    guard let start = event.start, let end = event.end, end > start else { return nil }
    return InstantSpan(start: start, end: end)
}

private func merge(_ spans: [InstantSpan]) -> [InstantSpan] {
    var merged: [InstantSpan] = []
    for span in stableSorted(spans, by: { $0.start < $1.start }) {
        if let last = merged.last, span.start <= last.end {
            merged[merged.count - 1].end = max(last.end, span.end)
        } else {
            merged.append(span)
        }
    }
    return merged
}

/// What the app sends: every calendar on the phone and its merged busy blocks.
public func phoneBusy(_ read: PhoneRead, _ window: PhoneWindow) -> [PhoneCalendarPush] {
    var spans: [String: [InstantSpan]] = [:]
    var timedIn = Set<String>()
    var anyIn = Set<String>()
    for event in read.events {
        anyIn.insert(event.calendarId)
        if !event.allDay { timedIn.insert(event.calendarId) }
        guard let span = busySpan(event), span.end > window.from, span.start < window.to else {
            continue
        }
        spans[event.calendarId, default: []].append(span)
    }
    var nameCount: [String: Int] = [:]
    for calendar in read.calendars { nameCount[calendar.name, default: 0] += 1 }
    return read.calendars.map { c in
        let shared = (nameCount[c.name] ?? 0) > 1 && !c.account.isEmpty
        return PhoneCalendarPush(
            id: c.id,
            name: shared ? "\(c.name) (\(c.account))" : c.name,
            hidden: c.subscribed && anyIn.contains(c.id) && !timedIn.contains(c.id),
            writable: c.writable,
            blocks: merge(spans[c.id] ?? []).map {
                PhoneBlock(start: isoString($0.start), end: isoString($0.end))
            }
        )
    }
}
