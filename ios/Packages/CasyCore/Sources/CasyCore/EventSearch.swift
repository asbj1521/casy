// A plan's search, translated from src/lib/eventSearch.ts, startFlex.ts and
// the pure part of scheduler.ts (#282): what Planlæg's settings become, who
// is searched, the search itself, and the helpers around its answer. Kept
// equal to the TypeScript by the parity fixtures (eventSearch.cases.ts).

import Foundation

/// The window the whole app searches: this month and the eleven after it.
public let searchMonths = 12
// A meeting at "any time" is somewhere in 10:00-22:00 (anyTimeEarliestHour, in Prime.swift).
/// A start window's step: whole half hours.
public let startStepMinutes = 30
/// The most days a weekly trip touches, and the longest span searched.
public let maxWeeklyTripDays = 7
public let maxSpanDays = 30
/// Monday first, as the day pickers list them.
public let allDows = [1, 2, 3, 4, 5, 6, 0]
private let tripStartHour: Double = 17
private let tripEndHour: Double = 21

/// The searched window from `now`: from this month's first day, twelve months on.
public func searchWindow(now: Int64, _ timeZone: String = appTimeZone) -> (start: String, end: String) {
    let month = startOfMonth(now, timeZone)
    return (isoString(month), isoString(startOfMonth(month, timeZone, searchMonths)))
}

// MARK: - Who is searched

/// The required members are searched (optional ones are invited, not waited
/// for); "at least N" becomes a quorum among those with a calendar, nil when
/// it would have to be all of them anyway.
public func peopleForSearch(_ participants: [Participant], _ people: PeopleSettings?) -> (
    searched: [Participant], quorum: Int?
) {
    guard let people else { return (participants, nil) }
    let optional = Set(people.optional)
    let required = people.members.filter { !optional.contains($0) }
    let requiredSet = Set(required)
    let searched = participants.filter { requiredSet.contains($0.profileId) }
    guard let atLeast = people.atLeast else { return (searched, nil) }
    let withoutCalendar = required.filter { id in !searched.contains { $0.profileId == id } }.count
    let quorum = max(0, atLeast - withoutCalendar)
    return (searched, quorum >= searched.count ? nil : quorum)
}

/// The best date for an event's settings within [searchStart, searchEnd).
public func findEventSlot(
    _ allParticipants: [Participant], _ settings: EventSettings, _ searchStart: String, _ searchEnd: String,
    _ timeZone: String
) -> MultiDayResult {
    let (participants, quorum) = peopleForSearch(allParticipants, settings.people)
    switch settings.kind {
    case .single:
        let duration = settings.durationMinutes ?? 0
        let startHour = settings.startHour ?? 0
        let constraints: SchedulingConstraints
        if let window = settings.startWindow {
            // Any start within the window, running its full length past it.
            constraints = SchedulingConstraints(
                earliestHour: window.from / 60, latestHour: (window.to + Double(duration)) / 60,
                allowedDays: settings.allowedDays, startStepMinutes: startStepMinutes, preferredHour: startHour)
        } else if settings.anyTime == true {
            constraints = SchedulingConstraints(
                earliestHour: anyTimeEarliestHour, latestHour: anyTimeLatestHour, allowedDays: settings.allowedDays)
        } else {
            // A fixed time: the allowed window is exactly one meeting long.
            constraints = SchedulingConstraints(
                earliestHour: startHour, latestHour: startHour + Double(duration) / 60,
                allowedDays: settings.allowedDays)
        }
        return findMeetingSlot(
            MeetingSearch(
                participants: participants, quorum: quorum, durationMinutes: duration, searchStart: searchStart,
                searchEnd: searchEnd, timeZone: timeZone, constraints: constraints))
    case .trip:
        guard let shape = settings.shape else { return .none }
        return findWeeklySpan(participants, shape, searchStart, searchEnd, timeZone)
    case .vacation:
        return findBestDaySpan(participants, settings.days ?? 0, searchStart, searchEnd, timeZone)
    }
}

// MARK: - Planlæg's settings

/// What Planlæg's sheet holds (the web's SchedulerSettings).
public struct SchedulerSettings: Codable, Sendable, Equatable {
    /// False: one meeting on a day. True: Tur / ferie, whole days.
    public var multiDay: Bool
    public var startHour: Double
    public var durationMinutes: Int
    public var dows: [Int]
    public var anyTime: Bool
    public var startWindow: StartWindow?
    public var days: Int
    /// The weekday a trip starts on; nil is a holiday on any day.
    public var startDow: Int?
    public var period: Period?

