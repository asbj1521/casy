// The dates a vote offers, translated from src/lib/candidates.ts (#282):
// the dates found after the one on screen (the pool), each rated for how
// well it suits the people going (Comfort.swift), and up to five chosen
// for variety: clean dates before costly ones, a spread of weekdays, two
// days apart, a big plan never on 1 January. Kept equal to the TypeScript
// by the parity fixtures (candidates.cases.ts).

import Foundation

private let candidateCount = 5
private let meetingGapDays = 2
private let varietyDays = 42
private let maxLookedAt = 60

/// What a search is offered from.
public struct CandidateOptions: Sendable {
    /// The date on screen: always offered, first; later dates are searched after it.
    public var first: FoundDate
    /// Where the period searched ends (exclusive).
    public var end: String
    public var count: Int
    /// The server's match score per date (#119), by its start.
    public var scores: [String: Double]
    public var profile: EventImpact?
    public var now: Int64
    /// "soon": the earliest dates whatever they cost (#234); else "hassle".
    public var priority: String
    /// The pool comes from several times (findPoolAcross): a date at each.
    public var everyTime: Bool

    public init(
        first: FoundDate, end: String, count: Int = 5, scores: [String: Double] = [:], profile: EventImpact? = nil,
        now: Int64, priority: String = "hassle", everyTime: Bool = false
    ) {
        self.first = first
        self.end = end
        self.count = count
        self.scores = scores
        self.profile = profile
        self.now = now
        self.priority = priority
        self.everyTime = everyTime
    }
}

/// A big plan on New Year's Day (#166): drink, a late night or heavy going.
public func bigOnNewYearsDay(
    _ profile: EventImpact?, start: String, end: String, _ settings: EventSettings, _ timeZone: String
) -> Bool {
    guard settings.kind == .single, onNewYearsDay(start, timeZone) else { return false }
    let impact = impactOn(profile, start: start, end: end, settings, timeZone)
    return impact.effects.contains("alcohol") || impact.effects.contains("lateNight") || impact.strain == "heavy"
}

private func nextSearchStart(_ search: EventSettings, _ date: FoundDate, _ timeZone: String) -> String {
    if search.kind == .vacation { return date.slot.end }
    let day = startOfDay(parseInstant(date.slot.start) ?? 0, timeZone)
    return isoString(addDays(day, 1, timeZone))
}

private func dayIndex(_ iso: String, _ timeZone: String) -> Int64 {
    let d = localDate(parseInstant(iso) ?? 0, timeZone)
    return daysFromCivil(year: Int64(d.year), month: Int64(d.month + 1), day: Int64(d.day))
}

/// The dates after the one on screen, up to sixty, each searched from the day after the last.
public func findPool(
    _ participants: [Participant], _ search: EventSettings, _ options: CandidateOptions, _ timeZone: String
) -> [FoundDate] {
    var found: [FoundDate] = []
    var from = nextSearchStart(search, options.first, timeZone)
    let end = parseInstant(options.end) ?? 0
    while found.count < maxLookedAt && (parseInstant(from) ?? 0) < end {
        let result = findEventSlot(participants, search, from, options.end, timeZone)
        guard let slot = result.slot else { break }
        let date = FoundDate(slot: slot, conflicts: result.conflicts, absent: nil)
        found.append(date)
        from = nextSearchStart(search, date, timeZone)
    }
    return found
}

/// The pools of several searches (a few times of day) as one, each start once, soonest first.
public func findPoolAcross(
    _ participants: [Participant], _ searches: [EventSettings], _ options: CandidateOptions, _ timeZone: String
) -> [FoundDate] {
    if searches.count <= 1 { return searches.first.map { findPool(participants, $0, options, timeZone) } ?? [] }
    var seen: Set<String> = [options.first.slot.start]
    let all = searches.flatMap { findPool(participants, $0, options, timeZone) }.filter { seen.insert($0.slot.start).inserted }
    return all.enumerated().sorted {
        let a = parseInstant($0.element.slot.start) ?? 0
        let b = parseInstant($1.element.slot.start) ?? 0
        return a != b ? a < b : $0.offset < $1.offset
    }.map(\.element)
}

