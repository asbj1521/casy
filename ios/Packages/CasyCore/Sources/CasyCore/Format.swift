// Dates and names as text: src/lib/format.ts, kept equal to it by
// Parity/format.json. The names are written out rather than asked of the
// system, whose wording ("Sep", "Sept") changes between iOS versions: the web's
// text is the reference. Every date shown is Danish time unless a zone is given.

public enum Lang: String, Codable, Sendable, CaseIterable {
    case da, en
}

/// How an event is shaped, which decides how its date is written.
public enum EventKind: String, Codable, Sendable, CaseIterable {
    case single, trip, vacation
}

private struct Names {
    let weekdays: [String]
    let weekdaysShort: [String]
    let months: [String]
    let monthsShort: [String]
}

private let danish = Names(
    weekdays: ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"],
    weekdaysShort: ["søn.", "man.", "tirs.", "ons.", "tors.", "fre.", "lør."],
    months: [
        "januar", "februar", "marts", "april", "maj", "juni", "juli", "august", "september",
        "oktober", "november", "december",
    ],
    monthsShort: [
        "jan.", "feb.", "mar.", "apr.", "maj", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.",
        "dec.",
    ]
)

private let english = Names(
    weekdays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    weekdaysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    months: [
        "January", "February", "March", "April", "May", "June", "July", "August", "September",
        "October", "November", "December",
    ],
    monthsShort: [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec",
    ]
)

private func names(_ lang: Lang) -> Names { lang == .da ? danish : english }

private func two(_ n: Int) -> String { n < 10 ? "0\(n)" : "\(n)" }

private func to(_ lang: Lang) -> String { lang == .da ? "til" : "to" }

/// "juni 2026" -> "Juni 2026".
public func capitalize(_ text: String) -> String {
    text.prefix(1).uppercased() + text.dropFirst()
}

/// A day in full, in Danish time: "tirsdag 3. november" / "Tuesday 3 November".
public func dayLabel(_ ms: Int64, _ lang: Lang) -> String {
    let d = localDate(ms, appTimeZone)
    let n = names(lang)
    return lang == .da
        ? "\(n.weekdays[d.dow]) \(d.day). \(n.months[d.month])"
        : "\(n.weekdays[d.dow]) \(d.day) \(n.months[d.month])"
}

/// "november", in lower case in Danish.
public func monthName(_ ms: Int64, _ lang: Lang) -> String {
    names(lang).months[localDate(ms, appTimeZone).month]
}

/// "nov." / "Nov".
public func monthShortName(_ ms: Int64, _ lang: Lang) -> String {
    names(lang).monthsShort[localDate(ms, appTimeZone).month]
}

/// "tirs." / "Tue".
public func weekdayShortName(_ ms: Int64, _ lang: Lang) -> String {
    names(lang).weekdaysShort[localDate(ms, appTimeZone).dow]
}

/// "tirsdag" / "Tuesday".
public func weekdayName(_ ms: Int64, _ lang: Lang) -> String {
    names(lang).weekdays[localDate(ms, appTimeZone).dow]
}

/// "Tue 23 Jun", or "tirs. 23. jun."; empty if `iso` is no instant.
public func formatDate(_ iso: String, _ lang: Lang, _ timeZone: String = appTimeZone) -> String {
    guard let ms = parseInstant(iso) else { return "" }
    let d = localDate(ms, timeZone)
    let n = names(lang)
    return lang == .da
        ? "\(n.weekdaysShort[d.dow]) \(d.day). \(n.monthsShort[d.month])"
        : "\(n.weekdaysShort[d.dow]) \(d.day) \(n.monthsShort[d.month])"
}

/// "16:00", in both languages; empty if `iso` is no instant.
public func formatTime(_ iso: String, _ timeZone: String = appTimeZone) -> String {
    guard let ms = parseInstant(iso) else { return "" }
    let local = ms + offsetAt(ms, timeZone)
    let minutes = Int(((local % 86_400_000) + 86_400_000) % 86_400_000 / 60_000)
    return "\(two(minutes / 60)):\(two(minutes % 60))"
}

/// Time left as a ticking clock: "2d 04:12:33", or "04:12:33" under a day; never below zero.
public func formatCountdown(_ ms: Int64) -> String {
    let total = max(0, ms < 0 ? 0 : Int(ms / 1000))
    let days = total / 86_400
    let clock = "\(two(total % 86_400 / 3600)):\(two(total % 3600 / 60)):\(two(total % 60))"
    return days > 0 ? "\(days)d \(clock)" : clock
}

/// Minutes after midnight as a clock time, "18:30"; past midnight wraps round.
public func formatClockMinutes(_ minutes: Int) -> String {
    let m = ((minutes % 1440) + 1440) % 1440
    return "\(two(m / 60)):\(two(m % 60))"
}

