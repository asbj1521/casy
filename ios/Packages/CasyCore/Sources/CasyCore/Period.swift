// A scheduling period in words, and the viewer's own clock:
// src/lib/periodText.ts and viewerTime.ts.

public struct Period: Codable, Sendable, Equatable {
    public var from: String
    public var to: String
    public var days: Bool?

    public init(from: String, to: String, days: Bool? = nil) {
        self.from = from
        self.to = to
        self.days = days
    }
}

/// The words a period is said in, from the String Catalog.
public struct PeriodWords: Sendable {
    public var any: String
    public var one: @Sendable (String) -> String
    public var range: @Sendable (String, String) -> String
    public var day: @Sendable (String) -> String
    public var until: @Sendable (String) -> String

    public init(
        any: String,
        one: @escaping @Sendable (String) -> String,
        range: @escaping @Sendable (String, String) -> String,
        day: @escaping @Sendable (String) -> String,
        until: @escaping @Sendable (String) -> String
    ) {
        self.any = any
        self.one = one
        self.range = range
        self.day = day
        self.until = until
    }
}

public func periodText(_ value: Period?, _ lang: Lang, _ words: PeriodWords, now: Int64) -> String {
    guard let value else { return words.any }
    let from = instantOrZero(value.from)
    let to = instantOrZero(value.to)
    if value.days == true {
        if value.from == value.to { return words.day(dayAndMonth(to, lang, short: false)) }
        if from <= startOfDay(now, appTimeZone) {
            return words.until(dayAndMonth(to, lang, short: false))
        }
        return words.range(
            dayAndMonth(from, lang, short: true),
            dayAndMonth(to, lang, short: true)
        )
    }
    if value.from == value.to { return words.one(monthName(from, lang)) }
    return words.range(monthShortName(from, lang), monthShortName(to, lang))
}

/// An event's date on the viewer's own clock, or nil when there is nothing to
/// add. `viewerZone` is the device's, which the app passes in.
public func yourTime(
    _ kind: EventKind,
    start: String,
    end: String,
    _ lang: Lang,
    viewerZone: String
) -> String? {
    if kind == .vacation { return nil }
    let year = localDate(instantOrZero(start), "UTC").year
    if sameClock(viewerZone, appTimeZone, year) { return nil }

    func time(_ iso: String) -> String { formatTime(iso, viewerZone) }
    func day(_ iso: String) -> String { formatDate(iso, lang, viewerZone) }
    if kind == .trip {
        let to = lang == .da ? "til" : "to"
        return "\(day(start)) \(time(start)) \(to) \(day(end)) \(time(end))"
    }
    let times = "\(time(start))-\(time(end))"
    let otherDay = formatDate(start, .en) != formatDate(start, .en, viewerZone)
    return otherDay ? "\(day(start)) \(times)" : times
}
