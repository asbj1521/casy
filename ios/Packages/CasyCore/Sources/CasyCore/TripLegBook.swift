// Trip detection's background half (#115): src/lib/tripLegBook.ts's leg reading.
// Which of this phone's events the labels call a journey, each distinct title
// and place in a calendar once, and the legs kept on the phone. Pure; the app
// keeps the book (Background/Trips.swift). Pairing legs into trips stays the
// page's (trips.ts) until the home page is native.

import Foundation

/// A leg as `trip-legs` reads it (`TripLeg`): flight, train, bus or none, between which cities.
public struct TripLeg: Codable, Sendable, Equatable {
    /// "flight", "train", "bus" or "none".
    public var mode: String
    /// City names in English, "HOME", or "" when nothing says.
    public var from: String
    public var to: String
    public var confidence: String

    public init(mode: String, from: String, to: String, confidence: String) {
        self.mode = mode
        self.from = from
        self.to = to
        self.confidence = confidence
    }
}

/// One distinct travel event, as sent (`EventToRead`).
public struct EventToRead: Codable, Sendable, Equatable {
    public var title: String
    public var location: String
    public var calendar: String
    public var allDay: Bool
}

public typealias LegBook = [String: TripLeg]

/// One distinct travel event in one calendar, ready to send.
public struct LegCandidate: Codable, Sendable, Equatable {
    public var key: String
    public var event: EventToRead
    /// When it next happens (or last did): soonest are read first.
    public var next: Int64
}

/// Events sent per call.
public let legBatchSize = 20
/// Read per run at most, soonest first.
public let legMaxPerRun = 150

private let travelKinds: Set<String> = ["flight", "travel"]

/// Where a leg is kept: its phone calendar, title and place.
public func legKey(_ calendarId: String, _ title: String, _ location: String) -> String {
    labelHash("\(calendarId)\n\(normaliseTitle(title))\n\(normaliseTitle(location))")
}

/// An event's title, place and key when the labels call it a journey; never Casy's own trip entry.
func travelOf(_ e: PhoneEventWithDetails, _ labels: LabelBook) -> (title: String, location: String, key: String)? {
    guard let title = e.title?.trimmingCharacters(in: .whitespacesAndNewlines), !title.isEmpty, !isCasyTripEntry(e),
        let label = labels[labelKey(e.calendarId, title)], travelKinds.contains(label.label.kind)
    else { return nil }
    let location = e.location?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return (title, location, legKey(e.calendarId, title, location))
}

/// The distinct travel events in the calendars that count, not ended over a week ago, soonest first.
public func travelCandidates(
    _ events: [PhoneEventWithDetails], _ labels: LabelBook, _ calendarNames: [String: String], now: Int64
) -> [LegCandidate] {
    var byKey: [String: LegCandidate] = [:]
    var order: [String] = []
    for e in events {
        guard let name = calendarNames[e.calendarId], let travel = travelOf(e, labels),
            let span = busySpan(e.event), span.end >= now - labelLookBackMs
        else { continue }
        if let known = byKey[travel.key], abs(span.start - now) >= abs(known.next - now) { continue }
        if byKey[travel.key] == nil { order.append(travel.key) }
        byKey[travel.key] = LegCandidate(
            key: travel.key,
            event: EventToRead(title: travel.title, location: travel.location, calendar: name, allDay: e.event.allDay),
            next: span.start)
    }
    func rank(_ c: LegCandidate) -> Double { c.next >= now - 86_400_000 ? Double(c.next) : .infinity }
    return order.map { byKey[$0]! }.enumerated().sorted { a, b in
        let ra = rank(a.element), rb = rank(b.element)
        if ra != rb { return ra < rb }
        if a.element.next != b.element.next { return a.element.next > b.element.next }
        return a.offset < b.offset
    }.map(\.element)
}

/// Candidates not read yet and not asked about this launch, in batches.
public func legBatches(_ candidates: [LegCandidate], _ book: LegBook, asked: Set<String>) -> [[LegCandidate]] {
    let wanted = Array(candidates.filter { book[$0.key] == nil && !asked.contains($0.key) }.prefix(legMaxPerRun))
    return stride(from: 0, to: wanted.count, by: legBatchSize).map {
        Array(wanted[$0..<min($0 + legBatchSize, wanted.count)])
    }
}

/// Every leg key among the phone's travel events, whatever calendar: what may be kept (#132).
public func presentLegKeys(_ events: [PhoneEventWithDetails], _ labels: LabelBook) -> Set<String> {
    Set(events.compactMap { travelOf($0, labels)?.key })
}

/// The book with legs whose event is gone dropped; nil when nothing is.
public func tidyLegBook(_ book: LegBook, present: Set<String>) -> LegBook? {
    let kept = book.filter { present.contains($0.key) }
    return kept.count == book.count ? nil : kept
}
