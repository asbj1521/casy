// Planlæg med AI (#126), the app's side, translated from src/lib/aiPlan.ts
// (#282): what the AI made of what was typed or said (plan-ai's answer),
// applied to Planlæg's settings, every value checked first, and back; the
// names it mentions matched to the group; which fields it guessed. Kept
// equal to the TypeScript by the parity fixtures (aiPlan.cases.ts).

import Foundation

/// The months the AI read: "any" clears them, else "YYYY-MM" first to last,
/// or with `days` exact days "YYYY-MM-DD", both included (#134).
public enum PlanMonths: Codable, Sendable, Equatable {
    case any
    case range(from: String, to: String, days: Bool)

    private struct Range: Codable {
        var from: String
        var to: String
        var days: Bool?
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let word = try? c.decode(String.self), word == "any" {
            self = .any
            return
        }
        let r = try c.decode(Range.self)
        self = .range(from: r.from, to: r.to, days: r.days == true)
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .any: try c.encode("any")
        case .range(let from, let to, let days): try c.encode(Range(from: from, to: to, days: days ? true : nil))
        }
    }
}

/// The settings the AI read; nil where it said nothing. Numbers as it sent
/// them, checked when applied (a 3.5 hour is no hour).
public struct PlanSettings: Codable, Sendable, Equatable {
    /// "meeting", "trip" or "holiday".
    public var kind: String?
    public var startHour: Double?
    public var anyTime: Bool?
    public var startWindow: StartWindow?
    public var durationMinutes: Double?
    /// 0 = Sunday ... 6 = Saturday.
    public var weekdays: [Double]?
    public var days: Double?
    public var startWeekday: Double?
    public var months: PlanMonths?

    public init(
        kind: String? = nil, startHour: Double? = nil, anyTime: Bool? = nil, startWindow: StartWindow? = nil,
        durationMinutes: Double? = nil, weekdays: [Double]? = nil, days: Double? = nil, startWeekday: Double? = nil,
        months: PlanMonths? = nil
    ) {
        self.kind = kind
        self.startHour = startHour
        self.anyTime = anyTime
        self.startWindow = startWindow
        self.durationMinutes = durationMinutes
        self.weekdays = weekdays
        self.days = days
        self.startWeekday = startWeekday
        self.months = months
    }
}

public struct PlanQuestion: Codable, Sendable, Equatable {
    public struct Option: Codable, Sendable, Equatable {
        public var label: String
        public var patch: PlanSettings
    }

    public var question: String
    public var options: [Option]
}

/// plan-ai's whole answer: the settings, and the rest it read.
public struct AiPlan: Codable, Sendable, Equatable {
    public struct People: Codable, Sendable, Equatable {
        public var without: [String]
        public var optional: [String]
        public var required: [String]
    }

    public var settings: PlanSettings
    public var title: String?
    public var place: String?
    public var note: String?
    public var people: People
    public var atLeast: Double?
    public var assumed: [String]
    public var questions: [PlanQuestion]

    private enum Keys: String, CodingKey { case title, place, note, people, atLeast, assumed, questions }

    public init(from decoder: Decoder) throws {
        settings = try PlanSettings(from: decoder)
        let c = try decoder.container(keyedBy: Keys.self)
        title = try c.decodeIfPresent(String.self, forKey: .title)
        place = try c.decodeIfPresent(String.self, forKey: .place)
        note = try c.decodeIfPresent(String.self, forKey: .note)
        people = try c.decode(People.self, forKey: .people)
        atLeast = try c.decodeIfPresent(Double.self, forKey: .atLeast)
        assumed = try c.decode([String].self, forKey: .assumed)
        questions = try c.decode([PlanQuestion].self, forKey: .questions)
    }

    public func encode(to encoder: Encoder) throws {
        try settings.encode(to: encoder)
        var c = encoder.container(keyedBy: Keys.self)
        try c.encodeIfPresent(title, forKey: .title)
        try c.encodeIfPresent(place, forKey: .place)
        try c.encodeIfPresent(note, forKey: .note)
        try c.encode(people, forKey: .people)
        try c.encodeIfPresent(atLeast, forKey: .atLeast)
        try c.encode(assumed, forKey: .assumed)
        try c.encode(questions, forKey: .questions)
    }
}

/// What a first description starts from.
public let aiBaseSettings = SchedulerSettings(
    multiDay: false, startHour: 18, durationMinutes: 120, dows: allDows, anyTime: false, startWindow: nil, days: 3,
    startDow: 5, period: nil)

private func isInt(_ v: Double?, _ min: Int, _ max: Int) -> Int? {
    guard let v, v == v.rounded(), v >= Double(min), v <= Double(max) else { return nil }
    return Int(v)
}

