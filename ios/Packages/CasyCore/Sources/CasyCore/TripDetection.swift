// Trip detection (#115) made natively (#202): trips.ts's pairing of legs into
// trips and questions, tripLegBook.ts's legs from the phone's events, and
// tripView.ts's marks and bars on the month. Kept equal to them by the parity
// fixtures (trips.json). Pure: legs and answers go in, trips and questions out.

import Foundation

/// An accepted trip, saved as itself (`KeptTrip`).
public struct KeptTrip: Codable, Sendable, Equatable {
    public var start: Int64
    public var end: Int64
    /// The city it is named by, as shown when it was accepted.
    public var city: String
    /// The event it was written as in the phone's calendar, once it was.
    public var eventId: String?

    public init(start: Int64, end: Int64, city: String, eventId: String?) {
        self.start = start
        self.end = end
        self.city = city
        self.eventId = eventId
    }
}

/// What the person has told Casy about their trips, kept on the phone (`TripAnswers`).
public struct TripAnswers: Codable, Sendable, Equatable {
    /// The home city (a city key), once known.
    public var home: String?
    /// Leg id of a way out with no way back, to the day the person is back.
    public var returns: [String: Int64] = [:]
    /// Leg id of a way back with no way out, to the day the person left.
    public var outbounds: [String: Int64] = [:]
    /// Ids of detected trips the person accepted: only these count.
    public var accepted: [String] = []
    /// Ids declined, or deleted after accepting: never suggested again.
    public var dismissed: [String] = []
    /// Each accepted trip as it was, by id.
    public var kept: [String: KeptTrip] = [:]

    public init() {}

    /// As readTripAnswers: whatever is missing or of the wrong kind is empty.
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        home = try? c.decodeIfPresent(String.self, forKey: .home)
        returns = (try? c.decodeIfPresent([String: Int64].self, forKey: .returns)) ?? [:]
        outbounds = (try? c.decodeIfPresent([String: Int64].self, forKey: .outbounds)) ?? [:]
        accepted = (try? c.decodeIfPresent([String].self, forKey: .accepted)) ?? []
        dismissed = (try? c.decodeIfPresent([String].self, forKey: .dismissed)) ?? []
        kept = (try? c.decodeIfPresent([String: KeptTrip].self, forKey: .kept)) ?? [:]
    }
}

/// Every trip found, and what Casy asks about the rest (`Detected`).
public struct DetectedTrips: Codable, Sendable, Equatable {
    public var trips: [Trip]
    public var questions: [TripQuestion]

    public init(trips: [Trip], questions: [TripQuestion]) {
        self.trips = trips
        self.questions = questions
    }
}

/// From this many occurrences a title is a routine (a weekly train), not a journey.
public let tripRoutineCount = 4
/// Legs this close, one arriving where the next leaves, are one journey.
private let connectionMs: Int64 = 12 * 3_600_000
/// A leg longer than this is no journey (#165).
private let maxLegMs: Int64 = 36 * 3_600_000
/// A way out with no way back is only asked about while it is recent or to come.
private let askAfterMs: Int64 = 3 * 86_400_000
private let tripDayMs: Int64 = 86_400_000

/// A city as compared: case, accents and surrounding spaces don't matter (`cityKey`).
public func cityKey(_ name: String) -> String {
    var scalars = String.UnicodeScalarView()
    for u in name.decomposedStringWithCanonicalMapping.unicodeScalars {
        switch u.properties.generalCategory {
        case .nonspacingMark, .spacingMark, .enclosingMark: continue
        default: scalars.append(u)
        }
    }
    var s = String(scalars)
    for (from, to) in [("ø", "o"), ("Ø", "o"), ("æ", "ae"), ("Æ", "ae"), ("å", "a"), ("Å", "a")] {
        s = s.replacingOccurrences(of: from, with: to)
    }
    let words = s.trimmingCharacters(in: jsWhitespace)
        .split(whereSeparator: { $0.unicodeScalars.allSatisfy { jsWhitespace.contains($0) } })
    return words.joined(separator: " ").lowercased()
}

