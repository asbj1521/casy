// What to loosen when the plan finds no date, or a late one, translated
// from src/lib/widen.ts (#282): another time of day, any weekday, a shorter
// meeting, fewer people, any start day or fewer days for a trip, more
// months, each offered with the first date it finds, soonest first. And
// the "how many must come" choices with their first dates. Kept equal to
// the TypeScript by the parity fixtures (widen.cases.ts).

import Foundation

/// The parts of a day a meeting may move to, as start windows.
private let dayParts: [(String, StartWindow)] = [
    ("morning", StartWindow(from: 9 * 60, to: 11 * 60)),
    ("lunch", StartWindow(from: 11 * 60 + 30, to: 13 * 60)),
    ("afternoon", StartWindow(from: 13 * 60, to: 16 * 60)),
    ("evening", StartWindow(from: 18 * 60, to: 21 * 60)),
]
private let maxWidenOptions = 4
/// Never fewer than two must come.
public let minCount = 2
private let groupShare = 0.65

/// One loosening: "time" (with its `part`, or "any"), "days", "startDay",
/// "shorter" (`minutes`), "fewerDays" (`days`), "months" (`period`) or
/// "people" (`atLeast` of `of`).
public struct Widening: Codable, Sendable, Equatable {
    public var kind: String
    public var part: String?
    public var minutes: Int?
    public var days: Int?
    public var period: Period?
    public var atLeast: Int?
    public var of: Int?

    public init(
        kind: String, part: String? = nil, minutes: Int? = nil, days: Int? = nil, period: Period? = nil,
        atLeast: Int? = nil, of: Int? = nil
    ) {
        self.kind = kind
        self.part = part
        self.minutes = minutes
        self.days = days
        self.period = period
        self.atLeast = atLeast
        self.of = of
    }
}

public struct WidenOption: Codable, Sendable, Equatable {
    public var widening: Widening
    /// The page's settings with this one change.
    public var settings: SchedulerSettings
    /// Who it is for, when that is what changes.
    public var people: PeopleChoice?
    public var first: FoundDate
}

public struct WidenInput: Sendable {
    public var participants: [Participant]
    public var settings: SchedulerSettings
    public var members: [String]
    public var choice: PeopleChoice
    /// Today's local midnight, and the end of the year searched.
    public var today: String
    public var limitEnd: String
    public var timeZone: String
    /// A meeting never starts before now.
    public var now: Int64

    public init(
        participants: [Participant], settings: SchedulerSettings, members: [String], choice: PeopleChoice,
        today: String, limitEnd: String, timeZone: String, now: Int64
    ) {
        self.participants = participants
        self.settings = settings
        self.members = members
        self.choice = choice
        self.today = today
        self.limitEnd = limitEnd
        self.timeZone = timeZone
        self.now = now
    }
}

private func firstDate(_ input: WidenInput, _ settings: SchedulerSettings, _ choice: PeopleChoice) -> FoundDate? {
    let search = settingsToSearch(
        settings, people: peopleFromChoice(input.members, choice, meeting: !settings.multiDay))
    let window = periodWindow(settings.period, today: input.today, limitEnd: input.limitEnd, input.timeZone)
    let start =
        search.kind == .single ? isoString(max(parseInstant(window.start) ?? 0, input.now)) : window.start
    let found = findEventSlot(input.participants, search, start, window.end, input.timeZone)
    guard let slot = found.slot else { return nil }
    return FoundDate(slot: slot, conflicts: found.conflicts, absent: found.absent)
}

private func startOf(_ date: FoundDate) -> Int64 { parseInstant(date.slot.start) ?? 0 }

/// A stable sort by when the first date is.
private func byDate(_ options: [WidenOption]) -> [WidenOption] {
    options.enumerated().sorted {
        let a = startOf($0.element.first)
        let b = startOf($1.element.first)
        return a != b ? a < b : $0.offset < $1.offset
    }.map(\.element)
}

