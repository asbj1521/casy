// Planlæg's shortcuts (Genveje, #175) and the steps through its answers,
// translated from src/lib/shortcuts.ts and answerSteps.ts (#282): a saved
// plan's settings and times, read leniently from what the server stores so
// an old or damaged one still opens, and the back and forth between the
// dates Planlæg shows. Kept equal to the TypeScript by the parity fixtures
// (shortcuts.cases.ts).

import Foundation

public let maxShortcuts = 6
public let maxShortcutName = 40
public let maxShortcutTimes = 3

/// What a plan holds beside its settings.
public struct EventExtras: Codable, Sendable, Equatable {
    public var place: String
    public var note: String
    public var answerDays: Int?
    public var dateCount: Int
    /// "hassle" or "soon" (#234).
    public var priority: String

    public init(place: String = "", note: String = "", answerDays: Int? = nil, dateCount: Int = 5, priority: String = "hassle") {
        self.place = place
        self.note = note
        self.answerDays = answerDays
        self.dateCount = dateCount
        self.priority = priority
    }

    public static let defaults = EventExtras()
}

/// One time a shortcut looks at.
public struct ShortcutTime: Codable, Sendable, Equatable {
    public var startHour: Double
    public var startWindow: StartWindow?
    public var anyTime: Bool
    public var durationMinutes: Int

    public init(startHour: Double, startWindow: StartWindow?, anyTime: Bool, durationMinutes: Int) {
        self.startHour = startHour
        self.startWindow = startWindow
        self.anyTime = anyTime
        self.durationMinutes = durationMinutes
    }
}

/// The plan's settings less the months, its first time in them.
public struct ShortcutSettings: Codable, Sendable, Equatable {
    public var multiDay: Bool
    public var startHour: Double
    public var startWindow: StartWindow?
    public var anyTime: Bool
    public var durationMinutes: Int
    public var dows: [Int]
    public var days: Int
    public var startDow: Int?
}

public struct ShortcutPlan: Codable, Sendable, Equatable {
    public var v: Int
    public var settings: ShortcutSettings
    public var times: [ShortcutTime]
    public var extras: EventExtras
}

/// "18:00-21:00", or the words for all day.
public func shortcutTimeLabel(_ time: ShortcutTime, allDay: String) -> String {
    if time.anyTime { return allDay }
    let start = Int((time.startHour * 60).rounded(.towardZero))
    func clock(_ minutes: Int) -> String { formatClockMinutes(minutes % (24 * 60)) }
    return "\(clock(start))-\(clock(start + time.durationMinutes))"
}

public func timeOf(_ s: SchedulerSettings) -> ShortcutTime {
    ShortcutTime(startHour: s.startHour, startWindow: s.startWindow, anyTime: s.anyTime, durationMinutes: s.durationMinutes)
}

public func shortcutPlan(_ settings: SchedulerSettings, _ extras: EventExtras, times: [ShortcutTime]? = nil) -> ShortcutPlan {
    let times = times ?? [timeOf(settings)]
    let first = times[0]
    return ShortcutPlan(
        v: 1,
        settings: ShortcutSettings(
            multiDay: settings.multiDay, startHour: first.startHour, startWindow: first.startWindow,
            anyTime: first.anyTime, durationMinutes: first.durationMinutes, dows: settings.dows, days: settings.days,
            startDow: settings.startDow),
        times: Array(times.prefix(maxShortcutTimes)), extras: extras)
}

// MARK: - Reading what the server stores

/// A JSON number that is a real number (not a boolean, as JSONSerialization can't tell).
private func number(_ v: Any?) -> Double? {
    guard let n = v as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID() else { return nil }
    let d = n.doubleValue
    return d.isFinite ? d : nil
}

private func bool(_ v: Any?) -> Bool? {
    guard let n = v as? NSNumber, CFGetTypeID(n) == CFBooleanGetTypeID() else { return nil }
    return n.boolValue
}

private func num(_ v: Any?, _ min: Double, _ max: Double, _ fallback: Double) -> Double {
    guard let d = number(v), d >= min, d <= max else { return fallback }
    return d
}

/// A count (days, dates): a whole number in range, else the fallback.
private func whole(_ v: Any?, _ min: Double, _ max: Double, _ fallback: Int) -> Int {
    guard let d = number(v), d == d.rounded(), d >= min, d <= max else { return fallback }
    return Int(d)
}

