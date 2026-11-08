// Calendar arithmetic in a named time zone: src/lib/zone.ts, kept equal to it
// by Tests/CasyCoreTests/Parity/zone.json.
//
// A "day" is local midnight to the next local midnight: 23 hours on the
// spring-forward Sunday, 25 on the fall-back one. Instants are epoch ms.
// Nothing here may read the device's own zone or calendar: the zone is always
// passed in, and the tests run in New York so a slip fails.

import Foundation
import Synchronization

/// The zone scheduling happens in until groups can have their own.
public let appTimeZone = "Europe/Copenhagen"

private let msPerHour = 3_600_000.0
private let msPerDay: Int64 = 86_400_000
/// Offset lookups are cached per quarter hour: no zone changes offset more often.
private let cacheBucketMs: Int64 = 900_000

/// A calendar date in a zone. `month` is 0-based and `dow` 0 = Sunday, as in TypeScript.
public struct LocalDate: Codable, Sendable, Equatable {
    public var year: Int
    public var month: Int
    public var day: Int
    public var dow: Int

    public init(year: Int, month: Int, day: Int, dow: Int) {
        self.year = year
        self.month = month
        self.day = day
        self.dow = dow
    }
}

private struct OffsetCache: ~Copyable {
    var zones: [String: TimeZone] = [:]
    var offsets: [String: [Int64: Int64]] = [:]
}

private let offsetCache = Mutex(OffsetCache())

private func floorDivide(_ a: Int64, _ b: Int64) -> Int64 {
    let quotient = a / b
    return (a % b != 0 && (a < 0) != (b < 0)) ? quotient - 1 : quotient
}

private func positiveModulo(_ a: Int64, _ b: Int64) -> Int64 {
    a - floorDivide(a, b) * b
}

/// Days since 1970-01-01 of a proleptic Gregorian date (month 1...12).
private func daysFromCivil(year: Int64, month: Int64, day: Int64) -> Int64 {
    let y = month <= 2 ? year - 1 : year
    let era = floorDivide(y, 400)
    let yearOfEra = y - era * 400
    let shiftedMonth = month > 2 ? month - 3 : month + 9
    let dayOfYear = (153 * shiftedMonth + 2) / 5 + day - 1
    let dayOfEra = yearOfEra * 365 + yearOfEra / 4 - yearOfEra / 100 + dayOfYear
    return era * 146_097 + dayOfEra - 719_468
}

/// The date of a day count from 1970-01-01 (month 1...12).
private func civilFromDays(_ days: Int64) -> (year: Int64, month: Int64, day: Int64) {
    let shifted = days + 719_468
    let era = floorDivide(shifted, 146_097)
    let dayOfEra = shifted - era * 146_097
    let yearOfEra =
        (dayOfEra - dayOfEra / 1460 + dayOfEra / 36_524 - dayOfEra / 146_096) / 365
    let dayOfYear = dayOfEra - (365 * yearOfEra + yearOfEra / 4 - yearOfEra / 100)
    let shiftedMonth = (5 * dayOfYear + 2) / 153
    let day = dayOfYear - (153 * shiftedMonth + 2) / 5 + 1
    let month = shiftedMonth < 10 ? shiftedMonth + 3 : shiftedMonth - 9
    return (yearOfEra + era * 400 + (month <= 2 ? 1 : 0), month, day)
}

/// JavaScript's `Date.UTC(year, month, day)`: a 0-based month, and out-of-range values roll over.
private func utcMilliseconds(year: Int, month: Int, day: Int) -> Int64 {
    let wholeYears = floorDivide(Int64(month), 12)
    let days = daysFromCivil(
        year: Int64(year) + wholeYears,
        month: positiveModulo(Int64(month), 12) + 1,
        day: 1
    )
    return (days + Int64(day) - 1) * msPerDay
}

/// Midnight UTC of a calendar date, the month 0-based and rolling over.
func calendarDayMilliseconds(_ year: Int, _ month: Int, _ day: Int) -> Int64 {
    utcMilliseconds(year: year, month: month, day: day)
}

/// JavaScript's `Math.round`: halves go up, also below zero.
private func roundedLikeJavaScript(_ value: Double) -> Int64 {
    let below = value.rounded(.down)
    return Int64(value - below >= 0.5 ? below + 1 : below)
}

/// How far local time in `timeZone` is ahead of UTC at instant `ms`, in ms.
public func offsetAt(_ ms: Int64, _ timeZone: String) -> Int64 {
    if timeZone == "UTC" { return 0 }
    let bucket = floorDivide(ms, cacheBucketMs)
    return offsetCache.withLock { cache in
        if let known = cache.offsets[timeZone]?[bucket] { return known }
        let zone: TimeZone
        if let cached = cache.zones[timeZone] {
            zone = cached
        } else if let found = TimeZone(identifier: timeZone) {
            zone = found
            cache.zones[timeZone] = found
        } else {
            // TypeScript throws here. Every caller passes a zone known to exist,
            // and a wrong hour beats the app going down in someone's hand.
            assertionFailure("Unknown time zone \(timeZone)")
            return 0
        }
        let instant = Date(timeIntervalSince1970: Double(bucket * cacheBucketMs) / 1000)
        let offset = Int64(zone.secondsFromGMT(for: instant)) * 1000
        cache.offsets[timeZone, default: [:]][bucket] = offset
        return offset
    }
}