/// One or more legs of a connection, travelled as one journey.
private struct Segment {
    var id: String
    var from: String
    var to: String
    var start: Int64
    var end: Int64
    var legs: [Leg]
}

private func segmentsOf(_ legs: [Leg]) -> [Segment] {
    var segments: [Segment] = []
    for leg in legs {
        // Never joined into a loop: a quick there-and-back is two segments.
        if var last = segments.last, last.to == leg.from, leg.to != last.from,
            leg.start - last.end >= 0, leg.start - last.end <= connectionMs
        {
            last.to = leg.to
            last.end = leg.end
            last.legs.append(leg)
            segments[segments.count - 1] = last
        } else {
            segments.append(Segment(id: leg.id, from: leg.from, to: leg.to, start: leg.start, end: leg.end, legs: [leg]))
        }
    }
    return segments
}

/// Each city with how many journeys start or end in it, most first (ties as first met).
private func cityScores(_ segments: [Segment]) -> [(city: String, n: Int)] {
    var order: [String] = []
    var score: [String: Int] = [:]
    for s in segments {
        for city in s.from == s.to ? [s.from] : [s.from, s.to] {
            if score[city] == nil { order.append(city) }
            score[city, default: 0] += 1
        }
    }
    return order.enumerated()
        .sorted { a, b in
            let na = score[a.element]!, nb = score[b.element]!
            return na != nb ? na > nb : a.offset < b.offset
        }
        .map { ($0.element, score[$0.element]!) }
}

/// Where the legs say home is; nil when no city leads.
private func inferHome(_ segments: [Segment]) -> String? {
    let ranked = cityScores(segments)
    guard let first = ranked.first else { return nil }
    return ranked.count == 1 || first.n > ranked[1].n ? first.city : nil
}

/// The cities worth offering as home: those that lead the count, at most three.
private func homeCandidates(_ segments: [Segment]) -> [String] {
    let ranked = cityScores(segments)
    let top = ranked.first?.n ?? 0
    return Array(ranked.filter { $0.n == top }.prefix(3).map(\.city))
}

/// The legs that can be part of a trip, in time order.
private func usable(_ legs: [Leg]) -> [Leg] {
    legs.filter { $0.count < tripRoutineCount && $0.end > $0.start && $0.end - $0.start <= maxLegMs && $0.from != $0.to }
        .enumerated()
        .sorted { a, b in
            if a.element.start != b.element.start { return a.element.start < b.element.start }
            if a.element.end != b.element.end { return a.element.end < b.element.end }
            return a.offset < b.offset
        }
        .map(\.element)
}

/// Home, as the person said or the legs say; nil while neither does.
public func homeOf(_ legs: [Leg], _ answers: TripAnswers) -> String? {
    answers.home ?? inferHome(segmentsOf(usable(legs)))
}

/// The trips found, plus every accepted trip kept that they no longer include.
private func withKept(_ trips: [Trip], _ answers: TripAnswers) -> [Trip] {
    let found = Set(trips.map(\.id))
    let skipped = Set(answers.dismissed)
    let kept = answers.kept
        .filter { !found.contains($0.key) && !skipped.contains($0.key) }
        .sorted { $0.key < $1.key }
        .map { id, k in
            Trip(id: id, start: k.start, end: k.end, legs: [], answered: true, accepted: true, city: k.city, inCalendar: nil)
        }
    let all =
        kept.isEmpty
        ? trips
        : (trips + kept).enumerated()
            .sorted { $0.element.start != $1.element.start ? $0.element.start < $1.element.start : $0.offset < $1.offset }
            .map(\.element)
    return all.map { t in
        var t = t
        if let id = answers.kept[t.id]?.eventId, !id.isEmpty { t.inCalendar = true }
        return t
    }
}

/// Whether a stretch crosses a local midnight: a day trip is not away.
private func staysOvernight(_ start: Int64, _ end: Int64) -> Bool {
    end > addDays(start, 1, appTimeZone)
}

