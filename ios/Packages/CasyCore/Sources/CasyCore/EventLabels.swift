// Event labels (#112), the app's half: src/lib/eventLabels.ts, and the
// pairing with the phone's events from eventWarnings.ts (labelledEvents).
// Which of this phone's events still need a label, the labels kept on the
// phone under a hash of title and calendar, and the person's corrections.
// Pure; the app keeps the book (Background/Labels.swift).

import Foundation

// The phone's events with what they are: `PhoneEventWithDetails` (CalendarDay.swift).

extension PhoneEventWithDetails {
    var calendarId: String { event.calendarId }
}

/// A title in a calendar as sent to calendar-label (`EventToLabel`).
public struct EventToLabel: Codable, Sendable, Equatable {
    public var title: String
    public var calendar: String
    public var allDay: Bool
    /// Minutes after midnight, Danish time (timed events).
    public var startMinute: Int
    /// Length in minutes (timed events).
    public var minutes: Int
    /// Days spanned (all-day events).
    public var days: Int
    /// How often it occurs.
    public var count: Int

    public init(title: String, calendar: String, allDay: Bool, startMinute: Int, minutes: Int, days: Int, count: Int) {
        self.title = title
        self.calendar = calendar
        self.allDay = allDay
        self.startMinute = startMinute
        self.minutes = minutes
        self.days = days
        self.count = count
    }
}

/// A label as this phone keeps it (`StoredLabel`): the AI's label and what goes with it.
public struct StoredLabel: Codable, Sendable, Equatable {
    public var label: EventLabel
    /// How often the title occurred when it was labelled, sent again with a correction.
    public var count: Int
    /// Labelled again from the person's own correction ("Forkert?"): never replaced.
    public var corrected: Bool?
    /// The phone calendar (EventKit id) it belongs to, so a correction can reach its neighbours.
    public var calendarId: String?
    /// To be labelled again: a correction in its calendar came after it.
    public var stale: Bool?

    public init(label: EventLabel, count: Int, corrected: Bool? = nil, calendarId: String? = nil, stale: Bool? = nil) {
        self.label = label
        self.count = count
        self.corrected = corrected
        self.calendarId = calendarId
        self.stale = stale
    }

    // Kept flat, as the web keeps it (`{ ...label, count, ... }`), so one book reads in both.
    private enum Extra: String, CodingKey { case count, corrected, calendarId, stale }

    public init(from decoder: Decoder) throws {
        label = try EventLabel(from: decoder)
        let c = try decoder.container(keyedBy: Extra.self)
        count = try c.decodeIfPresent(Int.self, forKey: .count) ?? 1
        corrected = try c.decodeIfPresent(Bool.self, forKey: .corrected)
        calendarId = try c.decodeIfPresent(String.self, forKey: .calendarId)
        stale = try c.decodeIfPresent(Bool.self, forKey: .stale)
    }

    public func encode(to encoder: Encoder) throws {
        try label.encode(to: encoder)
        var c = encoder.container(keyedBy: Extra.self)
        try c.encode(count, forKey: .count)
        try c.encodeIfPresent(corrected, forKey: .corrected)
        try c.encodeIfPresent(calendarId, forKey: .calendarId)
        try c.encodeIfPresent(stale, forKey: .stale)
    }
}

public typealias LabelBook = [String: StoredLabel]

/// One of the person's corrections, kept to send with later calls (`PhoneLabelCorrection`).
public struct PhoneLabelCorrection: Codable, Sendable, Equatable {
    public var key: String
    public var calendarId: String
    public var title: String
    /// The calendar's name, as sent.
    public var calendar: String
    /// What they wrote.
    public var note: String
    /// The label it got from their note.
    public var label: EventLabel
    public var at: Int64

    public init(key: String, calendarId: String, title: String, calendar: String, note: String, label: EventLabel, at: Int64) {
        self.key = key
        self.calendarId = calendarId
        self.title = title
        self.calendar = calendar
        self.note = note
        self.label = label
        self.at = at
    }
}

/// A correction as the server takes it.
public struct SentCorrection: Codable, Sendable, Equatable {
    public var title: String
    public var calendar: String
    public var note: String
    public var label: EventLabel
}

/// One distinct title in one calendar, ready to send.
public struct LabelCandidate: Codable, Sendable, Equatable {
    public var key: String
    /// Its phone calendar (EventKit id).
    public var calendarId: String
    public var event: EventToLabel
    /// When it next happens (or last did): soonest are labelled first.
    public var next: Int64
}

/// Titles sent per call (#132: fifty at once timed out).
public let labelBatchSize = 15
/// Labelled per run at most, soonest first; the rest wait for the next.
public let labelMaxPerRun = 300
/// Events that ended longer ago than this aren't labelled.
public let labelLookBackMs: Int64 = 7 * 86_400_000
/// Corrections kept, the most recent first; as many as the server takes.
public let maxLabelCorrections = 30

