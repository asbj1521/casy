// Tid til hinanden (#171): primeDates.ts. The stretches coming up when a whole
// group of yours is free (the home page's stars, #202: found natively), and how
// one is said and planned (its sheet, #200).

/// A stretch coming up when a whole group of yours is free.
public struct PrimeDate: Codable, Sendable, Equatable {
    public var groupId: String
    /// "hours": a stretch of one day; "weekend": a whole Saturday and Sunday.
    public var kind: String
    /// Its first day's local midnight: where the star goes.
    public var day: Int64
    public var start: Int64
    public var end: Int64
    public var value: Double

    public init(groupId: String, kind: String, day: Int64, start: Int64, end: Int64, value: Double) {
        self.groupId = groupId
        self.kind = kind
        self.day = day
        self.start = start
        self.end = end
        self.value = value
    }
}

/// The hours "any time" may place a meeting within (`ANY_TIME_EARLIEST_HOUR`, `_LATEST_`).
public let anyTimeEarliestHour = 10.0
public let anyTimeLatestHour = 22.0

/// How a stretch is said: "weekend", the whole day ("allDay", 10:00 to 22:00),
/// from an hour until the evening's end ("from"), or between two hours ("between").
public func stretchShape(_ prime: PrimeDate, _ timeZone: String) -> String {
    if prime.kind == "weekend" { return "weekend" }
    guard prime.end == atHour(prime.day, anyTimeLatestHour, timeZone) else { return "between" }
    return prime.start == atHour(prime.day, anyTimeEarliestHour, timeZone) ? "allDay" : "from"
}

/// Everyone named, the last joined with "og"/"and", as Intl.ListFormat says it
/// in Danish and British English: "Ana, Bo og dig".
public func everyone(_ names: [String], _ lang: Lang) -> String {
    guard let last = names.last else { return "" }
    if names.count == 1 { return last }
    return "\(names.dropLast().joined(separator: ", ")) \(lang == .da ? "og" : "and") \(last)"
}

/// How long a plan for a stretch starts out (PLAN_MINUTES): an ordinary get-together.
private let primePlanMinutes = 3 * 60

/// Planlæg begun from a starred day (#171, primeDatePlan): that day only, any
/// time in it for three hours, the stretch's first whole hour kept for a time
/// picked by hand; a weekend is Saturday and Sunday away together. Laid over
/// `base`, the plan as it was.
public func primeDatePlan(_ prime: PrimeDate, _ timeZone: String, onto base: SchedulerSettings) -> SchedulerSettings {
    var s = base
    let day = isoString(prime.day)
    if prime.kind == "weekend" {
        s.multiDay = true
        s.days = 2
        s.startDow = 6
        s.period = Period(from: day, to: isoString(addDays(prime.day, 1, timeZone)), days: true)
        return s
    }
    s.multiDay = false
    s.anyTime = true
    s.startWindow = nil
    s.startHour = (Double(prime.start - startOfDay(prime.start, timeZone)) / 3_600_000).rounded(.up)
    s.durationMinutes = primePlanMinutes
    s.dows = [1, 2, 3, 4, 5, 6, 0]
    s.period = Period(from: day, to: day, days: true)
    return s
}

/// How far ahead it looks, from tomorrow: soon enough to be spontaneous.
public let primeLookAheadDays = 21
/// The shortest stretch worth a star.
public let primeMinHours = 4.0
/// The smallest group that gets stars.
public let primeMinGroupSize = 4
/// How many days around the group's own events stay out: they are already seeing each other.
private let primeNearDays = 3
/// How many show at once, across every group: a few good ones, not a starry sky.
public let maxPrimeDates = 3

private let hourMs: Int64 = 3_600_000
private let halfHourMs: Int64 = 1_800_000

/// A stretch of time, as the groups function gives busy times and event dates.
public struct PrimeSpan: Codable, Sendable, Equatable {
    public var start: String
    public var end: String

    public init(start: String, end: String) {
        self.start = start
        self.end = end
    }
}

/// What primeCandidates needs to know of a group.
public struct PrimeGroup: Codable, Sendable, Equatable {
    public var id: String
    public var memberIds: [String]
    /// Each member's busy times, by profile id.
    public var busy: [String: [PrimeSpan]]
    /// Whether each member has a calendar at all.
    public var connected: [String: Bool]
    /// Every date the group's events have suggested or agreed.
    public var eventDates: [PrimeSpan]
    /// A vote of the group's is still open: they are planning already.
    public var voting: Bool

    public init(
        id: String, memberIds: [String], busy: [String: [PrimeSpan]], connected: [String: Bool],
        eventDates: [PrimeSpan], voting: Bool
    ) {
        self.id = id
        self.memberIds = memberIds
        self.busy = busy
        self.connected = connected
        self.eventDates = eventDates
        self.voting = voting
    }
}

private struct Span {
    var start: Int64
    var end: Int64
}

private func overlaps(_ a: Span, _ b: Span) -> Bool { a.start < b.end && b.start < a.end }
private func span(_ s: PrimeSpan) -> Span { Span(start: parseInstant(s.start) ?? 0, end: parseInstant(s.end) ?? 0) }

/// The free gaps between `from` and `to` around `busy` (in any order, overlapping or not).
private func freeGaps(_ busy: [Span], _ from: Int64, _ to: Int64) -> [Span] {
    let sorted = busy.filter { $0.end > from && $0.start < to }.enumerated()
        .sorted { $0.element.start != $1.element.start ? $0.element.start < $1.element.start : $0.offset < $1.offset }
        .map(\.element)
    var gaps: [Span] = []
    var at = from
    for b in sorted {
        if b.start > at { gaps.append(Span(start: at, end: min(b.start, to))) }
        at = max(at, b.end)
        if at >= to { break }
    }
    if at < to { gaps.append(Span(start: at, end: to)) }
    return gaps
}

