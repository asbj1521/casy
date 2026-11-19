// The availability engine, a translation of src/lib/availability.ts (#282):
// everything the product knows about "when can this group meet", as pure
// functions over epoch milliseconds. Kept equal to the TypeScript by the
// parity fixtures (src/lib/parity/availability.cases.ts); read the comments
// there for the why of each rule, which this file repeats only briefly.
//
// Multi-day searches classify busy blocks: HARD blocks (being away all day)
// rule a day out, SOFT blocks (work, school) come back as conflicts to
// approve, and work ending by 17:00 on the first day is no obstacle (you
// leave in the evening). A calendar's priority overrides both: "skip" never
// blocks, "never" always does. Hours, weekdays and days are local to the
// zone each search is given; days are stepped with Zone.swift.

import Foundation

private let msPerMinute: Int64 = 60_000
private let msPerHour: Int64 = 3_600_000

/// Busy categories that only soft-block a multi-day event.
private let softCategories: Set<EventCategory> = [.work, .school]
/// How long anything else must be to hard-block a day of a multi-day event.
private let minHardBlockMs: Int64 = 20 * msPerHour
/// The departure-day rule's cutoff: work ending by 17:00 means leaving after work.
private let departureHour: Double = 17
/// How much later a date nobody skips anything for may be and still win.
private let skipPatienceDays = 7

/// A half-open interval [start, end) in epoch milliseconds.
public struct Interval: Sendable, Equatable {
    public var start: Int64
    public var end: Int64

    public init(start: Int64, end: Int64) {
        self.start = start
        self.end = end
    }
}

/// Something one participant would give up for a proposed date: work or
/// school to take time off from, or blocks they marked skippable.
public struct SpanConflict: Codable, Sendable, Equatable {
    public var profileId: String
    public var name: String
    /// The overlapping blocks, in time order.
    public var events: [BusyInterval]

    public init(profileId: String, name: String, events: [BusyInterval]) {
        self.profileId = profileId
        self.name = name
        self.events = events
    }
}

/// Someone who can't come, when enough people was all a meeting needed (#89).
public struct AbsentPerson: Codable, Sendable, Equatable {
    public var profileId: String
    public var name: String

    public init(profileId: String, name: String) {
        self.profileId = profileId
        self.name = name
    }
}

/// The result of a search: a span or slot plus any conflicts to review.
public struct MultiDayResult: Codable, Sendable, Equatable {
    public var slot: TimeSlot?
    public var conflicts: [SpanConflict]
    /// Who can't come; missing or empty, everyone searched can.
    public var absent: [AbsentPerson]?

    public init(slot: TimeSlot?, conflicts: [SpanConflict], absent: [AbsentPerson]? = nil) {
        self.slot = slot
        self.conflicts = conflicts
        self.absent = absent
    }

    static var none: MultiDayResult { MultiDayResult(slot: nil, conflicts: []) }
}

/// The recurring shape of a weekly span: Friday 17:00 to Sunday 21:00 is
/// anchorDow 5, spanDays 3, startHour 17, endHour 21.
public struct WeeklySpan: Codable, Sendable, Equatable {
    public var anchorDow: Int
    public var spanDays: Int
    public var startHour: Double
    public var endHour: Double

    public init(anchorDow: Int, spanDays: Int, startHour: Double, endHour: Double) {
        self.anchorDow = anchorDow
        self.spanDays = spanDays
        self.startHour = startHour
        self.endHour = endHour
    }
}

/// A shorter stay that works, when the asked-for holiday length doesn't.
public struct VacationSuggestion: Codable, Sendable, Equatable {
    public var kind: String
    public var days: Int
    public var slot: TimeSlot
    public var conflicts: [SpanConflict]
    public var leaveAfterWork: Bool
    public var homeBeforeWork: Bool
}

// MARK: - Shared primitives

private func iso(_ ms: Int64) -> String { isoString(ms) }

/// Local midnight on or after the instant.
private func startOfDayCeil(_ ms: Int64, _ timeZone: String) -> Int64 {
    let day = startOfDay(ms, timeZone)
    return day < ms ? addDays(day, 1, timeZone) : day
}

private func parseRange(_ startIso: String, _ endIso: String) -> Interval? {
    guard let start = parseInstant(startIso), let end = parseInstant(endIso), end > start else { return nil }
    return Interval(start: start, end: end)
}