/// A title as compared: case, spacing and surrounding spaces don't matter.
public func normaliseTitle(_ title: String) -> String {
    title.trimmingCharacters(in: jsWhitespace)
        .split(whereSeparator: { $0.unicodeScalars.allSatisfy { jsWhitespace.contains($0) } })
        .joined(separator: " ")
        .lowercased()
}

/// JavaScript's `\s` and `trim()`: Unicode white space and line ends, and the BOM.
private let jsWhitespace: CharacterSet = {
    var set = CharacterSet.whitespacesAndNewlines
    set.insert(charactersIn: "\u{FEFF}")
    return set
}()

/// cyrb53 (`hash` in eventLabels.ts): a 53-bit string hash over UTF-16 code
/// units, in base 36. Not cryptographic; it only keeps titles from being kept.
public func labelHash(_ text: String) -> String {
    var h1: UInt32 = 0xdeadbeef
    var h2: UInt32 = 0x41c6ce57
    for ch in text.utf16 {
        h1 = (h1 ^ UInt32(ch)) &* 2654435761
        h2 = (h2 ^ UInt32(ch)) &* 1597334677
    }
    h1 = ((h1 ^ (h1 >> 16)) &* 2246822507) ^ ((h2 ^ (h2 >> 13)) &* 3266489909)
    h2 = ((h2 ^ (h2 >> 16)) &* 2246822507) ^ ((h1 ^ (h1 >> 13)) &* 3266489909)
    let value = UInt64(2097151 & h2) * 4294967296 + UInt64(h1)
    return String(value, radix: 36)
}

/// Where a title's label is kept: its phone calendar (EventKit id) and the title.
public func labelKey(_ calendarExternalId: String, _ title: String) -> String {
    labelHash("\(calendarExternalId)\n\(normaliseTitle(title))")
}

/// Minutes after midnight on the clock, Danish time.
public func clockMinute(_ ms: Int64) -> Int {
    let local = ms + offsetAt(ms, appTimeZone)
    // `%` keeps the sign, as JavaScript's (only before 1970 does it show).
    return Int(floorDiv(local, 60_000)) % (24 * 60)
}

private func floorDiv(_ a: Int64, _ b: Int64) -> Int64 {
    let q = a / b
    return (a % b != 0 && (a < 0) != (b < 0)) ? q - 1 : q
}

/// `Math.round` for halves: towards +infinity.
private func jsRound(_ x: Double) -> Int { Int((x + 0.5).rounded(.down)) }

/// The trip notes Casy writes ("Lagt ind af ...", #154; casyTripEntry.ts's
/// TRIP_NOTES with APP_NAME), before and after the rename; the parity cases
/// write every one of them, so a renamed app fails them until this follows.
public let casyTripNotes: Set<String> = [
    "Lagt ind af Vi finder lige en dag.", "Added by We'll find a day.",
    "Lagt ind af Casy.", "Added by Casy.",
]

/// Whether this phone event is a trip Casy wrote into the calendar itself.
public func isCasyTripEntry(_ e: PhoneEventWithDetails) -> Bool {
    casyTripNotes.contains((e.notes ?? "").trimmingCharacters(in: jsWhitespace))
}

/// The distinct titles among this phone's events, one per title and calendar,
/// soonest first; only what counts as busy in the calendars given, not ended
/// over a week ago, and not Casy's own trip entries.
public func labelCandidates(_ events: [PhoneEventWithDetails], _ calendarNames: [String: String], now: Int64) -> [LabelCandidate] {
    var byKey: [String: LabelCandidate] = [:]
    var order: [String] = []
    for e in events {
        guard let name = calendarNames[e.calendarId],
            let title = e.title?.trimmingCharacters(in: jsWhitespace), !title.isEmpty,
            let span = busySpan(e.event), span.end >= now - labelLookBackMs
        else { continue }
        if isCasyTripEntry(e) { continue }
        let key = labelKey(e.calendarId, title)
        let known = byKey[key]
        if let known {
            byKey[key]!.event.count += 1
            if abs(span.start - now) >= abs(known.next - now) { continue }
        } else {
            order.append(key)
        }
        let days = max(1, jsRound(Double(span.end - span.start) / 86_400_000))
        byKey[key] = LabelCandidate(
            key: key, calendarId: e.calendarId,
            event: EventToLabel(
                title: title, calendar: name, allDay: e.event.allDay,
                startMinute: e.event.allDay ? 0 : clockMinute(span.start),
                minutes: e.event.allDay ? 0 : jsRound(Double(span.end - span.start) / 60_000),
                days: e.event.allDay ? days : 1,
                count: byKey[key]?.event.count ?? 1),
            next: span.start)
    }
    // Past ones (within the week) after everything still to come; ties as the web's stable sort.
    func rank(_ c: LabelCandidate) -> Double { c.next >= now - 86_400_000 ? Double(c.next) : .infinity }
    return order.map { byKey[$0]! }.enumerated().sorted { a, b in
        let ra = rank(a.element), rb = rank(b.element)
        if ra != rb { return ra < rb }
        if a.element.next != b.element.next { return a.element.next > b.element.next }
        return a.offset < b.offset
    }.map(\.element)
}

