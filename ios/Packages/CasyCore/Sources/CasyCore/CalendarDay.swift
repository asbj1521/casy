// Your calendar day by day (#199): calendar-busy's answer cut into each day's
// segments, the colour each calendar is drawn in, this phone's own events in
// place of its calendars' blocks, and where each block lands on a day's
// column. The shapes and rules of calendarOverview.ts, phoneEvents.ts,
// dayStrip.ts and tint.ts, kept equal by the parity fixtures.

import Foundation

/// One connected calendar, as calendar-busy returns it (`OverviewCalendar`).
public struct OverviewCalendar: Codable, Sendable, Equatable {
    public var id: String
    public var name: String
    public var originalName: String?
    public var renamed: Bool
    public var writable: Bool
    /// "work", "school", "personal" or "other"; nil when unset.
    public var purpose: String?
    public var categoryName: String?
    public var purposeGuessed: Bool?
    public var priority: String
    /// False once its owner unticked it: it then counts nowhere.
    public var included: Bool
    public var total: Int
    public var provider: String
    public var account: String?
    public var connectionId: String
    /// A phone calendar's EventKit id.
    public var externalId: String?
}

/// What an event on this phone is: shown on that phone only.
public struct EventDetails: Codable, Sendable, Equatable {
    public var title: String
    public var location: String
    public var notes: String

    public init(title: String, location: String, notes: String) {
        self.title = title
        self.location = location
        self.notes = notes
    }
}

/// A busy block: `start` inclusive, `end` exclusive, ISO 8601 UTC.
public struct OverviewBlock: Codable, Sendable, Equatable {
    public var calendarId: String
    public var start: String
    public var end: String
    public var details: EventDetails?

    public init(calendarId: String, start: String, end: String, details: EventDetails? = nil) {
        self.calendarId = calendarId
        self.start = start
        self.end = end
        self.details = details
    }
}

/// The part of one busy block that falls on one day, as epoch ms.
public struct DaySegment: Codable, Sendable, Equatable {
    public var calendarId: String
    public var start: Int64
    public var end: Int64
    public var allDay: Bool
    public var continuesBefore: Bool
    public var continuesAfter: Bool
    public var details: EventDetails?

    public init(
        calendarId: String, start: Int64, end: Int64, allDay: Bool, continuesBefore: Bool,
        continuesAfter: Bool, details: EventDetails? = nil
    ) {
        self.calendarId = calendarId
        self.start = start
        self.end = end
        self.allDay = allDay
        self.continuesBefore = continuesBefore
        self.continuesAfter = continuesAfter
        self.details = details
    }
}

/// Casy's built-in calendars: the Danish holidays, and what you told Casy.
public let holidayCalendarId = "builtin:dk-holidays"
public let casyCalendarId = "builtin:casy-entries"

private let holidayRGB = "220, 38, 38"
/// Casy's orange, as the month's calendar colours are written (homeVotes.ts's CASY_RGB too).
public let casyRGB = "234, 88, 12"
private let categoryRGB = [
    "work": "59, 130, 246",
    "school": "168, 85, 247",
    "personal": "34, 197, 94",
    "other": "113, 113, 122",
]
private let uncategorisedPalette = [
    "249, 115, 22",
    "20, 184, 166",
    "236, 72, 153",
    "234, 179, 8",
    "132, 204, 22",
    "6, 182, 212",
    "99, 102, 241",
]

/// One colour per calendar, `"r, g, b"`: its category's, else the next of a
/// palette; `own` (this phone's calendars in Apple's colours) wins.
public func calendarColors(_ calendars: [OverviewCalendar], own: [String: String] = [:]) -> [String: String] {
    var colors = [holidayCalendarId: holidayRGB, casyCalendarId: casyRGB]
    var uncategorised = 0
    for c in calendars {
        if let mine = own[c.id] {
            colors[c.id] = mine
        } else if let purpose = c.purpose, let rgb = categoryRGB[purpose] {
            colors[c.id] = rgb
        } else {
            colors[c.id] = uncategorisedPalette[uncategorised % uncategorisedPalette.count]
            uncategorised += 1
        }
    }
    return colors
}

private let maxDaysPerBlock = 400

