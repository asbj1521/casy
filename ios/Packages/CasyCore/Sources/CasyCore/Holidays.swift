// Danish holidays and the times of year nobody is free:
// src/lib/danishHolidays.ts, holidayBlocks.ts and newYear.ts's date check.

public enum HolidayKind: String, Codable, Sendable {
    case `public`, observed
}

public struct Holiday: Codable, Sendable, Equatable {
    /// Midnight at the start of the day, epoch ms.
    public var date: Int64
    public var key: String
    public var name: String
    public var englishName: String
    public var kind: HolidayKind
}

/// Easter Sunday as a calendar date, `month` 0-based (Meeus/Jones/Butcher).
public func easterSunday(_ year: Int) -> (month: Int, day: Int) {
    let a = year % 19
    let b = year / 100
    let c = year % 100
    let d = b / 4
    let e = b % 4
    let f = (b + 8) / 25
    let g = (b - f + 1) / 3
    let h = (19 * a + b - d - g + 15) % 30
    let i = c / 4
    let k = c % 4
    let l = (32 + 2 * e + 2 * i - h - k) % 7
    let m = (a + 11 * h + 22 * l) / 451
    let month = (h + l - 7 * m + 114) / 31
    let day = (h + l - 7 * m + 114) % 31 + 1
    return (month - 1, day)
}

private let lastStoreBededagYear = 2023

/// All Danish holidays in `year`, sorted by date, each at midnight in `timeZone`.
public func danishHolidays(_ year: Int, _ timeZone: String) -> [Holiday] {
    let easter = easterSunday(year)
    func date(_ month: Int, _ day: Int) -> (month: Int, day: Int) {
        let d = localDate(calendarDayMilliseconds(year, month, day), "UTC")
        return (d.month, d.day)
    }
    func afterEaster(_ days: Int) -> (month: Int, day: Int) {
        date(easter.month, easter.day + days)
    }

    var rules: [((month: Int, day: Int), String, String, HolidayKind)] = [
        (date(0, 1), "Nytårsdag", "New Year's Day", .public),
        (afterEaster(-3), "Skærtorsdag", "Maundy Thursday", .public),
        (afterEaster(-2), "Langfredag", "Good Friday", .public),
        (afterEaster(0), "Påskedag", "Easter Sunday", .public),
        (afterEaster(1), "2. påskedag", "Easter Monday", .public),
        (afterEaster(39), "Kristi Himmelfartsdag", "Ascension Day", .public),
        (afterEaster(49), "Pinsedag", "Whit Sunday", .public),
        (afterEaster(50), "2. pinsedag", "Whit Monday", .public),
        (date(5, 5), "Grundlovsdag", "Constitution Day", .observed),
        (date(11, 24), "Juleaften", "Christmas Eve", .observed),
        (date(11, 25), "Juledag", "Christmas Day", .public),
        (date(11, 26), "2. juledag", "Boxing Day", .public),
        (date(11, 31), "Nytårsaften", "New Year's Eve", .observed),
    ]
    if year <= lastStoreBededagYear {
        rules.append((afterEaster(26), "Store bededag", "Great Prayer Day", .public))
    }

    func two(_ n: Int) -> String { n < 10 ? "0\(n)" : "\(n)" }
    let holidays = rules.map { rule -> Holiday in
        let (when, name, englishName, kind) = rule
        return Holiday(
            date: wallTime(year, when.month, when.day, 0, timeZone),
            key: "\(year)-\(two(when.month + 1))-\(two(when.day))",
            name: name,
            englishName: englishName,
            kind: kind
        )
    }
    // Pinsedag can fall on Grundlovsdag: ties keep the order above, as in TypeScript.
    return stableSorted(holidays) { $0.date < $1.date }
}

private func block(_ start: Int64, _ end: Int64) -> BusyInterval {
    BusyInterval(start: isoString(start), end: isoString(end), priority: .never, holiday: true)
}

/// Each year's blocks: its Christmas, and the New Year it ends with.
public func holidayBlocks(_ years: [Int], _ timeZone: String) -> [BusyInterval] {
    years.flatMap { y in
        [
            block(wallTime(y, 11, 23, 0, timeZone), wallTime(y, 11, 27, 0, timeZone)),
            block(wallTime(y, 11, 31, 18, timeZone), wallTime(y + 1, 0, 1, 12, timeZone)),
        ]
    }
}

/// `participants` with the holiday blocks added to everyone's busy time.
public func withHolidayBlocks(
    _ participants: [Participant],
    _ timeZone: String,
    now: Int64
) -> [Participant] {
    let year = localDate(now, timeZone).year
    let blocks = holidayBlocks([year - 1, year, year + 1], timeZone)
    return participants.map { p in
        var person = p
        person.busy += blocks
        return person
    }
}

/// Whether an instant falls on 1 January in `timeZone`.
public func onNewYearsDay(_ iso: String, _ timeZone: String) -> Bool {
    guard let ms = parseInstant(iso) else { return false }
    let d = localDate(ms, timeZone)
    return d.month == 0 && d.day == 1
}

/// A sort that keeps equal items in their order, as JavaScript's does.
func stableSorted<T>(_ items: [T], by before: (T, T) -> Bool) -> [T] {
    items.enumerated()
        .sorted { a, b in
            if before(a.element, b.element) { return true }
            if before(b.element, a.element) { return false }
            return a.offset < b.offset
        }
        .map(\.element)
}