private func justBefore(_ iso: String) -> String {
    parseInstant(iso).map { isoString($0 - 1) } ?? ""
}

/// "Mon 5 Oct to Sun 11 Oct": `end` is the exclusive midnight after the span.
public func formatDaySpan(_ start: String, _ end: String, _ lang: Lang) -> String {
    "\(formatDate(start, lang)) \(to(lang)) \(formatDate(justBefore(end), lang))"
}

/// "Fredag 9. oktober" / "Friday 9 October"; empty if `iso` is no instant.
public func formatLongDate(_ iso: String, _ lang: Lang) -> String {
    guard let ms = parseInstant(iso) else { return "" }
    return capitalize(dayLabel(ms, lang))
}

/// A whole-day span's two ends, one a line, or a single line for one day.
public func formatLongSpanLines(_ start: String, _ end: String, _ lang: Lang) -> [String] {
    let first = formatLongDate(start, lang)
    let second = formatLongDate(justBefore(end), lang)
    if first == second { return [first] }
    let tail = lang == .da ? second.prefix(1).lowercased() + second.dropFirst() : second
    return ["\(first) \(to(lang))", tail]
}

/// "Fredag 9. oktober til søndag 11. oktober", or one day.
public func formatLongSpan(_ start: String, _ end: String, _ lang: Lang) -> String {
    formatLongSpanLines(start, end, lang).joined(separator: " ")
}

/// "Sep 2026": how long someone has had an account, or a group has existed.
public func formatMonthYear(_ iso: String, _ lang: Lang) -> String {
    guard let ms = parseInstant(iso) else { return "" }
    let d = localDate(ms, appTimeZone)
    return "\(names(lang).monthsShort[d.month]) \(d.year)"
}

/// A date as one line, in the words its kind uses.
public func formatEventDate(_ kind: EventKind, start: String, end: String, _ lang: Lang) -> String {
    switch kind {
    case .vacation:
        return formatDaySpan(start, end, lang)
    case .trip:
        return
            "\(formatDate(start, lang)) \(formatTime(start)) \(to(lang)) \(formatDate(end, lang)) \(formatTime(end))"
    case .single:
        return "\(formatDate(start, lang)) · \(formatTime(start))-\(formatTime(end))"
    }
}

/// The words a headline needs, from the String Catalog.
public struct HeadlineWords: Sendable {
    public var timeRange: @Sendable (String, String) -> String
    public var tripTimes: @Sendable (String, String) -> String
    public var days: @Sendable (Int) -> String

    public init(
        timeRange: @escaping @Sendable (String, String) -> String,
        tripTimes: @escaping @Sendable (String, String) -> String,
        days: @escaping @Sendable (Int) -> String
    ) {
        self.timeRange = timeRange
        self.tripTimes = tripTimes
        self.days = days
    }
}

public struct Headline: Codable, Sendable, Equatable {
    public var lines: [String]
    public var time: String
}

/// A date as the big answer shows it. `vacationDays` is read for a holiday only.
public func formatHeadline(
    _ kind: EventKind,
    vacationDays: Int,
    start: String,
    end: String,
    _ lang: Lang,
    _ words: HeadlineWords
) -> Headline {
    switch kind {
    case .vacation:
        return Headline(
            lines: formatLongSpanLines(start, end, lang),
            time: words.days(vacationDays)
        )
    case .trip:
        return Headline(
            lines: formatLongSpanLines(start, end, lang),
            time: words.tripTimes(formatTime(start), formatTime(end))
        )
    case .single:
        return Headline(
            lines: [formatLongDate(start, lang)],
            time: words.timeRange(formatTime(start), formatTime(end))
        )
    }
}

/// "Emilie", "Emilie and Tessa", or "Emilie, Tessa and 2 more".
public func nameList(_ names: [String], _ lang: Lang) -> String {
    let and = lang == .da ? "og" : "and"
    if names.count <= 1 { return names.first ?? "" }
    if names.count == 2 { return "\(names[0]) \(and) \(names[1])" }
    let more = lang == .da ? "\(names.count - 2) andre" : "\(names.count - 2) more"
    return "\(names[0]), \(names[1]) \(and) \(more)"
}

/// A day and month only, "5. november" / "5. nov." / "5 Nov".
func dayAndMonth(_ ms: Int64, _ lang: Lang, short: Bool) -> String {
    let d = localDate(ms, appTimeZone)
    let month = short ? names(lang).monthsShort[d.month] : names(lang).months[d.month]
    return lang == .da ? "\(d.day). \(month)" : "\(d.day) \(month)"
}