/// The trips in a person's legs, and what to ask about the rest (`detectTrips`).
public func detectTrips(
    _ allLegs: [Leg], _ answers: TripAnswers, now: Int64, inCalendar: [InstantSpan] = []
) -> DetectedTrips {
    let segments = segmentsOf(usable(allLegs))
    if segments.isEmpty { return DetectedTrips(trips: withKept([], answers), questions: []) }

    let settled = inCalendar + answers.kept.values.map { InstantSpan(start: $0.start, end: $0.end) }
    func isSettled(_ start: Int64, _ end: Int64) -> Bool { settled.contains { start < $0.end && end > $0.start } }

    guard let home = answers.home ?? inferHome(segments) else {
        let next = segments.first { $0.end > now && !isSettled($0.start, $0.end) }
        return DetectedTrips(
            trips: withKept([], answers),
            questions: next.map {
                [TripQuestion(kind: "home", id: $0.id, legs: $0.legs, cities: homeCandidates(segments), earliest: nil, latest: nil)]
            } ?? [])
    }

    var trips: [Trip] = []
    var questions: [TripQuestion] = []
    let skipped = Set(answers.dismissed)
    var lastHome: Int64?

    func unpaired(_ open: [Segment], _ latest: Int64?) {
        let first = open[0]
        let last = open[open.count - 1]
        if skipped.contains(first.id) { return }
        let legs = open.flatMap(\.legs)
        if let day = answers.returns[first.id] {
            trips.append(
                Trip(
                    id: first.id, start: first.start, end: max(last.end, addDays(day, 1, appTimeZone)), legs: legs,
                    answered: true, accepted: true, city: nil, inCalendar: nil))
        } else if last.end > now - askAfterMs && !isSettled(first.start, last.end) {
            questions.append(
                TripQuestion(
                    kind: "return", id: first.id, legs: legs, cities: nil, earliest: addDays(last.end, 1, appTimeZone),
                    latest: latest))
        }
    }

    var open: [Segment]?
    for seg in segments {
        if var o = open {
            if seg.start - o[0].start > Int64(maxTripDays) * tripDayMs {
                unpaired(o, nil)
                open = nil
            } else if seg.from == home {
                // Home again without a leg to say so: the way back is missing.
                unpaired(o, seg.start)
                open = [seg]
                continue
            } else {
                o.append(seg)
                open = o
                if seg.to == home {
                    let first = o[0]
                    let accepted = answers.accepted.contains(first.id)
                    if !skipped.contains(first.id) && staysOvernight(first.start, seg.end)
                        && (accepted || !isSettled(first.start, seg.end))
                    {
                        trips.append(
                            Trip(
                                id: first.id, start: first.start, end: seg.end, legs: o.flatMap(\.legs), answered: false,
                                accepted: accepted, city: nil, inCalendar: nil))
                    }
                    lastHome = seg.end
                    open = nil
                }
                continue
            }
        }
        if seg.from == home {
            open = [seg]
        } else if seg.to == home {
            // A way back with no way out.
            if skipped.contains(seg.id) { continue }
            if let day = answers.outbounds[seg.id] {
                trips.append(
                    Trip(
                        id: seg.id, start: min(seg.start, startOfDay(day, appTimeZone)), end: seg.end, legs: seg.legs,
                        answered: true, accepted: true, city: nil, inCalendar: nil))
            } else if seg.end > now && !isSettled(seg.start, seg.end) {
                questions.append(
                    TripQuestion(
                        kind: "outbound", id: seg.id, legs: seg.legs, cities: nil,
                        earliest: lastHome.map { startOfDay($0, appTimeZone) }, latest: addDays(seg.start, -1, appTimeZone)))
            }
            lastHome = seg.end
        }
    }
    if let o = open { unpaired(o, nil) }
    return DetectedTrips(trips: withKept(trips, answers), questions: questions)
}

// MARK: The phone's events as legs (tripLegBook.ts)

