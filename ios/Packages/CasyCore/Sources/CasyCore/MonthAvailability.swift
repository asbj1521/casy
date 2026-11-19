// How free each day of a month is for an event, translated from src/lib/
// monthAvailability.ts (#282), for Planlæg's month chart: per day, who is
// free outright, who only if they skip or take time off, and which days the
// search leaves out. Counted as the searches count (Availability.swift).
// Kept equal to the TypeScript by the parity fixtures (monthAvailability.cases.ts).

import Foundation

public struct DayCell: Codable, Sendable, Equatable {
    /// Local midnight, ISO 8601.
    public var date: String
    public var dayOfMonth: Int
    public var isPast: Bool
    public var freeCount: Int
    /// Free only by giving something up: time off, or a calendar marked skippable.
    public var conditionalCount: Int
    /// Not searched at all: an unticked weekday, or a day outside a weekly trip.
    public var excluded: Bool
}

public struct MonthAvailability: Codable, Sendable, Equatable {
    /// "Juni 2026".
    public var label: String
    public var days: [DayCell]
    public var total: Int
    /// How many free make a day work: `total`, or fewer with "at least N" (#89).
    public var enough: Int
}

/// `month` is 0-based, as the web's.
public func monthAvailability(
    _ allParticipants: [Participant], _ search: EventSettings, year: Int, month: Int, timeZone: String,
    todayMs: Int64, windowEndMs: Int64, lang: Lang = .da
) -> MonthAvailability {
    let (participants, quorum) = peopleForSearch(allParticipants, search.people)
    let todayMidnight = startOfDay(todayMs, timeZone)
    let first = wallTime(year, month, 1, 0, timeZone)
    let daysInMonth = localDate(addDays(startOfMonth(first, timeZone, 1), -1, timeZone), timeZone).day
    var days: [DayCell] = []
    for dayOfMonth in 1...daysInMonth {
        let midnight = wallTime(year, month, dayOfMonth, 0, timeZone)
        let day = dayAvailability(participants, search, midnight, timeZone, windowEndMs)
        days.append(
            DayCell(
                date: isoString(midnight), dayOfMonth: dayOfMonth, isPast: midnight < todayMidnight,
                freeCount: day?.free ?? 0, conditionalCount: day?.conditional ?? 0, excluded: day == nil))
    }
    return MonthAvailability(
        label: "\(capitalize(monthName(first, lang))) \(year)", days: days, total: participants.count,
        enough: quorum ?? participants.count)
}

private func dayAvailability(
    _ participants: [Participant], _ search: EventSettings, _ midnight: Int64, _ timeZone: String,
    _ windowEndMs: Int64
) -> (free: Int, conditional: Int)? {
    let nextMidnight = addDays(midnight, 1, timeZone)
    let dow = localDate(midnight, timeZone).dow
    switch search.kind {
    case .trip:
        guard let shape = search.shape else { return nil }
        let offset = (dow - shape.anchorDow + 7) % 7
        if offset >= shape.spanDays { return nil }
        let start = offset == 0 ? atHour(midnight, shape.startHour, timeZone) : midnight
        let end = offset == shape.spanDays - 1 ? atHour(midnight, shape.endHour, timeZone) : nextMidnight
        return end <= windowEndMs ? spanAvailability(participants, start, end) : (0, 0)
    case .vacation:
        return nextMidnight <= windowEndMs ? spanAvailability(participants, midnight, nextMidnight) : (0, 0)
    case .single:
        if let allowed = search.allowedDays, !allowed.contains(dow) { return nil }
        let durationMs = Int64(search.durationMinutes ?? 0) * 60_000
        if let window = search.startWindow {
            return freeSomewhere(
                participants, atHour(midnight, window.from / 60, timeZone),
                atHour(midnight, window.to / 60, timeZone) + durationMs, durationMs)
        }
        if search.anyTime == true {
            return freeSomewhere(
                participants, atHour(midnight, anyTimeEarliestHour, timeZone),
                atHour(midnight, anyTimeLatestHour, timeZone), durationMs)
        }
        let start = atHour(midnight, search.startHour ?? 0, timeZone)
        return freeAt(participants, start, start + durationMs)
    }
}

private func freeAt(_ participants: [Participant], _ start: Int64, _ end: Int64) -> (free: Int, conditional: Int) {
    var counts = (free: 0, conditional: 0)
    for p in participants {
        let clashes = p.busy.filter { blockOverlaps($0, start, end) }
        if clashes.isEmpty {
            counts.free += 1
        } else if clashes.allSatisfy(isSkippable) {
            counts.conditional += 1
        }
    }
    return counts
}

private func freeSomewhere(_ participants: [Participant], _ start: Int64, _ end: Int64, _ durationMs: Int64) -> (
    free: Int, conditional: Int
) {
    var counts = (free: 0, conditional: 0)
    for p in participants {
        if longestGap(p.busy, start, end) >= durationMs {
            counts.free += 1
        } else if longestGap(p.busy.filter { !isSkippable($0) }, start, end) >= durationMs {
            counts.conditional += 1
        }
    }
    return counts
}

private func longestGap(_ busy: [BusyInterval], _ start: Int64, _ end: Int64) -> Int64 {
    let clashes = busy.compactMap(blockRange).filter { $0.start < end && $0.end > start }.sorted {
        $0.start < $1.start
    }
    var cursor = start
    var longest: Int64 = 0
    for iv in clashes {
        longest = max(longest, iv.start - cursor)
        cursor = max(cursor, iv.end)
    }
    return max(longest, end - cursor)
}