/// A start window the engine can search: whole half hours, from before to.
public func isStartWindow(_ w: StartWindow?) -> Bool {
    guard let w else { return false }
    func step(_ v: Double) -> Bool {
        isInt(v, 0, 24 * 60 - startStepMinutes) != nil && Int(v) % startStepMinutes == 0
    }
    return step(w.from) && step(w.to) && w.from < w.to
}

private func pad(_ n: Int) -> String { n < 10 ? "0\(n)" : "\(n)" }

/// "2026-11" as its first local midnight, or nil.
public func monthToIso(_ month: String, _ timeZone: String) -> String? {
    guard let m = month.wholeMatch(of: /(\d{4})-(0[1-9]|1[0-2])/), let year = Int(m.1), let mon = Int(m.2) else {
        return nil
    }
    return isoString(wallTime(year, mon - 1, 1, 0, timeZone))
}

private func dayToIso(_ day: String, _ timeZone: String) -> String? {
    guard let m = day.wholeMatch(of: /(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])/), let year = Int(m.1),
        let mon = Int(m.2), let d = Int(m.3)
    else { return nil }
    let ms = wallTime(year, mon - 1, d, 0, timeZone)
    return localDate(ms, timeZone).day == d ? isoString(ms) : nil
}

public func isoToMonth(_ iso: String, _ timeZone: String) -> String {
    let d = localDate(parseInstant(iso) ?? 0, timeZone)
    return "\(d.year)-\(pad(d.month + 1))"
}

private func isoToDay(_ iso: String, _ timeZone: String) -> String {
    "\(isoToMonth(iso, timeZone))-\(pad(localDate(parseInstant(iso) ?? 0, timeZone).day))"
}

/// The settings with what the AI read applied, each value checked first.
public func applyPlan(_ settings: SchedulerSettings, _ plan: PlanSettings, _ timeZone: String) -> SchedulerSettings {
    var next = settings
    if plan.kind == "meeting" { next.multiDay = false }
    if plan.kind == "trip" {
        next.multiDay = true
        next.startDow = next.startDow ?? 5
    }
    if plan.kind == "holiday" {
        next.multiDay = true
        next.startDow = nil
    }
    if let dow = isInt(plan.startWeekday, 0, 6), plan.kind == "trip" || next.multiDay {
        next.multiDay = true
        next.startDow = dow
    }
    if let hour = isInt(plan.startHour, 0, 23) {
        next.startHour = Double(hour)
        next.anyTime = false
        next.startWindow = nil
    }
    if plan.anyTime == true {
        next.anyTime = true
        next.startWindow = nil
    }
    if plan.anyTime == false { next.anyTime = false }
    if let w = plan.startWindow, isStartWindow(w) {
        next.startWindow = w
        next.startHour = (w.from / 60).rounded(.down)
        next.anyTime = false
    }
    if let minutes = isInt(plan.durationMinutes, 30, 720), minutes % 30 == 0 { next.durationMinutes = minutes }
    if let weekdays = plan.weekdays {
        let picked = Set(weekdays.compactMap { isInt($0, 0, 6) })
        if !picked.isEmpty { next.dows = allDows.filter(picked.contains) }
    }
    if let days = isInt(plan.days, 1, maxSpanDays) { next.days = days }
    if next.multiDay && next.startDow != nil { next.days = min(next.days, maxWeeklyTripDays) }

    switch plan.months {
    case .any:
        next.period = nil
    case .range(let from, let to, true):
        if let f = dayToIso(from, timeZone), let t = dayToIso(to, timeZone), f <= t {
            next.period = Period(from: f, to: t, days: true)
        }
    case .range(let from, let to, false):
        if let f = monthToIso(from, timeZone), let t = monthToIso(to, timeZone) {
            next.period = f <= t ? Period(from: f, to: t) : Period(from: t, to: f)
        }
    case nil:
        break
    }
    return next
}

/// The settings as the AI reads them, for a follow-up ("make it Saturday").
public func toPlanSettings(_ s: SchedulerSettings, _ timeZone: String) -> PlanSettings {
    let meeting = !s.multiDay
    var months: PlanMonths?
    if let p = s.period {
        months =
            p.days == true
            ? .range(from: isoToDay(p.from, timeZone), to: isoToDay(p.to, timeZone), days: true)
            : .range(from: isoToMonth(p.from, timeZone), to: isoToMonth(p.to, timeZone), days: false)
    }
    return PlanSettings(
        kind: meeting ? "meeting" : s.startDow == nil ? "holiday" : "trip",
        startHour: meeting && !s.anyTime ? s.startHour : nil, anyTime: meeting ? s.anyTime : nil,
        startWindow: meeting && !s.anyTime ? s.startWindow : nil,
        durationMinutes: meeting ? Double(s.durationMinutes) : nil,
        weekdays: meeting && s.dows.count < 7 ? s.dows.map(Double.init) : nil, days: meeting ? nil : Double(s.days),
        startWeekday: meeting ? nil : s.startDow.map(Double.init), months: months)
}