/// Blocks split at midnight in `timeZone`, grouped by day ("YYYY-MM-DD"),
/// limited to [from, to); each day's sorted by start, then end.
public func segmentByDay(
    _ blocks: [OverviewBlock], from: Int64, to: Int64, _ timeZone: String
) -> [String: [DaySegment]] {
    var byDay: [String: [DaySegment]] = [:]
    for b in blocks {
        guard let bs = parseInstant(b.start), let be = parseInstant(b.end) else { continue }
        if !(be > bs) || be <= from || bs >= to { continue }
        let limit = min(be, to)
        var day = startOfDay(max(bs, from), timeZone)
        var n = 0
        while day < limit && n < maxDaysPerBlock {
            let next = addDays(day, 1, timeZone)
            let start = max(bs, day)
            let end = min(be, next)
            if end > start {
                let key = dayKey(day, timeZone)
                byDay[key, default: []].append(
                    DaySegment(
                        calendarId: b.calendarId, start: start, end: end,
                        allDay: start == day && end == next, continuesBefore: bs < day,
                        continuesAfter: be > next, details: b.details))
            }
            day = next
            n += 1
        }
    }
    for key in byDay.keys {
        byDay[key]?.sort { $0.start != $1.start ? $0.start < $1.start : $0.end < $1.end }
    }
    return byDay
}

/// A day as "YYYY-MM-DD" in `timeZone` (`dayKey`).
public func dayKey(_ ms: Int64, _ timeZone: String) -> String {
    let d = localDate(ms, timeZone)
    func two(_ n: Int) -> String { n < 10 ? "0\(n)" : "\(n)" }
    return "\(d.year)-\(two(d.month + 1))-\(two(d.day))"
}

/// This phone's calendars: their EventKit id to their id on the server.
public func phoneCalendarIds(_ calendars: [OverviewCalendar], connectionId: String) -> [String: String] {
    var ids: [String: String] = [:]
    for c in calendars where c.connectionId == connectionId {
        if let external = c.externalId, !external.isEmpty { ids[external] = c.id }
    }
    return ids
}

/// An event read on this phone, with what it is (`PhoneEventWithDetails`).
public struct PhoneEventWithDetails: Codable, Sendable, Equatable {
    public var event: PhoneEvent
    public var title: String?
    public var location: String?
    public var notes: String?

    public init(event: PhoneEvent, title: String?, location: String?, notes: String?) {
        self.event = event
        self.title = title
        self.location = location
        self.notes = notes
    }

    private enum Keys: String, CodingKey { case title, location, notes }

    /// Flat, as the web's: the event's fields and what it is side by side.
    public init(from decoder: Decoder) throws {
        event = try PhoneEvent(from: decoder)
        let c = try decoder.container(keyedBy: Keys.self)
        title = try c.decodeIfPresent(String.self, forKey: .title)
        location = try c.decodeIfPresent(String.self, forKey: .location)
        notes = try c.decodeIfPresent(String.self, forKey: .notes)
    }

    public func encode(to encoder: Encoder) throws {
        try event.encode(to: encoder)
        var c = encoder.container(keyedBy: Keys.self)
        try c.encodeIfPresent(title, forKey: .title)
        try c.encodeIfPresent(location, forKey: .location)
        try c.encodeIfPresent(notes, forKey: .notes)
    }
}

/// Your blocks with this phone's calendars drawn from the phone: their blocks
/// replaced by the phone's events in the window, one block each with what it
/// is; events that aren't busy time (cancelled, declined, free) left out.
public func withPhoneEvents(
    _ blocks: [OverviewBlock], _ events: [PhoneEventWithDetails], serverIdOf: [String: String],
    from: Int64, to: Int64
) -> [OverviewBlock] {
    if serverIdOf.isEmpty { return blocks }
    let replaced = Set(serverIdOf.values)
    var fromPhone: [OverviewBlock] = []
    for e in events {
        guard let calendarId = serverIdOf[e.event.calendarId], let span = busySpan(e.event),
            span.end > from, span.start < to
        else { continue }
        fromPhone.append(
            OverviewBlock(
                calendarId: calendarId, start: isoString(span.start), end: isoString(span.end),
                details: EventDetails(
                    title: trimmed(e.title), location: trimmed(e.location), notes: trimmed(e.notes))))
    }
    return blocks.filter { !replaced.contains($0.calendarId) } + fromPhone
}

/// JavaScript's `?.trim() ?? ""`: spaces, tabs and line breaks off both ends.
private func trimmed(_ text: String?) -> String {
    guard let text else { return "" }
    let space: Set<Character> = [" ", "\t", "\n", "\r", "\u{0B}", "\u{0C}", "\u{A0}"]
    var s = Substring(text)
    while let c = s.first, space.contains(c) { s = s.dropFirst() }
    while let c = s.last, space.contains(c) { s = s.dropLast() }
    return String(s)
}