private func readWindow(_ raw: Any?) -> StartWindow? {
    guard let o = raw as? [String: Any], let from = number(o["from"]), let to = number(o["to"]), from >= 0,
        to <= 24 * 60, from < to
    else { return nil }
    return StartWindow(from: from, to: to)
}

private func readTime(_ raw: Any?, _ base: ShortcutTime) -> ShortcutTime? {
    guard let o = raw as? [String: Any] else { return nil }
    return ShortcutTime(
        startHour: num(o["startHour"], 0, 23.75, base.startHour), startWindow: readWindow(o["startWindow"]),
        anyTime: bool(o["anyTime"]) ?? base.anyTime,
        durationMinutes: whole(o["durationMinutes"], 15, 24 * 60, base.durationMinutes))
}

/// A stored plan, every part checked, what is missing or wrong taken from `base`; nil if it isn't one.
public func readShortcutPlan(_ data: Data, base: SchedulerSettings) -> ShortcutPlan? {
    guard let raw = try? JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed]) else { return nil }
    return readShortcutPlan(raw, base: base)
}

public func readShortcutPlan(_ raw: Any, base: SchedulerSettings) -> ShortcutPlan? {
    guard let o = raw as? [String: Any], number(o["v"]) == 1, let s = o["settings"] as? [String: Any] else {
        return nil
    }
    let dows: [Int] = (s["dows"] as? [Any]).map { list in
        list.compactMap { number($0) }.filter { $0 == $0.rounded() && $0 >= 0 && $0 <= 6 }.map { Int($0) }
    } ?? base.dows
    let first = readTime(s, timeOf(base)) ?? timeOf(base)
    var seen = Set<Int>()
    let unique = dows.filter { seen.insert($0).inserted }
    let startDow: Int? =
        s["startDow"] is NSNull ? nil : whole(s["startDow"], 0, 6, base.startDow ?? 5)
    let settings = ShortcutSettings(
        multiDay: bool(s["multiDay"]) ?? base.multiDay, startHour: first.startHour, startWindow: first.startWindow,
        anyTime: first.anyTime, durationMinutes: first.durationMinutes, dows: unique.isEmpty ? base.dows : unique,
        days: whole(s["days"], 1, 30, base.days), startDow: startDow)
    let more: [ShortcutTime] = (o["times"] as? [Any]).map { list in
        list.dropFirst().prefix(maxShortcutTimes - 1).compactMap { readTime($0, first) }
    } ?? []
    let e = o["extras"] as? [String: Any] ?? [:]
    let answerDays = number(e["answerDays"]).flatMap { $0 == $0.rounded() && $0 >= 1 && $0 <= 7 ? Int($0) : nil }
    let extras = EventExtras(
        place: e["place"] as? String ?? "", note: e["note"] as? String ?? "", answerDays: answerDays,
        dateCount: whole(e["dateCount"], 2, 5, 5), priority: e["priority"] as? String == "soon" ? "soon" : "hassle")
    return ShortcutPlan(v: 1, settings: settings, times: [first] + more, extras: extras)
}

// MARK: - The steps through Planlæg's answers (answerSteps.ts)

public struct AnswerStep: Codable, Sendable, Equatable {
    /// Where the search starts (a local midnight), or nil for today.
    public var from: String?
    /// A day picked on purpose: shown if it works at all.
    public var day: Bool?

    public init(from: String?, day: Bool? = nil) {
        self.from = from
        self.day = day
    }
}

public struct AnswerSteps: Codable, Sendable, Equatable {
    public var steps: [AnswerStep]
    public var index: Int
    public var accepted: String?

    public static func restart(_ from: String? = nil) -> AnswerSteps {
        AnswerSteps(steps: [AnswerStep(from: from)], index: 0, accepted: nil)
    }

    public var current: AnswerStep { index < steps.count ? steps[index] : AnswerStep(from: nil) }

    public func jump(_ from: String, day: Bool = false) -> AnswerSteps {
        AnswerSteps(steps: Array(steps.prefix(index + 1)) + [AnswerStep(from: from, day: day)], index: index + 1, accepted: nil)
    }

    public func forward(_ from: String) -> AnswerSteps {
        index + 1 < steps.count ? AnswerSteps(steps: steps, index: index + 1, accepted: nil) : jump(from)
    }

    public func back() -> AnswerSteps {
        index > 0 ? AnswerSteps(steps: steps, index: index - 1, accepted: nil) : self
    }

    public func accept(_ slotStart: String) -> AnswerSteps {
        AnswerSteps(steps: steps, index: index, accepted: slotStart)
    }
}