    public init(
        multiDay: Bool, startHour: Double, durationMinutes: Int, dows: [Int], anyTime: Bool,
        startWindow: StartWindow?, days: Int, startDow: Int?, period: Period?
    ) {
        self.multiDay = multiDay
        self.startHour = startHour
        self.durationMinutes = durationMinutes
        self.dows = dows
        self.anyTime = anyTime
        self.startWindow = startWindow
        self.days = days
        self.startDow = startDow
        self.period = period
    }
}

/// A member's part in the plan.
public enum MemberState: String, Codable, Sendable {
    case required, optional, out
}

public struct PeopleChoice: Codable, Sendable, Equatable {
    public var states: [String: MemberState]
    public var atLeast: Int?

    public init(states: [String: MemberState] = [:], atLeast: Int? = nil) {
        self.states = states
        self.atLeast = atLeast
    }
}

/// Who the plan is for, or nil for everyone required (stored as before).
public func peopleFromChoice(_ members: [String], _ choice: PeopleChoice, meeting: Bool) -> PeopleSettings? {
    func state(_ id: String) -> MemberState { choice.states[id] ?? .required }
    let invited = members.filter { state($0) != .out }
    let optional = invited.filter { state($0) == .optional }
    let required = invited.count - optional.count
    var atLeast: Int?
    if meeting, let wanted = choice.atLeast, required > 0 { atLeast = min(max(wanted, 1), required) }
    let people = PeopleSettings(
        members: invited, optional: optional, atLeast: atLeast.flatMap { $0 < required ? $0 : nil })
    let isDefault = invited.count == members.count && optional.isEmpty && people.atLeast == nil
    return isDefault ? nil : people
}

/// A month tapped in the months row: added to, trimmed from or replacing the period.
public func pickPeriodMonth(_ period: Period?, _ month: String, _ timeZone: String) -> Period? {
    guard let period, period.days != true else { return Period(from: month, to: month) }
    let m = parseInstant(month) ?? 0
    let from = parseInstant(period.from) ?? 0
    let to = parseInstant(period.to) ?? 0
    func shift(_ iso: String, _ by: Int) -> String { isoString(startOfMonth(parseInstant(iso) ?? 0, timeZone, by)) }
    if m < from { return Period(from: month, to: period.to) }
    if m > to { return Period(from: period.from, to: month) }
    if m == from && m == to { return nil }
    if m == from { return Period(from: shift(period.from, 1), to: period.to) }
    if m == to { return Period(from: period.from, to: shift(period.to, -1)) }
    return Period(from: month, to: month)
}

/// The period as instants: its first day to the day (or month) after its last.
public func periodBounds(_ period: Period, _ timeZone: String) -> (from: Int64, to: Int64) {
    let to = parseInstant(period.to) ?? 0
    return (parseInstant(period.from) ?? 0, period.days == true ? addDays(to, 1, timeZone) : startOfMonth(to, timeZone, 1))
}

/// Where to search: from today (or the period's start) to the period's end or the window's.
public func periodWindow(_ period: Period?, today: String, limitEnd: String, _ timeZone: String) -> (
    start: String, end: String
) {
    guard let period else { return (today, limitEnd) }
    let bounds = periodBounds(period, timeZone)
    let start = max(parseInstant(today) ?? 0, bounds.from)
    let end = min(parseInstant(limitEnd) ?? 0, bounds.to)
    return (isoString(start), isoString(end))
}

/// The sheet's settings as an event's search settings.
public func settingsToSearch(_ s: SchedulerSettings, people: PeopleSettings? = nil) -> EventSettings {
    if s.multiDay {
        guard let startDow = s.startDow else { return EventSettings(kind: .vacation, days: s.days, people: people) }
        var e = EventSettings(kind: .trip, people: people)
        e.shape = WeeklySpanShape(
            anchorDow: startDow, spanDays: min(s.days, maxWeeklyTripDays), startHour: tripStartHour, endHour: tripEndHour)
        return e
    }
    var e = EventSettings(kind: .single, durationMinutes: s.durationMinutes, startHour: s.startHour, people: people)
    e.anyTime = s.anyTime
    e.startWindow = s.startWindow
    e.allowedDays = s.dows.count < 7 ? s.dows : nil
    return e
}

/// The event type's name an untitled event is stored under.
public func fallbackTitleId(_ search: EventSettings) -> String {
    switch search.kind {
    case .vacation: return "vacation"
    case .trip: return "weekend"
    case .single:
        if search.anyTime == true && search.startWindow == nil { return "meeting" }
        return (search.startHour ?? 0) < 16 ? "lunch" : "evening"
    }
}