// MARK: Where a block lands on its day (dayStrip.ts)

/// A timed block on its day's column, in fractions: from midnight, its
/// length, where it starts across and how much of it it takes.
public struct PlacedBlock: Codable, Sendable, Equatable {
    public var segment: DaySegment
    public var top: Double
    public var height: Double
    public var left: Double
    public var width: Double
}

/// How far a block starting during another is moved in, as Apple Calendar does.
private let indent = 0.3

/// Where [start, end) falls on the day starting at `midnight`, as fractions of it, clipped to it.
public func placeSpan(_ start: Int64, _ end: Int64, midnight: Int64, _ timeZone: String) -> (top: Double, height: Double) {
    let top = atHour(midnight, 0, timeZone)
    let bottom = atHour(midnight, 24, timeZone)
    let span = Double(bottom - top)
    let a = min(max(start, top), bottom)
    let b = min(max(end, top), bottom)
    return (Double(a - top) / span, Double(b - a) / span)
}

/// A day's timed blocks placed as Apple Calendar draws them: one starting
/// about together with the one under it (within `together`) shares its width;
/// one starting later is indented over it. `minHeight` is the least drawn.
public func placeBlocks(
    _ segments: [DaySegment], midnight: Int64, _ timeZone: String, minHeight: Double = 0,
    together: Double? = nil
) -> [PlacedBlock] {
    let together = together ?? minHeight
    let timed = segments.filter { !$0.allDay }
        .map { s -> PlacedBlock in
            let span = placeSpan(s.start, s.end, midnight: midnight, timeZone)
            return PlacedBlock(segment: s, top: span.top, height: span.height, left: 0, width: 1)
        }
        .filter { $0.height > 0 }
        .map { p -> PlacedBlock in
            var p = p
            p.height = min(max(p.height, minHeight), 1 - p.top)
            return p
        }
        .enumerated()
        // Earliest first; of two starting together, the longer underneath (a stable sort, as JS's).
        .sorted { a, b in
            if a.element.top != b.element.top { return a.element.top < b.element.top }
            if a.element.height != b.element.height { return a.element.height > b.element.height }
            return a.offset < b.offset
        }
        .map(\.element)

    var placed: [PlacedBlock] = []
    for block in timed {
        guard let i = placed.lastIndex(where: { $0.top + $0.height > block.top }) else {
            placed.append(block)
            continue
        }
        var next = block
        if block.top - placed[i].top < together {
            placed[i].width /= 2
            next.left = placed[i].left + placed[i].width
            next.width = placed[i].width
        } else {
            next.left = placed[i].left + placed[i].width * indent
            next.width = placed[i].left + placed[i].width - next.left
        }
        placed.append(next)
    }
    return placed
}

// MARK: Calendar colours as Apple Calendar draws events in them (tint.ts)

private let darkTintShare = 0.3
private let minContrast = 4.5

private func channels(_ rgb: String) -> [Double] {
    rgb.split(separator: ",").map { Double($0.trimmingCharacters(in: [" "])) ?? 0 }
}

private func luminance(_ rgb: [Double]) -> Double {
    let c = rgb.map { v -> Double in
        let x = v / 255
        return x <= 0.03928 ? x / 12.92 : pow((x + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

private func contrast(_ a: [Double], _ b: [Double]) -> Double {
    let (la, lb) = (luminance(a), luminance(b))
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)
}

/// JavaScript's Math.round: halves go up, also below zero.
private func jsRound(_ v: Double) -> Double { (v + 0.5).rounded(.down) }

private func joined(_ c: [Double]) -> String { c.map { String(Int(jsRound($0))) }.joined(separator: ", ") }

private func darkTint(_ c: [Double]) -> [Double] { c.map { jsRound($0 * darkTintShare) } }

/// The colour for a block's words on its own tint (`shade`).
public func shade(_ rgb: String, dark: Bool = false) -> String {
    let color = channels(rgb)
    if !dark { return joined(color.map { $0 * 0.72 }) }
    let ground = darkTint(color)
    var words = color
    var lift = 0.05
    while contrast(words, ground) < minContrast && lift <= 1 {
        words = color.map { jsRound($0 + (255 - $0) * lift) }
        lift += 0.05
    }
    return joined(words)
}

/// The tint of the colour, solid, to fill a block with (`tint`).
public func tint(_ rgb: String, dark: Bool = false) -> String {
    let color = channels(rgb)
    return joined(dark ? darkTint(color) : color.map { 255 - (255 - $0) * 0.16 })
}