/// The local calendar date (and weekday) of an instant.
public func localDate(_ ms: Int64, _ timeZone: String) -> LocalDate {
    let days = floorDivide(ms + offsetAt(ms, timeZone), msPerDay)
    let date = civilFromDays(days)
    return LocalDate(
        year: Int(date.year),
        month: Int(date.month) - 1,
        day: Int(date.day),
        dow: Int(positiveModulo(days + 4, 7))
    )
}

/// The instant a local wall-clock time happens. `month` is 0-based; out-of-range
/// days roll over, and `hours` may be fractional or past 24 (26 = 02:00 the next day).
public func wallTime(
    _ year: Int,
    _ month: Int,
    _ day: Int,
    _ hours: Double,
    _ timeZone: String
) -> Int64 {
    let asUtc =
        utcMilliseconds(year: year, month: month, day: day)
        + roundedLikeJavaScript(hours * msPerHour)
    // Guess with the offset at the wrong instant, then correct once with the
    // offset at the guess, as TypeScript does.
    let guess = asUtc - offsetAt(asUtc, timeZone)
    return asUtc - offsetAt(guess, timeZone)
}

/// Local midnight at the start of the day containing `ms`.
public func startOfDay(_ ms: Int64, _ timeZone: String) -> Int64 {
    let d = localDate(ms, timeZone)
    return wallTime(d.year, d.month, d.day, 0, timeZone)
}

/// Local midnight `n` days after the day containing `ms` (negative goes back).
public func addDays(_ ms: Int64, _ n: Int, _ timeZone: String) -> Int64 {
    let d = localDate(ms, timeZone)
    return wallTime(d.year, d.month, d.day + n, 0, timeZone)
}

/// The instant of local clock time `hours` on the day containing `ms`.
public func atHour(_ ms: Int64, _ hours: Double, _ timeZone: String) -> Int64 {
    let d = localDate(ms, timeZone)
    return wallTime(d.year, d.month, d.day, hours, timeZone)
}

/// Day of the week of `ms` in the zone (0 = Sunday ... 6 = Saturday).
public func dayOfWeek(_ ms: Int64, _ timeZone: String) -> Int {
    localDate(ms, timeZone).dow
}

/// Local midnight on the 1st of the month containing `ms`, moved `n` months.
public func startOfMonth(_ ms: Int64, _ timeZone: String, _ n: Int = 0) -> Int64 {
    let d = localDate(ms, timeZone)
    return wallTime(d.year, d.month + n, 1, 0, timeZone)
}

/// Whether two zones keep the same clock all year, judged in mid-winter and mid-summer.
public func sameClock(_ a: String, _ b: String, _ year: Int) -> Bool {
    if a == b { return true }
    return [0, 6].allSatisfy { month in
        let ms = utcMilliseconds(year: year, month: month, day: 15) + 12 * 3_600_000
        return offsetAt(ms, a) == offsetAt(ms, b)
    }
}

/// An instant as `Date.toISOString()` writes it: `2026-06-20T14:00:00.000Z`.
public func isoString(_ ms: Int64) -> String {
    let days = floorDivide(ms, msPerDay)
    let date = civilFromDays(days)
    let rest = positiveModulo(ms, msPerDay)
    let hour = rest / 3_600_000
    let minute = rest / 60_000 % 60
    let second = rest / 1000 % 60
    let milli = rest % 1000
    return String(
        format: "%04lld-%02lld-%02lldT%02lld:%02lld:%02lld.%03lldZ",
        date.year, date.month, date.day, hour, minute, second, milli
    )
}

/// An ISO 8601 instant as epoch ms, or nil if it isn't one. It must name its
/// offset (`Z` or `+02:00`); digits past the milliseconds are dropped, as
/// `Date.parse` does with what Postgres sends.
public func parseInstant(_ text: String) -> Int64? {
    let pattern =
        /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:\d{2})$/.asciiOnlyDigits()
    guard let m = text.wholeMatch(of: pattern),
        let year = Int(m.1), let month = Int(m.2), let day = Int(m.3),
        let hour = Int64(m.4), let minute = Int64(m.5),
        (1...12).contains(month), (1...31).contains(day), hour < 24, minute < 60
    else { return nil }
    let second = m.6.flatMap { Int64($0) } ?? 0
    guard second < 60 else { return nil }
    let fraction = m.7.map { String($0.prefix(3)).padding(toLength: 3, withPad: "0", startingAt: 0) }
    let milli = fraction.flatMap { Int64($0) } ?? 0
    var offset: Int64 = 0
    if m.8 != "Z" {
        let parts = m.8.dropFirst().split(separator: ":")
        guard parts.count == 2, let h = Int64(parts[0]), let min = Int64(parts[1]) else {
            return nil
        }
        offset = (h * 60 + min) * 60_000 * (m.8.first == "-" ? -1 : 1)
    }
    return utcMilliseconds(year: year, month: month - 1, day: day)
        + hour * 3_600_000 + minute * 60_000 + second * 1000 + milli - offset
}

/// The day containing an instant, named by its local midnight as an ISO
/// string, or nil if `iso` is no instant.
public func dayOf(_ iso: String, _ timeZone: String) -> String? {
    parseInstant(iso).map { isoString(startOfDay($0, timeZone)) }
}