/// A busy block's bounds, or nil if malformed or empty.
public func blockRange(_ block: BusyInterval) -> Interval? {
    guard let start = parseInstant(block.start), let end = parseInstant(block.end), end > start else {
        return nil
    }
    return Interval(start: start, end: end)
}

/// True if the block overlaps [start, end): the one definition of "busy then".
public func blockOverlaps(_ block: BusyInterval, _ start: Int64, _ end: Int64) -> Bool {
    guard let iv = blockRange(block) else { return false }
    return iv.start < end && iv.end > start
}

// MARK: - Interval algebra

/// The minimal sorted set of non-overlapping intervals; touching ones fuse.
func mergeIntervals(_ intervals: [Interval]) -> [Interval] {
    guard !intervals.isEmpty else { return [] }
    let sorted = intervals.enumerated().sorted { ($0.element.start, $0.offset) < ($1.element.start, $1.offset) }
        .map(\.element)
    var merged = [sorted[0]]
    for current in sorted.dropFirst() {
        if current.start <= merged[merged.count - 1].end {
            merged[merged.count - 1].end = max(merged[merged.count - 1].end, current.end)
        } else {
            merged.append(current)
        }
    }
    return merged
}

/// The parts of `base` no hole covers, sorted by start.
func subtractIntervals(_ base: [Interval], _ holes: [Interval]) -> [Interval] {
    let mergedHoles = mergeIntervals(holes)
    var result: [Interval] = []
    for segment in mergeIntervals(base) {
        var cursor = segment.start
        for hole in mergedHoles {
            if hole.end <= cursor { continue }
            if hole.start >= segment.end { break }
            if hole.start > cursor { result.append(Interval(start: cursor, end: min(hole.start, segment.end))) }
            cursor = max(cursor, hole.end)
            if cursor >= segment.end { break }
        }
        if cursor < segment.end { result.append(Interval(start: cursor, end: segment.end)) }
    }
    return result
}

// MARK: - Block classification

/// True if its owner is happy to skip this block for any event.
public func isSkippable(_ block: BusyInterval) -> Bool { block.priority == .skip }

/// True if this is work or school, to take time off from; the calendar's priority wins.
public func isSoftBlock(_ block: BusyInterval) -> Bool {
    if block.priority == .skip || block.priority == .never { return false }
    guard let category = block.category else { return false }
    return softCategories.contains(category)
}

/// True if this block rules a day out for a multi-day event entirely.
public func isHardBlock(_ block: BusyInterval) -> Bool {
    if block.priority == .skip { return false }
    if block.priority == .never { return true }
    if isSoftBlock(block) { return false }
    guard let iv = blockRange(block) else { return false }
    return iv.end - iv.start >= minHardBlockMs
}

/// Over a span: `free` people with nothing in the way, `conditional` people
/// whose only obstacle is work or school.
public func spanAvailability(_ participants: [Participant], _ spanStart: Int64, _ spanEnd: Int64) -> (
    free: Int, conditional: Int
) {
    var free = 0
    var conditional = 0
    for p in participants {
        var hard = false
        var soft = false
        for b in p.busy where blockOverlaps(b, spanStart, spanEnd) {
            if isSoftBlock(b) {
                soft = true
            } else if isHardBlock(b) {
                hard = true
                break
            }
        }
        if hard { continue }
        if soft { conditional += 1 } else { free += 1 }
    }
    return (free, conditional)
}

// MARK: - Single meetings

private struct Found {
    var slot: TimeSlot
    var present: [Participant]
}

/// The earliest meeting slot that works for everyone (or the quorum).
public func findEarliestSlot(_ search: MeetingSearch) -> TimeSlot? {
    earliestMeeting(search)?.slot
}

private func earliestMeeting(_ search: MeetingSearch) -> Found? {
    guard let range = parseRange(search.searchStart, search.searchEnd) else { return nil }
    let durationMs = Int64(search.durationMinutes) * msPerMinute
    guard durationMs > 0 else { return nil }
    let windows = buildAllowedWindows(range, search.timeZone, search.constraints)
    let snap = startSnapper(search.timeZone, search.constraints?.startStepMinutes)
    let participants = search.participants
    let found: Found?
    if let quorum = search.quorum, quorum < participants.count {
        found = earliestQuorumMeeting(participants, quorum, windows, range, durationMs, snap)
    } else {
        found = earliestFullMeeting(participants, windows, range, durationMs, snap)
    }
    guard let found, let preferred = search.constraints?.preferredHour else { return found }
    return closestStart(found, preferred, search, windows, range, durationMs, snap) ?? found
}