/// Candidates with no label yet, or a stale one, not asked about this launch, in batches.
public func batchesToLabel(_ candidates: [LabelCandidate], _ book: LabelBook, asked: Set<String>) -> [[LabelCandidate]] {
    let wanted = candidates.filter { (book[$0.key] == nil || book[$0.key]?.stale == true) && !asked.contains($0.key) }
        .prefix(labelMaxPerRun)
    return stride(from: 0, to: wanted.count, by: labelBatchSize).map {
        Array(wanted[wanted.startIndex + $0..<wanted.startIndex + min($0 + labelBatchSize, wanted.count)])
    }
}

/// The book with new labels added (a correction is never overwritten by a background
/// label), and, when `present` is given, without labels whose event is gone.
public func updateBook(_ book: LabelBook, _ added: [(key: String, label: StoredLabel)], present: Set<String>? = nil) -> LabelBook {
    var next = present.map { keep in book.filter { keep.contains($0.key) } } ?? book
    for (key, label) in added {
        if next[key]?.corrected == true && label.corrected != true { continue }
        next[key] = label
    }
    return next
}

/// The book tidied against the phone's events: labels whose event is gone dropped,
/// the calendar filled in on old ones. Nil when there is nothing to tidy.
public func tidyBook(_ book: LabelBook, present: Set<String>, _ candidates: [LabelCandidate]) -> LabelBook? {
    var calendarOf: [String: String] = [:]
    for c in candidates { calendarOf[c.key] = c.calendarId }
    var changed = false
    var next: LabelBook = [:]
    for (key, label) in book {
        guard present.contains(key) else {
            changed = true
            continue
        }
        let calendarId = label.calendarId ?? calendarOf[key]
        if calendarId != label.calendarId {
            changed = true
            var filled = label
            filled.calendarId = calendarId
            next[key] = filled
        } else {
            next[key] = label
        }
    }
    return changed ? next : nil
}

/// After a correction in `calendarId`: every other label there that isn't the
/// person's own becomes stale. Returns the keys marked.
public func markCalendarStale(_ book: LabelBook, _ calendarId: String) -> (book: LabelBook, keys: [String]) {
    var keys: [String] = []
    var next = book
    for (key, label) in book.sorted(by: { $0.key < $1.key }) where label.calendarId == calendarId && label.corrected != true {
        keys.append(key)
        next[key]!.stale = true
    }
    return (next, keys)
}

/// Every key among the phone's events (labelled or not): what may be kept.
public func presentKeys(_ events: [PhoneEventWithDetails]) -> Set<String> {
    Set(events.compactMap { e in
        guard let title = e.title?.trimmingCharacters(in: jsWhitespace), !title.isEmpty else { return nil }
        return labelKey(e.calendarId, title)
    })
}

/// The corrections with a new one first, replacing an earlier one for the same event.
public func addCorrection(_ corrections: [PhoneLabelCorrection], _ correction: PhoneLabelCorrection) -> [PhoneLabelCorrection] {
    Array(([correction] + corrections.filter { $0.key != correction.key }).prefix(maxLabelCorrections))
}

/// The corrections as the server takes them.
public func correctionsToSend(_ corrections: [PhoneLabelCorrection]) -> [SentCorrection] {
    corrections.map { SentCorrection(title: $0.title, calendar: $0.calendar, note: $0.note, label: $0.label) }
}

/// Your own events with their labels, soonest first (`labelledEvents`, eventWarnings.ts).
public func labelledEvents(_ events: [PhoneEventWithDetails], _ book: LabelBook) -> [LabelledEvent] {
    var mine: [(Int, LabelledEvent)] = []
    for (i, e) in events.enumerated() {
        guard let title = e.title?.trimmingCharacters(in: jsWhitespace), !title.isEmpty,
            let span = busySpan(e.event), let stored = book[labelKey(e.calendarId, title)]
        else { continue }
        mine.append((i, LabelledEvent(title: title, start: span.start, end: span.end, allDay: e.event.allDay, label: stored.label)))
    }
    return mine.sorted { $0.1.start != $1.1.start ? $0.1.start < $1.1.start : $0.0 < $1.0 }.map(\.1)
}