/// What `trip-legs` writes for "the way home".
public let tripHome = "HOME"

/// This phone's travel events as legs for detectTrips (`phoneLegs`).
public func phoneLegs(
    _ events: [PhoneEventWithDetails], _ labels: LabelBook, _ book: LegBook, _ calendarNames: [String: String],
    _ answers: TripAnswers
) -> [Leg] {
    struct Occurrence {
        var key: String
        var start: Int64
        var end: Int64
        var leg: TripLeg
    }
    var occurrences: [Occurrence] = []
    var counts: [String: Int] = [:]
    let keptSpans = Set(answers.kept.values.map { "\($0.start)-\($0.end)" })
    for e in events {
        guard calendarNames[e.calendarId] != nil else { continue }
        let travel = travelOf(e, labels)?.key
        let span = busySpan(e.event)
        if let span, keptSpans.contains("\(span.start)-\(span.end)") { continue }
        guard let travel, let span, let leg = book[travel], leg.mode != "none", leg.confidence != "low" else { continue }
        counts[travel, default: 0] += 1
        occurrences.append(Occurrence(key: travel, start: span.start, end: span.end, leg: leg))
    }
    func named(_ city: String) -> Bool { city != "" && city != tripHome }
    func toLeg(_ o: Occurrence, _ from: String, _ to: String) -> Leg {
        Leg(
            id: "\(o.key)@\(o.start)", mode: o.leg.mode, from: cityKey(from), to: cityKey(to), start: o.start, end: o.end,
            count: counts[o.key] ?? 1, names: Leg.Names(from: from, to: to))
    }
    let complete = occurrences.filter { named($0.leg.from) && named($0.leg.to) }.map { toLeg($0, $0.leg.from, $0.leg.to) }
    guard let home = homeOf(complete, answers) else { return complete }
    var filled: [Leg] = []
    for o in occurrences {
        if named(o.leg.from) && named(o.leg.to) { continue }
        let from = o.leg.from == tripHome ? home : o.leg.from
        let to = o.leg.to == tripHome ? home : o.leg.to
        if from == "" && to == "" { continue }
        if from == "" {
            filled.append(toLeg(o, home, to))
        } else if to == "" {
            if cityKey(from) != home { filled.append(toLeg(o, from, home)) }
        } else {
            filled.append(toLeg(o, from, to))
        }
    }
    return complete + filled
}

/// The spans of the trips Casy wrote into this phone's calendars (#165).
public func casyTripSpans(_ events: [PhoneEventWithDetails]) -> [InstantSpan] {
    events.compactMap { isCasyTripEntry($0) ? busySpan($0.event) : nil }
}

// MARK: Marks and bars on the month (tripView.ts)

/// How many days a question's bar spans, pulse after pulse.
public let tripGuessDays = [3, 5, 4, 6, 2, 5]
private let maxGuessDays = tripGuessDays.max()!

/// Whether the person still has to answer it.
public func isPending(_ mark: TripMark) -> Bool {
    mark.kind == "question" || mark.trip?.accepted != true
}

/// Where a trip went: where the leg before the longest gap arrived.
private func destination(_ legs: [Leg]) -> String {
    guard var best = legs.first else { return "" }
    var gap: Int64 = -1
    for i in 0..<max(0, legs.count - 1) {
        let between = legs[i + 1].start - legs[i].end
        if between > gap {
            gap = between
            best = legs[i]
        }
    }
    return best.to
}

private func guessSpan(_ start: Int64, _ end: Int64, backwards: Bool, days: Int) -> InstantSpan {
    backwards
        ? InstantSpan(start: min(start, addDays(end, -(days - 1), appTimeZone)), end: end)
        : InstantSpan(start: start, end: max(end, addDays(start, days, appTimeZone)))
}

