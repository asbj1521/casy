// The warnings at a date's edges, translated from src/lib/earlyMorning.ts
// (#282): a meeting ending late before someone's early start the next
// morning, one starting straight after something else, one on New Year's
// Day. Kept equal to the TypeScript by the parity fixtures (earlyMorning.cases.ts).

import Foundation

private let earlyUntilHour: Double = 10
private let allDayMs: Int64 = 23 * 60 * 60 * 1000

public struct EarlyStart: Codable, Sendable, Equatable {
    public var profileId: String
    public var name: String
    /// Their first thing the next morning.
    public var start: String
}

public struct BackToBack: Codable, Sendable, Equatable {
    public var profileId: String
    public var name: String
}

private func isLateMeeting(_ start: Int64, _ end: Int64, _ timeZone: String) -> Bool {
    end >= atHour(start, 23, timeZone)
}

private func isAllDay(_ start: Int64, _ end: Int64, _ timeZone: String) -> Bool {
    start == startOfDay(start, timeZone) && end - start >= allDayMs
}

/// You first, the rest as they were.
private func youFirst<T>(_ people: [T], _ id: (T) -> String, _ you: String?) -> [T] {
    people.enumerated().sorted { a, b in
        let ya = id(a.element) == you ? 1 : 0
        let yb = id(b.element) == you ? 1 : 0
        return ya != yb ? ya > yb : a.offset < b.offset
    }.map(\.element)
}

/// Who starts something by 10:00 the morning after a meeting that ends late, earliest first.
public func earlyMorningStarts(_ participants: [Participant], start: String, end: String, _ timeZone: String)
    -> [EarlyStart]
{
    let s = parseInstant(start) ?? 0
    let e = parseInstant(end) ?? 0
    guard isLateMeeting(s, e, timeZone) else { return [] }
    let endDay = startOfDay(e, timeZone)
    let morning = endDay == startOfDay(s, timeZone) ? addDays(s, 1, timeZone) : endDay
    let until = atHour(morning, earlyUntilHour, timeZone)
    var found: [(profileId: String, name: String, first: Int64, n: Int)] = []
    for p in participants {
        var first = Int64.max
        for b in p.busy {
            guard let iv = blockRange(b), b.holiday != true, iv.start >= e, iv.start <= until else { continue }
            if !isAllDay(iv.start, iv.end, timeZone) { first = min(first, iv.start) }
        }
        if first < .max { found.append((p.profileId, p.name, first, found.count)) }
    }
    return found.sorted { $0.first != $1.first ? $0.first < $1.first : $0.n < $1.n }.map {
        EarlyStart(profileId: $0.profileId, name: $0.name, start: isoString($0.first))
    }
}

public struct EarlyMorningWords: Sendable {
    public var you: String
    public var oneYou: @Sendable (String) -> String
    public var one: @Sendable (String, String) -> String
    public var many: @Sendable (String) -> String

    public init(
        you: String, oneYou: @escaping @Sendable (String) -> String, one: @escaping @Sendable (String, String) -> String,
        many: @escaping @Sendable (String) -> String
    ) {
        self.you = you
        self.oneYou = oneYou
        self.one = one
        self.many = many
    }
}

public func earlyMorningNote(_ starts: [EarlyStart], you: String?, _ lang: Lang, _ words: EarlyMorningWords) -> String? {
    guard !starts.isEmpty else { return nil }
    let ordered = youFirst(starts, \.profileId, you)
    if ordered.count == 1 {
        let s = ordered[0]
        return s.profileId == you ? words.oneYou(formatTime(s.start)) : words.one(s.name, formatTime(s.start))
    }
    return words.many(
        nameList(ordered.map { "\($0.profileId == you ? words.you : $0.name) (\(formatTime($0.start)))" }, lang))
}

/// Who has something ending right as the date starts.
public func backToBackEnds(_ participants: [Participant], start: String, _ timeZone: String) -> [BackToBack] {
    let s = parseInstant(start) ?? 0
    return participants.filter { p in
        p.busy.contains { b in
            guard let iv = blockRange(b) else { return false }
            return iv.end == s && b.holiday != true && !isAllDay(iv.start, iv.end, timeZone)
        }
    }.map { BackToBack(profileId: $0.profileId, name: $0.name) }
}

public struct BackToBackWords: Sendable {
    public var you: String
    public var oneYou: String
    public var one: @Sendable (String) -> String
    public var many: @Sendable (String) -> String

    public init(
        you: String, oneYou: String, one: @escaping @Sendable (String) -> String,
        many: @escaping @Sendable (String) -> String
    ) {
        self.you = you
        self.oneYou = oneYou
        self.one = one
        self.many = many
    }
}

public func backToBackNote(_ people: [BackToBack], you: String?, _ lang: Lang, _ words: BackToBackWords) -> String? {
    guard !people.isEmpty else { return nil }
    let ordered = youFirst(people, \.profileId, you)
    if ordered.count == 1 { return ordered[0].profileId == you ? words.oneYou : words.one(ordered[0].name) }
    return words.many(nameList(ordered.map { $0.profileId == you ? words.you : $0.name }, lang))
}

public struct EdgeWarning: Codable, Sendable, Equatable {
    /// "newYearsDay", "backToBack" or "earlyMorning".
    public var kind: String
    public var text: String
}

public func edgeWarnings(
    _ participants: [Participant], start: String, end: String, _ timeZone: String, you: String?, _ lang: Lang,
    backToBack: BackToBackWords, earlyMorning: EarlyMorningWords, newYearsDay: String
) -> [EdgeWarning] {
    var warnings: [EdgeWarning] = []
    let d = localDate(parseInstant(start) ?? 0, timeZone)
    if d.month == 0 && d.day == 1 { warnings.append(EdgeWarning(kind: "newYearsDay", text: newYearsDay)) }
    if let note = backToBackNote(backToBackEnds(participants, start: start, timeZone), you: you, lang, backToBack) {
        warnings.append(EdgeWarning(kind: "backToBack", text: note))
    }
    if let note = earlyMorningNote(
        earlyMorningStarts(participants, start: start, end: end, timeZone), you: you, lang, earlyMorning)
    {
        warnings.append(EdgeWarning(kind: "earlyMorning", text: note))
    }
    return warnings
}