private func earliestFullMeeting(
    _ participants: [Participant], _ windows: [Interval], _ range: Interval, _ durationMs: Int64,
    _ snap: (Int64) -> Int64
) -> Found? {
    let free = subtractIntervals(windows, collectBusy(participants, range))
    for gap in free {
        let start = snap(gap.start)
        if gap.end - start >= durationMs {
            return Found(slot: TimeSlot(start: iso(start), end: iso(start + durationMs)), present: participants)
        }
    }
    return nil
}

/// The start nearest `preferredHour` in the window `found` lies in, as good as `found`.
private func closestStart(
    _ found: Found, _ preferredHour: Double, _ search: MeetingSearch, _ windows: [Interval], _ range: Interval,
    _ durationMs: Int64, _ snap: (Int64) -> Int64
) -> Found? {
    guard let foundStart = parseInstant(found.slot.start),
        let window = windows.first(where: { $0.start <= foundStart && foundStart < $0.end })
    else { return nil }
    let stepMinutes = search.constraints?.startStepMinutes ?? 0
    let step = Int64(stepMinutes == 0 ? 30 : stepMinutes) * msPerMinute
    let target = atHour(startOfDay(window.start, search.timeZone), preferredHour, search.timeZone)
    var starts: [Int64] = []
    var s = snap(window.start)
    while s + durationMs <= window.end {
        starts.append(s)
        s += step
    }
    starts.sort { a, b in
        let da = abs(a - target)
        let db = abs(b - target)
        return da != db ? da < db : a < b
    }
    let participants = search.participants
    let timelines = participants.map { collectBusy([$0], range) }
    let need = search.quorum.map { $0 < participants.count ? $0 : participants.count } ?? participants.count
    for start in starts {
        if start == foundStart { return found }
        let end = start + durationMs
        let present = participants.indices.filter { k in
            timelines[k].allSatisfy { $0.end <= start || $0.start >= end }
        }.map { participants[$0] }
        if present.count >= need {
            return Found(slot: TimeSlot(start: iso(start), end: iso(end)), present: present)
        }
    }
    return nil
}

/// The first allowed start at or after an instant: with a step, the next
/// whole step from local midnight.
private func startSnapper(_ timeZone: String, _ stepMinutes: Int?) -> (Int64) -> Int64 {
    guard let stepMinutes, stepMinutes > 0 else { return { $0 } }
    let step = Int64(stepMinutes) * msPerMinute
    return { ms in
        let midnight = startOfDay(ms, timeZone)
        let since = ms - midnight
        return midnight + (since + step - 1) / step * step
    }
}

/// The earliest slot at least `quorum` people are free for throughout.
private func earliestQuorumMeeting(
    _ participants: [Participant], _ quorum: Int, _ windows: [Interval], _ range: Interval, _ durationMs: Int64,
    _ snap: (Int64) -> Int64
) -> Found? {
    let timelines = participants.map { collectBusy([$0], range) }
    let ends = Array(Set(timelines.flatMap { $0.map(\.end) })).sorted()
    func freeFor(_ busy: [Interval], _ start: Int64, _ end: Int64) -> Bool {
        var lo = 0
        var hi = busy.count
        while lo < hi {
            let mid = (lo + hi) >> 1
            if busy[mid].end <= start { lo = mid + 1 } else { hi = mid }
        }
        return lo == busy.count || busy[lo].start >= end
    }
    for w in windows {
        let last = w.end - durationMs
        if last < w.start { continue }
        var i = 0
        while i < ends.count && ends[i] <= w.start { i += 1 }
        var moments = [w.start]
        while i < ends.count && ends[i] <= last {
            moments.append(ends[i])
            i += 1
        }
        var seen = Set<Int64>()
        let starts = moments.map(snap).filter { seen.insert($0).inserted && $0 <= last }
        for start in starts {
            let end = start + durationMs
            let present = participants.indices.filter { freeFor(timelines[$0], start, end) }.map { participants[$0] }
            if present.count >= quorum {
                return Found(slot: TimeSlot(start: iso(start), end: iso(end)), present: present)
            }
        }
    }
    return nil
}