/// Every trip and question as a mark, soonest first (`tripMarks`).
public func tripMarks(_ detected: DetectedTrips, _ lang: Lang) -> [TripMark] {
    let all = detected.trips.flatMap(\.legs) + detected.questions.flatMap(\.legs)
    func name(_ key: String) -> String { cityName(key, legs: all, lang) }
    var marks = detected.trips.map { trip in
        TripMark(
            kind: "trip", id: trip.id, trip: trip, question: nil, start: trip.start, end: trip.end,
            city: trip.city ?? name(destination(trip.legs)))
    }
    for question in detected.questions {
        guard let first = question.legs.first, let last = question.legs.last else { continue }
        let back = question.kind == "outbound"
        let reach = guessSpan(first.start, last.end, backwards: back, days: maxGuessDays)
        var bounded = reach
        if question.kind == "return", let latest = question.latest {
            bounded = InstantSpan(start: reach.start, end: min(reach.end, max(last.end, latest)))
        } else if question.kind == "outbound", let earliest = question.earliest {
            bounded = InstantSpan(start: max(reach.start, min(first.start, earliest)), end: reach.end)
        }
        marks.append(
            TripMark(
                kind: "question", id: question.id, trip: nil, question: question, start: bounded.start, end: bounded.end,
                city: name(back ? first.from : last.to), legsStart: first.start, legsEnd: last.end))
    }
    return marks.enumerated()
        .sorted { $0.element.start != $1.element.start ? $0.element.start < $1.element.start : $0.offset < $1.offset }
        .map(\.element)
}

/// The first mark on a day (a local midnight), if any.
public func markOn(_ marks: [TripMark], day: Int64) -> TripMark? {
    let next = addDays(day, 1, appTimeZone)
    return marks.first { $0.start < next && $0.end > day }
}

/// The day to glide to: where the first mark still waiting for an answer starts.
public func revealDay(_ marks: [TripMark]) -> Int64? {
    marks.first(where: isPending).map { startOfDay($0.start, appTimeZone) }
}

/// What the bars say (`Messages["trips"]`'s bar words).
public struct TripBarWords: Sendable {
    public var pending: @Sendable (String) -> String
    public var accepted: @Sendable (String) -> String
    public var back: @Sendable (String) -> String
    public var outbound: @Sendable (String) -> String

    public init(
        pending: @escaping @Sendable (String) -> String, accepted: @escaping @Sendable (String) -> String,
        back: @escaping @Sendable (String) -> String, outbound: @escaping @Sendable (String) -> String
    ) {
        self.pending = pending
        self.accepted = accepted
        self.back = back
        self.outbound = outbound
    }
}

/// The marks as bars on the month, in Casy's own calendar (`tripBars`).
public func tripBars(_ marks: [TripMark], _ words: TripBarWords, step: Int = 0) -> [MonthItem] {
    marks.map { m in
        var start = m.start
        var end = m.end
        if m.kind == "question", let legsStart = m.legsStart, let legsEnd = m.legsEnd {
            let days = tripGuessDays[step % tripGuessDays.count]
            let guess = guessSpan(legsStart, legsEnd, backwards: m.question?.kind == "outbound", days: days)
            start = max(m.start, guess.start)
            end = min(m.end, guess.end)
        }
        if !isPending(m) { return MonthItem(calendarId: casyCalendarId, start: start, end: end, label: words.accepted(m.city)) }
        let kind = m.kind == "question" ? m.question?.kind ?? "trip" : "trip"
        let label =
            kind == "return" ? words.back(m.city) : kind == "outbound" ? words.outbound(m.city) : words.pending(m.city)
        return MonthItem(
            calendarId: casyCalendarId, start: start, end: end, label: label, pencil: true, pulse: true,
            grow: m.kind == "question")
    }
}

/// The marks less every accepted trip the calendar already has as an event of its own.
public func withoutTripsInCalendar(_ marks: [TripMark], items: [MonthItem]) -> [TripMark] {
    let spans = Set(items.filter { $0.calendarId != casyCalendarId }.map { "\($0.start)-\($0.end)" })
    return marks.filter { !($0.kind == "trip" && $0.trip?.accepted == true && spans.contains("\($0.start)-\($0.end)")) }
}