public func widenOptions(_ input: WidenInput) -> [WidenOption] {
    let s = input.settings
    let choice = input.choice
    var options: [WidenOption] = []
    @discardableResult
    func offer(_ widening: Widening, _ settings: SchedulerSettings, _ people: PeopleChoice?) -> Bool {
        guard let first = firstDate(input, settings, people ?? choice) else { return false }
        options.append(WidenOption(widening: widening, settings: settings, people: people, first: first))
        return true
    }
    func firstThatWorks(_ tries: [(Widening, SchedulerSettings)]) {
        for (widening, settings) in tries where offer(widening, settings, nil) { return }
    }

    if !s.multiDay {
        var times: [(Widening, SchedulerSettings)] = dayParts.filter { _, w in
            s.startWindow?.from != w.from || s.startWindow?.to != w.to
        }.map { part, w in
            var t = s
            t.anyTime = false
            t.startWindow = w
            t.startHour = (w.from / 60).rounded(.down)
            return (Widening(kind: "time", part: part), t)
        }
        if !s.anyTime {
            var t = s
            t.anyTime = true
            t.startWindow = nil
            times.append((Widening(kind: "time", part: "any"), t))
        }
        let found = times.compactMap { widening, settings -> WidenOption? in
            firstDate(input, settings, choice).map { WidenOption(widening: widening, settings: settings, people: nil, first: $0) }
        }
        if let earliest = byDate(found).first { options.append(earliest) }

        if s.dows.count < 7 {
            var t = s
            t.dows = allDows
            offer(Widening(kind: "days"), t, nil)
        }

        var shorter: [(Widening, SchedulerSettings)] = []
        let floor = max(startStepMinutes, Int((Double(s.durationMinutes) / 2 / 30).rounded(.up)) * 30)
        var m = s.durationMinutes - 30
        while m >= floor {
            var t = s
            t.durationMinutes = m
            shorter.append((Widening(kind: "shorter", minutes: m), t))
            m -= 30
        }
        firstThatWorks(shorter)

        let required = requiredCount(input.members, choice)
        let atLeast = (choice.atLeast ?? required) - 1
        if atLeast >= minCount && input.participants.count >= 3 {
            var people = choice
            people.atLeast = atLeast
            offer(Widening(kind: "people", atLeast: atLeast, of: required), s, people)
        }
    } else if s.startDow != nil {
        var any = s
        any.startDow = nil
        offer(Widening(kind: "startDay"), any, nil)
        var fewer: [(Widening, SchedulerSettings)] = []
        var d = min(s.days, maxWeeklyTripDays) - 1
        while d >= max(1, Int((Double(s.days) / 2).rounded(.up))) {
            var t = s
            t.days = d
            fewer.append((Widening(kind: "fewerDays", days: d), t))
            d -= 1
        }
        firstThatWorks(fewer)
    }

    if let period = s.period, period.days != true {
        let last = startOfMonth((parseInstant(input.limitEnd) ?? 0) - 1, input.timeZone)
        var more: [(Widening, SchedulerSettings)] = []
        var n = 1
        while true {
            let to = startOfMonth(parseInstant(period.to) ?? 0, input.timeZone, n)
            if to > last { break }
            let wider = Period(from: period.from, to: isoString(to))
            var t = s
            t.period = wider
            more.append((Widening(kind: "months", period: wider), t))
            n += 1
        }
        firstThatWorks(more)
    }
    return Array(byDate(options).prefix(maxWidenOptions))
}

/// How many of the members are required.
public func requiredCount(_ members: [String], _ choice: PeopleChoice) -> Int {
    members.filter { (choice.states[$0] ?? .required) == .required }.count
}

/// The fewest "at least" offers: two thirds of the group, never below two.
public func lowestCount(_ of: Int, _ atLeast: Int? = nil) -> Int {
    let floor = max(minCount, Int((Double(of) * groupShare + 0.5).rounded(.down)))
    guard let atLeast else { return floor }
    return max(minCount, min(floor, atLeast))
}

public struct CountOption: Codable, Sendable, Equatable {
    public var count: Int
    public var of: Int
    public var first: FoundDate?
}

/// For each "at least N" from everyone down: its first date, among the
/// settings and a shortcut's other times (#175).
public func firstDateByCount(_ input: WidenInput, others: [SchedulerSettings] = []) -> [CountOption] {
    if input.settings.multiDay { return [] }
    let of = requiredCount(input.members, input.choice)
    if of <= minCount { return [] }
    var options: [CountOption] = []
    var count = of
    while count >= lowestCount(of, input.choice.atLeast) {
        var choice = input.choice
        choice.atLeast = count == of ? nil : count
        let found = ([input.settings] + others).compactMap { firstDate(input, $0, choice) }
        let first = found.enumerated().min {
            let a = startOf($0.element)
            let b = startOf($1.element)
            return a != b ? a < b : $0.offset < $1.offset
        }?.element
        options.append(CountOption(count: count, of: of, first: first))
        count -= 1
    }
    return options
}

/// Whole days between two dates' days.
public func daysSooner(_ first: String, than: String, _ timeZone: String) -> Int {
    let a = startOfDay(parseInstant(first) ?? 0, timeZone)
    let b = startOfDay(parseInstant(than) ?? 0, timeZone)
    return Int((Double(b - a) / 86_400_000 + 0.5).rounded(.down))
}
