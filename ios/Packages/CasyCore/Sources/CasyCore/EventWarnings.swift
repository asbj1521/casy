// What a date gets in the way of among your important events (#114),
// translated from src/lib/eventWarnings.ts (#282): the night before an
// exam, the day before something you prepare for, the days you recover
// after. Which events are important is the AI's labels (eventLabels.ts),
// still the page's until the background work is native. Kept equal to the
// TypeScript by the parity fixtures (earlyMorning.cases.ts).

import Foundation

private let hourMs: Int64 = 3_600_000
private let nightBeforeMs: Int64 = 36 * hourMs
private let nightEndsHour: Int64 = 6
private let smallMs: Int64 = 2 * hourMs
private let bigMs: Int64 = 4 * hourMs

/// The AI's label for one of your events (#112).
public struct EventLabel: Codable, Sendable, Equatable {
    public var kind: String
    /// "low", "normal", "high" or "critical".
    public var importance: String
    public var prepDays: Int
    /// What shouldn't happen the evening or day before it.
    public var avoidBefore: [String]
    public var recoveryDays: Int
    public var strain: String
    public var confidence: String
    public var reason: String
}

/// One of your events with its label.
public struct LabelledEvent: Codable, Sendable, Equatable {
    public var title: String
    public var start: Int64
    public var end: Int64
    public var allDay: Bool
    public var label: EventLabel
}

public struct ImportantClash: Codable, Sendable, Equatable {
    /// "nightBefore", "prepDayBefore", "prep" or "recovery".
    public var kind: String
    /// "critical": asked before a yes; "warning": said, not asked.
    public var severity: String
    public var event: LabelledEvent
    /// Calendar days from the planned event's last day to yours; a night
    /// ending before 06:00 counts as the day it began.
    public var daysAfter: Int
    /// For the night before: what to keep clear of.
    public var avoid: [String]

    public var key: String { "\(event.start)-\(event.title)" }
}

private func daysBetween(_ a: Int64, _ b: Int64, _ timeZone: String) -> Int {
    Int((Double(startOfDay(b, timeZone) - startOfDay(a, timeZone)) / Double(24 * hourMs) + 0.5).rounded(.down))
}

private func isBig(_ impact: DateImpact) -> Bool {
    if !impact.effects.isEmpty || impact.end - impact.start >= bigMs { return true }
    return impact.strain == "moderate" || impact.strain == "heavy"
}

private func isSmall(_ impact: DateImpact) -> Bool {
    let light = impact.strain == nil || impact.strain == "none" || impact.strain == "light"
    return light && impact.effects.isEmpty && impact.end - impact.start <= smallMs
}

private let clashRank = ["nightBefore": 0, "prepDayBefore": 1, "prep": 2, "recovery": 3]

/// The strongest clash with each of your important events after the date, critical first, then soonest.
public func importantClashes(_ impact: DateImpact, _ mine: [LabelledEvent], _ timeZone: String) -> [ImportantClash] {
    let lastDay = impact.end - 1 - nightEndsHour * hourMs
    var clashes: [ImportantClash] = []
    for event in mine {
        let label = event.label
        guard label.importance == "high" || label.importance == "critical", event.start >= impact.end else { continue }
        let critical = label.importance == "critical"
        let daysAfter = daysBetween(lastDay, event.start, timeZone)
        var found: [ImportantClash] = []
        let avoid = label.avoidBefore.filter(impact.effects.contains)
        if !avoid.isEmpty && event.start - impact.end <= nightBeforeMs {
            found.append(
                ImportantClash(
                    kind: "nightBefore", severity: critical ? "critical" : "warning", event: event, daysAfter: daysAfter,
                    avoid: avoid))
        }
        if label.prepDays >= 1 && daysAfter >= 1 && daysAfter <= label.prepDays {
            if daysAfter == 1 && critical && !isSmall(impact) {
                found.append(ImportantClash(kind: "prepDayBefore", severity: "critical", event: event, daysAfter: daysAfter, avoid: []))
            } else if isBig(impact) {
                found.append(ImportantClash(kind: "prep", severity: "warning", event: event, daysAfter: daysAfter, avoid: []))
            }
        }
        if impact.recoveryDays >= 1 && daysAfter >= 1 && daysAfter <= impact.recoveryDays {
            found.append(ImportantClash(kind: "recovery", severity: "warning", event: event, daysAfter: daysAfter, avoid: []))
        }
        let strongest = found.enumerated().min { a, b in
            let sa = a.element.severity == "critical" ? 0 : 1
            let sb = b.element.severity == "critical" ? 0 : 1
            if sa != sb { return sa < sb }
            let ra = clashRank[a.element.kind] ?? 9
            let rb = clashRank[b.element.kind] ?? 9
            return ra != rb ? ra < rb : a.offset < b.offset
        }?.element
        if let strongest { clashes.append(strongest) }
    }
    return clashes.enumerated().sorted { a, b in
        let sa = a.element.severity == "critical" ? 0 : 1
        let sb = b.element.severity == "critical" ? 0 : 1
        if sa != sb { return sa < sb }
        return a.element.event.start != b.element.event.start
            ? a.element.event.start < b.element.event.start : a.offset < b.offset
    }.map(\.element)
}

/// The words a clash is said in, from the String Catalog.
public struct ClashWords: Sendable {
    public var and: String
    public var when: @Sendable (Int) -> String
    public var nightBefore: @Sendable (String, String, String) -> String
    public var prepDayBefore: @Sendable (String, String) -> String
    public var prep: @Sendable (String, String) -> String
    public var recovery: @Sendable (String, String) -> String
    /// What kind of event it is, said vaguely ("en eksamen").
    public var kinds: [String: String]
    public var avoid: [String: String]

    public init(
        and: String, when: @escaping @Sendable (Int) -> String,
        nightBefore: @escaping @Sendable (String, String, String) -> String,
        prepDayBefore: @escaping @Sendable (String, String) -> String, prep: @escaping @Sendable (String, String) -> String,
        recovery: @escaping @Sendable (String, String) -> String, kinds: [String: String], avoid: [String: String]
    ) {
        self.and = and
        self.when = when
        self.nightBefore = nightBefore
        self.prepDayBefore = prepDayBefore
        self.prep = prep
        self.recovery = recovery
        self.kinds = kinds
        self.avoid = avoid
    }
}

public func clashSentence(_ c: ImportantClash, _ words: ClashWords) -> String {
    func list(_ items: [String]) -> String {
        items.count <= 1 ? (items.first ?? "") : "\(items.dropLast().joined(separator: ", ")) \(words.and) \(items.last!)"
    }
    let what = words.kinds[c.event.label.kind] ?? ""
    let when = words.when(c.daysAfter)
    switch c.kind {
    case "nightBefore": return words.nightBefore(what, when, list(c.avoid.map { words.avoid[$0] ?? "" }))
    case "prepDayBefore": return words.prepDayBefore(what, when)
    case "prep": return words.prep(what, when)
    default: return words.recovery(what, when)
    }
}