/// How the chosen weekdays read: every day, weekdays, weekends, or a list (Monday first).
public enum DayListLabel: Equatable, Sendable {
    case all, weekdays, weekends
    case list([Int])
}

public func describeDays(_ dows: [Int]) -> DayListLabel {
    let set = Set(dows)
    if set.count == 7 { return .all }
    func same(_ want: [Int]) -> Bool { set.count == want.count && want.allSatisfy(set.contains) }
    if same([1, 2, 3, 4, 5]) { return .weekdays }
    if same([6, 0]) { return .weekends }
    return .list(allDows.filter(set.contains))
}

/// Whole days from today to a day, both local midnights as ISO strings.
public func daysUntil(_ dayIso: String, _ todayIso: String) -> Int {
    let days = Double((parseInstant(dayIso) ?? 0) - (parseInstant(todayIso) ?? 0)) / 86_400_000
    return Int((days + 0.5).rounded(.down))
}

/// A date found: always with a slot.
public struct FoundDate: Codable, Sendable, Equatable {
    public var slot: TimeSlot
    public var conflicts: [SpanConflict]
    public var absent: [AbsentPerson]?
}

/// Up to `count` dates after `afterStart`, each the next one found a day after the last.
public func laterSlots(
    _ participants: [Participant], _ search: EventSettings, afterStart: String, count: Int, searchEnd: String,
    _ timeZone: String
) -> [FoundDate] {
    var out: [FoundDate] = []
    var from = afterStart
    for _ in 0..<max(0, count) {
        let next = isoString(addDays(parseInstant(from) ?? 0, 1, timeZone))
        let found = findEventSlot(participants, search, next, searchEnd, timeZone)
        guard let slot = found.slot else { break }
        out.append(FoundDate(slot: slot, conflicts: found.conflicts, absent: found.absent))
        from = slot.start
    }
    return out
}

/// What a date found means for you and the others (the web's AnswerReview).
public struct AnswerReview: Codable, Sendable, Equatable {
    /// "clean", "skip", "approve", "review" or "none".
    public var tone: String
    public var yours: SpanConflict?
    public var others: [SpanConflict]
    public var accepted: Bool
    public var absent: [AbsentPerson]
}

public func reviewAnswer(
    _ found: MultiDayResult?, _ search: EventSettings, you: String?, acceptedStart: String?
) -> AnswerReview {
    let slot = found?.slot
    let conflicts = slot != nil ? found?.conflicts ?? [] : []
    let yours = conflicts.first { $0.profileId == you }
    let others = conflicts.filter { $0.profileId != you }
    let accepted = slot != nil && acceptedStart == slot?.start
    let tone: String
    if slot == nil {
        tone = "none"
    } else if search.kind == .single {
        tone = conflicts.isEmpty ? "clean" : "skip"
    } else if yours != nil && !accepted {
        tone = "approve"
    } else {
        tone = others.isEmpty ? "clean" : "review"
    }
    return AnswerReview(
        tone: tone, yours: yours, others: others, accepted: accepted, absent: slot != nil ? found?.absent ?? [] : [])
}

// MARK: - A start that may move (startFlex.ts, #133)

/// How far a meeting may move from its hour, either way, in minutes.
public let flexMinutes = [0, 30, 60, 90, 120]
private let lastStart: Double = 24 * 60 - 30

/// The start window `flex` minutes either side of the hour; nil for none.
public func flexWindow(_ startHour: Double, _ flex: Int) -> StartWindow? {
    guard flex > 0 else { return nil }
    let at = startHour * 60
    return StartWindow(from: max(0, at - Double(flex)), to: min(lastStart, at + Double(flex)))
}

/// Which of the flex steps the settings' window is; nil when it is none of them (the AI's own).
public func flexOf(_ settings: SchedulerSettings) -> Int? {
    guard let w = settings.startWindow else { return 0 }
    return flexMinutes.first { f in
        guard let own = flexWindow(settings.startHour, f) else { return false }
        return own.from == w.from && own.to == w.to
    }
}

/// A window as an hour and the smallest flex step that covers it.
public func flexAround(_ window: StartWindow) -> (startHour: Double, startWindow: StartWindow?) {
    let startHour = min(23, ((window.from + window.to) / 2 / 60 + 0.5).rounded(.down))
    func covers(_ f: Int) -> Bool {
        guard let w = flexWindow(startHour, f) else { return false }
        return w.from <= window.from && w.to >= window.to
    }
    let flex = flexMinutes.first { $0 > 0 && covers($0) } ?? flexMinutes[flexMinutes.count - 1]
    return (startHour, flexWindow(startHour, flex))
}
