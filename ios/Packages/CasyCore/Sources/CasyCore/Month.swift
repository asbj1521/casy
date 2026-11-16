import Foundation

// My calendar's month view (#74, #104, #201): what monthGrid.ts,
// calendarOverview.ts's month layout and monthItems.ts work out, for the
// native home page. Kept equal to them by the parity fixtures (month.json).

/// A row of bars under a day's number, and the "+2" line under them, in points.
public let monthLanePoints: Double = 20
public let monthMorePoints: Double = 14
/// Rows of bars under a day's number.
public let monthLanes = 3

/// Something to show in the month: a busy block, a holiday, or a pencilled date.
public struct GridItem: Codable, Sendable, Equatable, Hashable {
    public var calendarId: String
    public var start: Int64
    public var end: Int64
    public var label: String
    /// Pencilled in (a vote's date): always placed first, so it always shows.
    public var pencil: Bool?
    /// Pencilled in and asking for an answer (a trip Casy found): it glows softly.
    public var pulse: Bool?
    /// Its length changes as Casy guesses: it glides to each new one.
    public var grow: Bool?

    public init(
        calendarId: String, start: Int64, end: Int64, label: String,
        pencil: Bool? = nil, pulse: Bool? = nil, grow: Bool? = nil
    ) {
        self.calendarId = calendarId
        self.start = start
        self.end = end
        self.label = label
        self.pencil = pencil
        self.pulse = pulse
        self.grow = grow
    }
}

/// One item placed in a week: its row, and the days (0 = Monday) it covers.
public struct PlacedItem: Codable, Sendable, Equatable {
    public var item: GridItem
    public var lane: Int
    public var from: Int
    public var to: Int
    /// It runs on from last week, or into next: drawn without that end rounded.
    public var continuesBefore: Bool
    public var continuesAfter: Bool
}

/// A week laid out: what is placed, and how many more each day has ("+2").
public struct WeekLayout: Codable, Sendable, Equatable {
    public var placed: [PlacedItem]
    public var hidden: [Int]
}

/// One week of the month as Apple Calendar lays it out (monthGrid.ts's
/// `layoutWeek`): the pencilled date first, then the longest, then the
/// earliest, each in the first row free for all its days. `days` are the
/// week's seven local midnights, Monday first; `weekEnd` the midnight after.
public func layoutWeek(_ items: [GridItem], days: [Int64], weekEnd: Int64, lanes: Int) -> WeekLayout {
    func column(_ t: Int64) -> Int {
        var c = 0
        while c < 6 && days[c + 1] <= t { c += 1 }
        return c
    }
    let inWeek = items
        .filter { $0.end > days[0] && $0.start < weekEnd }
        .map { item in
            PlacedItem(
                item: item, lane: 0,
                from: item.start <= days[0] ? 0 : column(item.start),
                to: item.end >= weekEnd ? 6 : column(item.end - 1),
                continuesBefore: item.start < days[0],
                continuesAfter: item.end > weekEnd)
        }
    let sorted = stableSorted(inWeek) { a, b in
        let pa = a.item.pencil == true ? 1 : 0
        let pb = b.item.pencil == true ? 1 : 0
        if pa != pb { return pa > pb }
        let la = a.to - a.from
        let lb = b.to - b.from
        if la != lb { return la > lb }
        return a.item.start < b.item.start
    }
    var taken = Array(repeating: Array(repeating: false, count: 7), count: lanes)
    var hidden = Array(repeating: 0, count: 7)
    var placed: [PlacedItem] = []
    for var p in sorted {
        let span = Array(p.from...p.to)
        guard let lane = taken.firstIndex(where: { row in span.allSatisfy { !row[$0] } }) else {
            for c in span { hidden[c] += 1 }
            continue
        }
        for c in span { taken[lane][c] = true }
        p.lane = lane
        placed.append(p)
    }
    return WeekLayout(placed: placed, hidden: hidden)
}

/// One day in a month's grid.
public struct MonthDay: Codable, Sendable, Equatable, Hashable {
    /// Local midnight, epoch ms.
    public var date: Int64
    public var dayOfMonth: Int
    /// In the month, rather than a neighbour's day filling the week.
    public var inMonth: Bool
}

/// A Monday-first month padded to whole weeks (4 to 6), with each week's number.
public struct MonthLayout: Codable, Sendable, Equatable {
    public var weeks: [[MonthDay]]
    public var weekNumbers: [Int]
}

/// The month `month` (0-based) of `year`, as calendarOverview.ts's `buildMonthLayout`.
public func monthLayout(_ year: Int, _ month: Int, _ timeZone: String) -> MonthLayout {
    let first = utcMilliseconds(year: year, month: month, day: 1)
    let offset = Int(positiveModulo(floorDivide(first, 86_400_000) + 3, 7))  // days since Monday
    let daysInMonth = localDate(utcMilliseconds(year: year, month: month + 1, day: 0), "UTC").day
    let rows = (offset + daysInMonth + 6) / 7
    var weeks: [[MonthDay]] = []
    for r in 0..<rows {
        weeks.append(
            (0..<7).map { c in
                let date = wallTime(year, month, 1 - offset + r * 7 + c, 0, timeZone)
                let local = localDate(date, timeZone)
                return MonthDay(date: date, dayOfMonth: local.day, inMonth: local.month == month)
            })
    }
    return MonthLayout(weeks: weeks, weekNumbers: weeks.map { isoWeekNumber($0[0].date, timeZone) })
}

/// The ISO week (1 to 53) of the day containing `ms`, as Denmark numbers them.
public func isoWeekNumber(_ ms: Int64, _ timeZone: String) -> Int {
    let local = localDate(ms, timeZone)
    let utc = utcMilliseconds(year: local.year, month: local.month, day: local.day)
    let mondayBased = (local.dow + 6) % 7
    let thursday = utc + Int64(3 - mondayBased) * 86_400_000
    let jan1 = utcMilliseconds(year: localDate(thursday, "UTC").year, month: 0, day: 1)
    return Int((thursday - jan1) / 86_400_000 / 7) + 1
}

/// What the month draws of your calendar (monthItems.ts's `calendarItems`):
/// the holidays inside the window, then every counted block, named by its own
/// title where the phone gave one, else by its calendar's name.
public func calendarItems(
    _ counted: [OverviewBlock], names: [String: String], from: Int64, to: Int64, _ timeZone: String,
    _ lang: Lang
) -> [GridItem] {
    let firstYear = localDate(from, timeZone).year
    let lastYear = localDate(to - 1, timeZone).year
    var items: [GridItem] = []
    for year in firstYear...max(firstYear, lastYear) {
        for h in danishHolidays(year, timeZone) where h.date >= from && h.date < to {
            items.append(
                GridItem(
                    calendarId: holidayCalendarId, start: h.date, end: addDays(h.date, 1, timeZone),
                    label: lang == .da ? h.name : h.englishName))
        }
    }
    for b in counted {
        guard let start = parseInstant(b.start), let end = parseInstant(b.end) else { continue }
        let title = b.details?.title ?? ""
        items.append(
            GridItem(calendarId: b.calendarId, start: start, end: end, label: title.isEmpty ? names[b.calendarId] ?? "" : title))
    }
    return items
}
