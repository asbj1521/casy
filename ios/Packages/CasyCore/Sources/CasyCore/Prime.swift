// Tid til hinanden (#171), as its sheet shows a starred day (#200):
// primeDates.ts's PrimeDate and how its stretch is said. Finding them stays
// the page's until the home page is native.

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
