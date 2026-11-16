// What you told Casy that is in no calendar (#116, Tilføj til kalender):
// src/lib/casyEntries.ts's entries and how their time reads.

/// An entry as the page shows and sends it: instants in UTC.
public struct CasyEntry: Codable, Sendable, Equatable, Hashable {
    /// "busy": time you can't meet. "away": somewhere else for a stretch (trips too).
    public var kind: String
    /// Short and plain, as the person sees it in their list.
    public var label: String
    /// ISO 8601 UTC, inclusive.
    public var start: String
    /// ISO 8601 UTC, exclusive.
    public var end: String
    /// Whole Danish days (local midnight to local midnight).
    public var allDay: Bool

    public init(kind: String, label: String, start: String, end: String, allDay: Bool) {
        self.kind = kind
        self.label = label
        self.start = start
        self.end = end
        self.allDay = allDay
    }
}

/// When an entry is, in Danish time: "man. 12. okt. til man. 19. okt." for whole
/// days, a single day as just that day, "fre. 16. okt. · 18:00-22:00" for hours,
/// and across midnight both ends in full.
public func entryWhen(_ entry: CasyEntry, _ lang: Lang) -> String {
    let start = parseInstant(entry.start) ?? 0
    let last = (parseInstant(entry.end) ?? 0) - 1
    let oneDay = startOfDay(start, appTimeZone) == startOfDay(last, appTimeZone)
    if entry.allDay {
        return oneDay ? formatDate(entry.start, lang) : formatDaySpan(entry.start, entry.end, lang)
    }
    if oneDay {
        return "\(formatDate(entry.start, lang)) · \(formatTime(entry.start))-\(formatTime(entry.end))"
    }
    let to = lang == .da ? "til" : "to"
    return "\(formatDate(entry.start, lang)) \(formatTime(entry.start)) \(to) \(formatDate(entry.end, lang)) \(formatTime(entry.end))"
}