/// The fields the AI guessed: what it said it assumed, and on a first
/// description what an event of its kind needs and it left out.
public func guessedFields(_ plan: AiPlan, first: Bool) -> [String] {
    var guessed = plan.assumed
    func add(_ field: String) { if !guessed.contains(field) { guessed.append(field) } }
    if first {
        let s = plan.settings
        let kind = s.kind ?? "meeting"
        let needs =
            kind == "meeting"
            ? (s.anyTime == true ? ["durationMinutes"] : ["startHour", "durationMinutes"])
            : kind == "trip" ? ["days", "startWeekday"] : ["days"]
        for field in needs where value(of: field, in: s) == nil { add(field) }
    }
    var seen = Set<String>()
    return guessed.filter { seen.insert($0).inserted }
}

private func value(of field: String, in s: PlanSettings) -> Any? {
    switch field {
    case "kind": s.kind
    case "startHour": s.startHour
    case "anyTime": s.anyTime
    case "startWindow": s.startWindow
    case "durationMinutes": s.durationMinutes
    case "weekdays": s.weekdays
    case "days": s.days
    case "startWeekday": s.startWeekday
    case "months": s.months
    default: nil
    }
}

private let planFields = [
    "kind", "startHour", "anyTime", "startWindow", "durationMinutes", "weekdays", "days", "startWeekday", "months",
]

/// The fields the AI said outright: set, not assumed, and "any time" only when no hour was given.
public func statedFields(_ plan: PlanSettings, assumed: [String] = []) -> [String] {
    planFields.filter { field in
        value(of: field, in: plan) != nil && !assumed.contains(field) && !(field == "anyTime" && plan.startHour != nil)
    }
}

/// A name as compared: lower case, ø as o and æ as ae, accents and extra spaces gone.
func normalName(_ name: String) -> String {
    let folded = name.lowercased().replacingOccurrences(of: "ø", with: "o").replacingOccurrences(of: "æ", with: "ae")
        .decomposedStringWithCanonicalMapping
    let bare = String(
        String.UnicodeScalarView(
            folded.unicodeScalars.filter {
                ![.nonspacingMark, .spacingMark, .enclosingMark].contains($0.properties.generalCategory)
            }))
    return bare.replacing(/\s+/, with: " ").trimmingCharacters(in: .whitespacesAndNewlines)
}

public struct NameMatch: Codable, Sendable, Equatable {
    /// The name as the person wrote it.
    public var written: String
    /// The members it could be: one is a match, none or several need asking.
    public var candidates: [String]
}

public struct PlanMember: Codable, Sendable, Equatable {
    public var profileId: String
    public var name: String
    public var isYou: Bool

    public init(profileId: String, name: String, isYou: Bool) {
        self.profileId = profileId
        self.name = name
        self.isYou = isYou
    }
}

/// Each written name against the others in the group: the whole name, else the first name.
public func matchNames(_ written: [String], _ members: [PlanMember]) -> [NameMatch] {
    let others = members.filter { !$0.isYou }
    return written.map { name in
        let wanted = normalName(name)
        let whole = others.filter { normalName($0.name) == wanted }
        let first = others.filter { normalName($0.name).split(separator: " ", omittingEmptySubsequences: false).first.map(String.init) == wanted }
        return NameMatch(written: name, candidates: (whole.isEmpty ? first : whole).map(\.profileId))
    }
}

/// The names the plan mentions, each once.
public func mentionedNames(_ plan: AiPlan) -> [String] {
    var seen = Set<String>()
    return (plan.people.without + plan.people.optional + plan.people.required).filter { seen.insert($0).inserted }
}

/// Who it is for, with the names the plan mentions (resolved to members) set.
public func applyPeople(_ choice: PeopleChoice, _ plan: AiPlan, resolved: [String: String]) -> PeopleChoice {
    var states = choice.states
    func set(_ names: [String], _ state: MemberState) {
        for name in names { if let id = resolved[name] { states[id] = state } }
    }
    set(plan.people.required, .required)
    set(plan.people.optional, .optional)
    set(plan.people.without, .out)
    return PeopleChoice(states: states, atLeast: isInt(plan.atLeast, 1, 20) ?? choice.atLeast)
}