private func absentFrom(_ all: [Participant], _ present: [Participant]) -> [AbsentPerson] {
    let here = Set(present.map(\.profileId))
    return all.filter { !here.contains($0.profileId) }.map { AbsentPerson(profileId: $0.profileId, name: $0.name) }
}

/// A meeting slot, letting people skip what they marked skippable only when
/// waiting for a date nobody skips anything for would take more than a week.
public func findMeetingSlot(_ search: MeetingSearch) -> MultiDayResult {
    let strict = earliestMeeting(search)
    func absent(_ found: Found?) -> [AbsentPerson]? {
        let people = found.map { absentFrom(search.participants, $0.present) } ?? []
        return people.isEmpty ? nil : people
    }
    let anySkippable = search.participants.contains { $0.busy.contains(where: isSkippable) }
    if !anySkippable { return MultiDayResult(slot: strict?.slot, conflicts: [], absent: absent(strict)) }

    var relaxedSearch = search
    relaxedSearch.participants = search.participants.map { p in
        var p = p
        p.busy = p.busy.filter { !isSkippable($0) }
        return p
    }
    guard let relaxed = earliestMeeting(relaxedSearch) else {
        return MultiDayResult(slot: strict?.slot, conflicts: [], absent: absent(strict))
    }
    let relaxedStart = parseInstant(relaxed.slot.start) ?? 0
    let lastPatientDay = addDays(relaxedStart, skipPatienceDays, search.timeZone)
    if let strict, startOfDay(parseInstant(strict.slot.start) ?? 0, search.timeZone) <= lastPatientDay {
        return MultiDayResult(slot: strict.slot, conflicts: [], absent: absent(strict))
    }
    let coming = Set(relaxed.present.map(\.profileId))
    return MultiDayResult(
        slot: relaxed.slot,
        conflicts: collectConflicts(
            search.participants.filter { coming.contains($0.profileId) }, relaxedStart,
            parseInstant(relaxed.slot.end) ?? 0, isSkippable),
        absent: absent(relaxed))
}

/// The intervals a meeting may land in, from the hours and weekdays, local
/// to the zone; a window belongs to the day it starts on.
private func buildAllowedWindows(_ range: Interval, _ timeZone: String, _ constraints: SchedulingConstraints?)
    -> [Interval]
{
    let earliestHour = constraints?.earliestHour ?? 0
    let latestHour = constraints?.latestHour ?? 24
    let allowedDays: Set<Int>? = constraints?.allowedDays.flatMap { $0.count < 7 ? Set($0) : nil }
    if earliestHour == 0 && latestHour == 24 && allowedDays == nil { return [range] }
    var windows: [Interval] = []
    var day = startOfDay(range.start, timeZone)
    while day < range.end {
        defer { day = addDays(day, 1, timeZone) }
        if let allowedDays, !allowedDays.contains(dayOfWeek(day, timeZone)) { continue }
        let start = max(range.start, atHour(day, earliestHour, timeZone))
        let end = min(range.end, atHour(day, latestHour, timeZone))
        if end > start { windows.append(Interval(start: start, end: end)) }
    }
    return windows
}

/// Everyone's busy blocks, clamped to the range and merged into one timeline.
private func collectBusy(_ participants: [Participant], _ range: Interval) -> [Interval] {
    var raw: [Interval] = []
    for p in participants {
        for block in p.busy {
            guard let iv = blockRange(block) else { continue }
            let start = max(iv.start, range.start)
            let end = min(iv.end, range.end)
            if end > start { raw.append(Interval(start: start, end: end)) }
        }
    }
    return mergeIntervals(raw)
}

// MARK: - Multi-day spans

private func collectSoftConflicts(
    _ participants: [Participant], _ startMs: Int64, _ endMs: Int64, _ departureCutoffMs: Int64 = .min
) -> [SpanConflict] {
    collectConflicts(participants, startMs, endMs, isSoftBlock, departureCutoffMs)
}