/// Sooner is a little better: the last day looked at is worth 70 % of tomorrow.
private func soonness(_ ahead: Int) -> Double {
    1 - (0.3 * Double(ahead - 1)) / Double(primeLookAheadDays)
}

/// A stretch of one day: longer is better (the whole 10:00 to 22:00 is 1), a Saturday
/// or Sunday better still, an evening after work on a weekday less so.
private func hoursValue(_ stretch: Span, _ day: Int64, _ ahead: Int, _ timeZone: String) -> Double {
    let dow = dayOfWeek(day, timeZone)
    let weekend = dow == 0 || dow == 6
    let evening = !weekend && stretch.start >= atHour(day, 17, timeZone)
    let length = Double(stretch.end - stretch.start) / Double(hourMs) / (anyTimeLatestHour - anyTimeEarliestHour)
    return length * (weekend ? 1.3 : 1) * (evening ? 0.7 : 1) * soonness(ahead)
}

/// Every stretch the whole group is free for, best first: at most one a day (its
/// longest), and a weekend where both its days are wholly free. None for a group under
/// primeMinGroupSize, one with a member with no calendar, or one already voting.
public func primeCandidates(_ group: PrimeGroup, now: Int64, _ timeZone: String) -> [PrimeDate] {
    if group.memberIds.count < primeMinGroupSize || group.voting { return [] }
    if group.memberIds.contains(where: { group.connected[$0] != true }) { return [] }

    let looked = Span(start: now, end: addDays(now, primeLookAheadDays + 2, timeZone))
    let busy = group.memberIds.flatMap { (group.busy[$0] ?? []).map(span) }.filter { overlaps($0, looked) }
    let year = localDate(now, timeZone).year
    let holidays = holidayBlocks([year, year + 1], timeZone).map { span(PrimeSpan(start: $0.start, end: $0.end)) }
    let events = group.eventDates.map(span)

    var found: [PrimeDate] = []
    // Which days ahead (1 is tomorrow) are free from 10:00 to 22:00, for the weekends, in order.
    var wholeDay: [(ahead: Int, day: Int64)] = []
    for ahead in 1...primeLookAheadDays {
        let day = addDays(now, ahead, timeZone)
        let dayNext = addDays(now, ahead + 1, timeZone)
        if holidays.contains(where: { overlaps($0, Span(start: day, end: dayNext)) }) { continue }
        let near = Span(start: addDays(day, -primeNearDays, timeZone), end: addDays(day, primeNearDays + 1, timeZone))
        if events.contains(where: { overlaps($0, near) }) { continue }

        let from = atHour(day, anyTimeEarliestHour, timeZone)
        let to = atHour(day, anyTimeLatestHour, timeZone)
        let gaps = freeGaps(busy, from, to)
        if gaps.count == 1 && gaps[0].start == from && gaps[0].end == to { wholeDay.append((ahead, day)) }
        // The day's longest gap, on the hour or the half hour (Denmark's offset is whole hours).
        var longest: Span?
        for g in gaps {
            let rounded = Span(
                start: Int64((Double(g.start) / Double(halfHourMs)).rounded(.up)) * halfHourMs,
                end: Int64((Double(g.end) / Double(halfHourMs)).rounded(.down)) * halfHourMs)
            if longest == nil || rounded.end - rounded.start > longest!.end - longest!.start { longest = rounded }
        }
        guard let longest, Double(longest.end - longest.start) >= primeMinHours * Double(hourMs) else { continue }
        found.append(
            PrimeDate(
                groupId: group.id, kind: "hours", day: day, start: longest.start, end: longest.end,
                value: hoursValue(longest, day, ahead, timeZone)))
    }

    // A free Saturday with a free Sunday after it: room to go somewhere together.
    for (ahead, day) in wholeDay {
        guard dayOfWeek(day, timeZone) == 6, let sunday = wholeDay.first(where: { $0.ahead == ahead + 1 })?.day
        else { continue }
        found.append(
            PrimeDate(
                groupId: group.id, kind: "weekend", day: day, start: atHour(day, anyTimeEarliestHour, timeZone),
                end: atHour(sunday, anyTimeLatestHour, timeZone), value: 1.6 * soonness(ahead)))
    }
    // Best first, as JavaScript's stable sort leaves equal ones.
    return found.enumerated()
        .sorted { $0.element.value != $1.element.value ? $0.element.value > $1.element.value : $0.offset < $1.offset }
        .map(\.element)
}

/// The few to show: each group's best, the day scores (#119, 0 to 100, by the start)
/// counting where there are any, then the best of those, at most maxPrimeDates. A low
/// score halves a stretch's worth: an exam the next morning makes a free evening much
/// less of one.
public func pickPrimeDates(_ candidates: [[PrimeDate]], scores: [String: [Int64: Double]] = [:]) -> [PrimeDate] {
    func worth(_ p: PrimeDate) -> Double {
        guard let score = scores[p.groupId]?[p.start] else { return p.value }
        return p.value * (0.5 + score / 200)
    }
    let best: [PrimeDate] = candidates.compactMap { list in
        var top: PrimeDate?
        for p in list where top == nil || worth(p) > worth(top!) { top = p }
        guard var top else { return nil }
        top.value = worth(top)
        return top
    }
    return Array(
        best.enumerated()
            .sorted { $0.element.value != $1.element.value ? $0.element.value > $1.element.value : $0.offset < $1.offset }
            .map(\.element)
            .prefix(maxPrimeDates))
}