/// The chosen dates, soonest first; the order they were picked in; and each date's comfort, the pool's order.
public struct RankedDates: Sendable {
    public var pool: [FoundDate]
    public var chosen: [FoundDate]
    public var byPick: [FoundDate]
    /// Each of `pool`'s dates' comfort, in the same order.
    public var comfort: [Comfort]
}

public func pickCandidates(
    _ participants: [Participant], _ search: EventSettings, _ options: CandidateOptions, _ timeZone: String
) -> [FoundDate] {
    rankCandidates(participants, search, options, timeZone).chosen
}

public func rankCandidates(
    _ participants: [Participant], _ search: EventSettings, _ options: CandidateOptions, _ timeZone: String
) -> RankedDates {
    rankFromPool(findPool(participants, search, options, timeZone), participants, search, options, timeZone)
}

public func rankFromPool(
    _ found: [FoundDate], _ participants: [Participant], _ search: EventSettings, _ options: CandidateOptions,
    _ timeZone: String
) -> RankedDates {
    // Dates by their place in `pool`: 0 is the one on screen.
    let pool = [options.first] + found
    var chosen = [0]
    let single = search.kind == .single
    let days = pool.map { dayIndex($0.slot.start, timeZone) }
    let starts = pool.map { parseInstant($0.slot.start) ?? 0 }
    let ends = pool.map { parseInstant($0.slot.end) ?? 0 }
    func fits(_ d: Int, _ gap: Int) -> Bool {
        chosen.allSatisfy { c in
            single ? abs(days[c] - days[d]) >= Int64(gap) : starts[d] >= ends[c] || ends[d] <= starts[c]
        }
    }
    func weekday(_ d: Int) -> Int { localDate(starts[d], timeZone).dow }
    func newWeekday(_ d: Int) -> Bool {
        chosen.allSatisfy { weekday($0) != weekday(d) } && (!single || days[d] - days[0] <= Int64(varietyDays))
    }
    func clock(_ d: Int) -> Int64 { starts[d] - startOfDay(starts[d], timeZone) }
    func newTime(_ d: Int) -> Bool { chosen.allSatisfy { clock($0) != clock(d) } }
    func take(_ order: [Int], gap: Int = meetingGapDays, also: (Int) -> Bool = { _ in true }) {
        for d in order {
            if chosen.count >= options.count { return }
            if !chosen.contains(d) && fits(d, gap) && also(d) { chosen.append(d) }
        }
    }

    let rate = comfortRater(
        participants: participants, settings: search, profile: options.profile, timeZone: timeZone, now: options.now)
    let comfort = pool.map { rate($0.slot.start, $0.slot.end, options.scores[$0.slot.start]) }
    let offered = (1..<pool.count).filter {
        !bigOnNewYearsDay(options.profile, start: pool[$0].slot.start, end: pool[$0].slot.end, search, timeZone)
    }
    func newYear(_ d: Int) -> Int { onNewYearsDay(pool[d].slot.start, timeZone) ? 1 : 0 }
    // The web's two stable sorts, as one: 1 January last, then by cost, then as found.
    let clean = offered.filter { pool[$0].conflicts.isEmpty }.sorted {
        (newYear($0), comfort[$0].cost, $0) < (newYear($1), comfort[$1].cost, $1)
    }
    let costly = offered.filter { !pool[$0].conflicts.isEmpty }.sorted {
        (newYear($0), pool[$0].conflicts.count, comfort[$0].cost, $0)
            < (newYear($1), pool[$1].conflicts.count, comfort[$1].cost, $1)
    }
    if options.priority == "soon" {
        let soonest = offered.sorted { (newYear($0), $0) < (newYear($1), $1) }
        if options.everyTime { take(soonest, also: newTime) }
        take(soonest)
        take(soonest, gap: 1)
    } else {
        if options.everyTime { take(clean, also: newTime) }
        take(clean, also: newWeekday)
        take(clean)
        take(costly, also: newWeekday)
        take(costly)
        take(clean, gap: 1)
        take(costly, gap: 1)
    }
    let byPick = chosen.map { pool[$0] }
    let soonestFirst = chosen.enumerated().sorted {
        starts[$0.element] != starts[$1.element] ? starts[$0.element] < starts[$1.element] : $0.offset < $1.offset
    }.map { pool[$0.element] }
    return RankedDates(pool: pool, chosen: soonestFirst, byPick: byPick, comfort: comfort)
}