/// Each participant's blocks passing `include` that overlap [startMs, endMs).
private func collectConflicts(
    _ participants: [Participant], _ startMs: Int64, _ endMs: Int64, _ include: (BusyInterval) -> Bool,
    _ departureCutoffMs: Int64 = .min
) -> [SpanConflict] {
    var conflicts: [SpanConflict] = []
    for p in participants {
        let overlapping = p.busy.enumerated().compactMap { n, block -> (BusyInterval, Int64, Int)? in
            guard include(block), let iv = blockRange(block) else { return nil }
            return iv.start < endMs && iv.end > startMs && iv.end > departureCutoffMs ? (block, iv.start, n) : nil
        }
        .sorted { ($0.1, $0.2) < ($1.1, $1.2) }
        .map(\.0)
        if !overlapping.isEmpty {
            conflicts.append(SpanConflict(profileId: p.profileId, name: p.name, events: overlapping))
        }
    }
    return conflicts
}

private struct DayGrid {
    var hardPrefix: [Int]
    var soft: [(prefix: [Int], onDay: [Bool], lateOnDay: [Bool])]
}

/// The last index i with bounds[i] <= ms.
private func dayIndexFloor(_ bounds: [Int64], _ ms: Int64) -> Int {
    var lo = 0
    var hi = bounds.count - 1
    while lo < hi {
        let mid = (lo + hi + 1) >> 1
        if bounds[mid] <= ms { lo = mid } else { hi = mid - 1 }
    }
    return lo
}

private func buildDayGrid(_ participants: [Participant], _ bounds: [Int64], _ departures: [Int64]) -> DayGrid {
    let numDays = bounds.count - 1
    let first = bounds[0]
    let last = bounds[numDays]
    var hard = [Bool](repeating: false, count: numDays)
    var onDay = [[Bool]](repeating: [Bool](repeating: false, count: numDays), count: participants.count)
    var lateOnDay = onDay
    for (pi, p) in participants.enumerated() {
        for block in p.busy {
            guard let iv = blockRange(block), iv.end > first, iv.start < last else { continue }
            let from = iv.start <= first ? 0 : dayIndexFloor(bounds, iv.start)
            let to = iv.end >= last ? numDays : dayIndexFloor(bounds, iv.end - 1) + 1
            if isHardBlock(block) {
                for i in from..<max(from, to) { hard[i] = true }
            } else if isSoftBlock(block) {
                for i in from..<max(from, to) {
                    onDay[pi][i] = true
                    if iv.end > departures[i] { lateOnDay[pi][i] = true }
                }
            }
        }
    }
    func prefix(_ flags: [Bool]) -> [Int] {
        var out = [Int](repeating: 0, count: numDays + 1)
        for i in 0..<numDays { out[i + 1] = out[i] + (flags[i] ? 1 : 0) }
        return out
    }
    return DayGrid(
        hardPrefix: prefix(hard),
        soft: participants.indices.map { (prefix(onDay[$0]), onDay[$0], lateOnDay[$0]) })
}

/// The best run of `days` whole local days: nobody away, the fewest people
/// taking time off, then the fewest days off, then the earliest.
public func findBestDaySpan(
    _ participants: [Participant], _ days: Int, _ searchStart: String, _ searchEnd: String, _ timeZone: String
) -> MultiDayResult {
    guard let range = parseRange(searchStart, searchEnd), days > 0 else { return .none }
    let lastMidnight = startOfDay(range.end, timeZone)
    var bounds: [Int64] = []
    var day = startOfDayCeil(range.start, timeZone)
    while day <= lastMidnight {
        bounds.append(day)
        day = addDays(day, 1, timeZone)
    }
    let numDays = bounds.count - 1
    guard numDays >= days else { return .none }
    let departures = bounds.map { atHour($0, departureHour, timeZone) }
    let grid = buildDayGrid(participants, bounds, departures)

    var bestStart = -1
    var bestPeople = Int.max
    var bestPersonDays = Int.max
    var i = 0
    while i + days <= numDays {
        defer { i += 1 }
        if grid.hardPrefix[i + days] - grid.hardPrefix[i] > 0 { continue }
        var people = 0
        var personDays = 0
        for s in grid.soft {
            var conflicted = s.prefix[i + days] - s.prefix[i]
            if conflicted > 0 && s.onDay[i] && !s.lateOnDay[i] { conflicted -= 1 }
            if conflicted > 0 {
                people += 1
                personDays += conflicted
            }
        }
        if people < bestPeople || (people == bestPeople && personDays < bestPersonDays) {
            bestStart = i
            bestPeople = people
            bestPersonDays = personDays
            if people == 0 { break }
        }
    }
    guard bestStart >= 0 else { return .none }
    let slotStart = bounds[bestStart]
    let slotEnd = bounds[bestStart + days]
    return MultiDayResult(
        slot: TimeSlot(start: iso(slotStart), end: iso(slotEnd)),
        conflicts: collectSoftConflicts(participants, slotStart, slotEnd, departures[bestStart]))
}

// MARK: - Weekly spans

/// The best occurrence of a weekly span ("a weekend"), scored as findBestDaySpan.
public func findWeeklySpan(
    _ participants: [Participant], _ shape: WeeklySpan, _ searchStart: String, _ searchEnd: String,
    _ timeZone: String
) -> MultiDayResult {
    guard let range = parseRange(searchStart, searchEnd), shape.spanDays > 0 else { return .none }
    var anchor = startOfDayCeil(range.start, timeZone)
    while dayOfWeek(anchor, timeZone) != shape.anchorDow { anchor = addDays(anchor, 1, timeZone) }

    var best: MultiDayResult?
    var bestPeople = Int.max
    var bestEvents = Int.max
    while true {
        defer { anchor = addDays(anchor, 7, timeZone) }
        let spanStart = atHour(anchor, shape.startHour, timeZone)
        let lastDay = addDays(anchor, shape.spanDays - 1, timeZone)
        let spanEnd = atHour(lastDay, shape.endHour, timeZone)
        if spanEnd > range.end { break }
        let blocked = participants.contains { p in
            p.busy.contains { isHardBlock($0) && blockOverlaps($0, spanStart, spanEnd) }
        }
        if blocked { continue }
        let conflicts = collectSoftConflicts(participants, spanStart, spanEnd)
        let slot = TimeSlot(start: iso(spanStart), end: iso(spanEnd))
        if conflicts.isEmpty { return MultiDayResult(slot: slot, conflicts: conflicts) }
        let events = conflicts.reduce(0) { $0 + $1.events.count }
        if conflicts.count < bestPeople || (conflicts.count == bestPeople && events < bestEvents) {
            best = MultiDayResult(slot: slot, conflicts: conflicts)
            bestPeople = conflicts.count
            bestEvents = events
        }
    }
    return best ?? .none
}

// MARK: - Vacation suggestions

/// A shorter stay when the asked-for length has conflicts: the longest clean
/// one a day or two shorter, else the least bad one a day shorter.
public func findVacationSuggestions(
    _ participants: [Participant], _ days: Int, _ searchStart: String, _ searchEnd: String, _ timeZone: String
) -> [VacationSuggestion] {
    func build(_ d: Int, _ res: MultiDayResult) -> VacationSuggestion? {
        guard let slot = res.slot, let start = parseInstant(slot.start), let end = parseInstant(slot.end) else {
            return nil
        }
        let timing = spanTiming(participants, start, end, timeZone)
        return VacationSuggestion(
            kind: "shorter", days: d, slot: slot, conflicts: res.conflicts,
            leaveAfterWork: timing.leaveAfterWork, homeBeforeWork: timing.homeBeforeWork)
    }
    var d = days - 1
    while d >= max(2, days - 2) {
        let res = findBestDaySpan(participants, d, searchStart, searchEnd, timeZone)
        if res.slot != nil && res.conflicts.isEmpty { return build(d, res).map { [$0] } ?? [] }
        d -= 1
    }
    if days > 2, let s = build(days - 1, findBestDaySpan(participants, days - 1, searchStart, searchEnd, timeZone)) {
        return [s]
    }
    return []
}

private func spanTiming(_ participants: [Participant], _ startMs: Int64, _ endMs: Int64, _ timeZone: String) -> (
    leaveAfterWork: Bool, homeBeforeWork: Bool
) {
    let departure = atHour(startMs, departureHour, timeZone)
    let dayAfter = addDays(endMs, 1, timeZone)
    var leaveAfterWork = false
    var homeBeforeWork = false
    for p in participants {
        for b in p.busy where isSoftBlock(b) {
            guard let iv = blockRange(b) else { continue }
            if iv.end > startMs && iv.end <= departure { leaveAfterWork = true }
            if iv.start >= endMs && iv.start < dayAfter { homeBeforeWork = true }
        }
    }
    return (leaveAfterWork, homeBeforeWork)
}
