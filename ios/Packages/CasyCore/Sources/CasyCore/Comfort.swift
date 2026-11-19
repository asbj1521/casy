// How well a date suits the people going, translated from src/lib/
// eventImpact.ts and dateComfort.ts (#282): what an event causes on a date
// (a late night), and a rater that puts a cost on each date from everyone's
// own day around it and the date itself. Lower is better. Kept equal to the
// TypeScript by the parity fixtures (comfort.cases.ts).

import Foundation

/// What an event can cause, in the labels' words (#112), in this order.
public let impactEffects = ["lateNight", "alcohol", "travel", "exercise"]
/// From this hour a meeting ends late (earlyMorning.ts's LATE_FROM_HOUR).
private let lateFromHour: Double = 23
/// A meeting the AI says runs late does from this hour.
private let runsLateFromHour: Double = 21

/// What a date of an event is likely to cause, its own late night included.
public struct DateImpact: Codable, Sendable, Equatable {
    public var profiled: Bool
    public var effects: [String]
    public var strain: String?
    public var recoveryDays: Int
    public var outdoors: Bool
    public var daylight: Bool
    public var start: Int64
    public var end: Int64
}

public func impactOn(_ profile: EventImpact?, start: String, end: String, _ settings: EventSettings, _ timeZone: String)
    -> DateImpact
{
    let s = parseInstant(start) ?? 0
    let e = parseInstant(end) ?? 0
    var effects = Set(profile?.effects ?? [])
    if settings.kind == .single {
        let endsLate = e >= atHour(s, lateFromHour, timeZone)
        let runsIntoNight = profile?.runsLate == true && e >= atHour(s, runsLateFromHour, timeZone)
        if endsLate || runsIntoNight { effects.insert("lateNight") }
    }
    return DateImpact(
        profiled: profile != nil, effects: impactEffects.filter(effects.contains), strain: profile?.strain,
        recoveryDays: profile?.recoveryDays ?? 0, outdoors: profile?.outdoors ?? false,
        daylight: profile?.daylight ?? false, start: s, end: e)
}

// MARK: - Comfort

public let comfortBig: Double = 10
public let comfortMedium: Double = 4
public let comfortSmall: Double = 1

private let roomMinutes: Double = 30
private let roomAfterWorkMinutes: Double = 45
private let afterWeight = 0.6
private let lateEveningHour: Double = 22
private let earlyMorningHour: Double = 9
private let heavyNightFactor = 1.5
private let neverWeight = 1.5
private let freeWeeks: Double = 2
private let perWeek = comfortSmall / 2
private let hourMs: Int64 = 3_600_000
private let dayMs: Int64 = 24 * hourMs
private let weekMs: Int64 = 7 * dayMs
private let maxDaysPerBlock: Int64 = 62
private let latitude = 55.68
private let longitude = 12.57

/// One cost on a date: whose it is (none: the date's own, everyone's).
public struct Penalty: Codable, Sendable, Equatable {
    public var rule: String
    public var points: Double
    public var who: String?
}

public struct Comfort: Codable, Sendable, Equatable {
    /// Lower is better.
    public var cost: Double
    public var penalties: [Penalty]
}

private struct ComfortBlock {
    var start: Int64
    var end: Int64
    var weight: Double
    var work: Bool
    var never: Bool
}

/// The local date as days since 1970, as the web's Date.UTC(y, m, d) / DAY.
private func dayNumber(_ ms: Int64, _ timeZone: String) -> Int64 {
    let d = localDate(ms, timeZone)
    return daysFromCivil(year: Int64(d.year), month: Int64(d.month + 1), day: Int64(d.day))
}

private func utcMidnight(_ year: Int, _ month: Int, _ day: Int) -> Int64 {
    daysFromCivil(year: Int64(year), month: Int64(month + 1), day: Int64(day)) * dayMs
}

private func closeness(_ gapMs: Int64, _ wantedMinutes: Double) -> Double {
    max(0, 1 - Double(gapMs) / (wantedMinutes * 60_000))
}

private func fileByDay(_ busy: [BusyInterval], _ timeZone: String) -> [Int64: [ComfortBlock]] {
    var byDay: [Int64: [ComfortBlock]] = [:]
    for b in busy {
        if b.holiday == true || b.priority == .skip { continue }
        guard let start = cachedInstant(b.start), let end = cachedInstant(b.end), end > start else { continue }
        let block = ComfortBlock(
            start: start, end: end, weight: b.priority == .never ? neverWeight : 1,
            work: b.category == .work || b.category == .school, never: b.priority == .never)
        let first = dayNumber(start, timeZone)
        let last = min(dayNumber(end - 1, timeZone), first + maxDaysPerBlock)
        var d = first
        while d <= last {
            byDay[d, default: []].append(block)
            d += 1
        }
    }
    return byDay
}

/// Sunset in Copenhagen on a local day (NOAA's approximation, within a few minutes).
public func sunset(_ midnight: Int64, _ timeZone: String) -> Int64 {
    let d = localDate(midnight, timeZone)
    let dayOfYear = Double((utcMidnight(d.year, d.month, d.day) - utcMidnight(d.year, 0, 1)) / dayMs) + 1
    let g = ((2 * Double.pi) / 365) * (dayOfYear - 1 + 0.5)
    let eqTime =
        229.18
        * (0.000075 + 0.001868 * cos(g) - 0.032077 * sin(g) - 0.014615 * cos(2 * g) - 0.040849 * sin(2 * g))
    let decl =
        0.006918 - 0.399912 * cos(g) + 0.070257 * sin(g) - 0.006758 * cos(2 * g) + 0.000907 * sin(2 * g)
        - 0.002697 * cos(3 * g) + 0.00148 * sin(3 * g)
    let lat = (latitude * Double.pi) / 180
    let cosHa = cos((90.833 * Double.pi) / 180) / (cos(lat) * cos(decl)) - tan(lat) * tan(decl)
    let ha = (acos(min(1, max(-1, cosHa))) * 180) / Double.pi
    let minutesUtc = 720 - 4 * (longitude - ha) - eqTime
    return utcMidnight(d.year, d.month, d.day) + Int64((minutesUtc * 60_000).rounded(.towardZero))
}

private func fromEaster(_ year: Int, _ month: Int, _ day: Int) -> Int64 {
    let easter = easterSunday(year)
    return (utcMidnight(year, month, day) - utcMidnight(year, easter.month, easter.day)) / dayMs
}

/// Days kept for family or travel: BIG, MEDIUM or 0.
private func familyDay(_ date: LocalDate, endsEvening: Bool) -> Double {
    let (year, month, day) = (date.year, date.month, date.day)
    if month == 11 && day == 31 { return comfortBig }
    if month == 11 && [22, 27, 28, 29, 30].contains(day) { return comfortMedium }
    if month == 0 && day == 1 { return comfortMedium }
    if [-3, -2, -1, 0, 1, 39, 40, 48, 49, 50].contains(fromEaster(year, month, day)) { return comfortMedium }
    // Mother's Day, the second Sunday in May.
    let may1 = Int((daysFromCivil(year: Int64(year), month: 5, day: 1) + 4) % 7 + 7) % 7
    if month == 4 && day == 1 + ((7 - may1) % 7) + 7 { return comfortMedium }
    if month == 5 && day == 5 { return comfortMedium }
    if month == 5 && day == 23 && endsEvening { return comfortMedium }
    return 0
}

private func overLongWeekend(_ start: Int64, _ end: Int64, _ timeZone: String) -> Bool {
    var d = startOfDay(start, timeZone)
    while d < end {
        let l = localDate(d, timeZone)
        if [39, 49].contains(fromEaster(l.year, l.month, l.day)) { return true }
        d = addDays(d, 1, timeZone)
    }
    return false
}

/// A rater for the dates of one search: everyone's busy times filed by day
/// once. `score` is the server's match score (#119), if there is one.
public func comfortRater(
    participants: [Participant], settings: EventSettings, profile: EventImpact?, timeZone: String, now: Int64
) -> (_ start: String, _ end: String, _ score: Double?) -> Comfort {
    let people = peopleForSearch(participants, settings.people).searched.map {
        (id: $0.profileId, days: fileByDay($0.busy, timeZone))
    }
    let meeting = settings.kind == .single

    return { slotStart, slotEnd, score in
        let start = parseInstant(slotStart) ?? 0
        let end = parseInstant(slotEnd) ?? 0
        let startDate = localDate(start, timeZone)
        let impact = impactOn(profile, start: slotStart, end: slotEnd, settings, timeZone)
        let heavyNight = impact.effects.contains("lateNight") || impact.effects.contains("alcohol")
        var penalties: [Penalty] = []
        func add(_ rule: String, _ points: Double, _ who: String? = nil) {
            if points != 0 { penalties.append(Penalty(rule: rule, points: points, who: who)) }
        }

        if meeting {
            if heavyNight { add("schoolNight", startDate.dow <= 4 ? comfortMedium : -2 * comfortSmall) }
            if impact.daylight && end > sunset(startOfDay(start, timeZone), timeZone) { add("afterDark", comfortBig) }
            add("dayOfYear", familyDay(startDate, endsEvening: end > atHour(start, 18, timeZone)))
        } else if overLongWeekend(start, end, timeZone) {
            add("dayOfYear", -comfortMedium)
        }
        let lead = start - now
        if lead >= 0 {
            let (big, medium) = meeting ? (dayMs, 2 * dayMs) : (weekMs, 2 * weekMs)
            add("notice", lead < big ? comfortBig : lead < medium ? comfortMedium : 0)
            add("farAhead", max(0, Double(lead) / Double(weekMs) - freeWeeks) * perWeek)
        }

        if meeting {
            let morning =
                dayNumber(end, timeZone) == dayNumber(start, timeZone)
                ? addDays(start, 1, timeZone) : startOfDay(end, timeZone)
            let wake = atHour(morning, earlyMorningHour, timeZone)
            let endsLate = end >= atHour(start, lateEveningHour, timeZone)
            for person in people {
                var before: (gap: Int64, block: ComfortBlock)?
                for b in person.days[dayNumber(start, timeZone)] ?? [] where b.end <= start {
                    let gap = start - b.end
                    if before == nil || gap < before!.gap || (gap == before!.gap && b.weight > before!.block.weight) {
                        before = (gap, b)
                    }
                }
                var after: (gap: Int64, block: ComfortBlock)?
                let endDay = addDays(end - 1, 1, timeZone)
                for b in person.days[dayNumber(end - 1, timeZone)] ?? [] where b.start >= end && b.start < endDay {
                    let gap = b.start - end
                    if after == nil || gap < after!.gap || (gap == after!.gap && b.weight > after!.block.weight) {
                        after = (gap, b)
                    }
                }
                let tightBefore = before.map {
                    closeness($0.gap, $0.block.work ? roomAfterWorkMinutes : roomMinutes)
                } ?? 0
                let tightAfter = after.map { closeness($0.gap, roomMinutes) } ?? 0
                add("tightBefore", comfortMedium * tightBefore * (before?.block.weight ?? 1), person.id)
                add("tightAfter", comfortMedium * afterWeight * tightAfter * (after?.block.weight ?? 1), person.id)
                add("sandwiched", comfortMedium * min(tightBefore, tightAfter), person.id)
                if endsLate {
                    let early = (person.days[dayNumber(morning, timeZone)] ?? []).contains {
                        $0.start >= end && $0.start < wake && ($0.work || $0.never)
                    }
                    if early {
                        add("earlyAfterLate", comfortBig * (heavyNight ? heavyNightFactor : 1), person.id)
                    }
                }
            }
        }

        let shared = penalties.filter { $0.who == nil }.reduce(0) { $0 + $1.points }
        let ids = people.isEmpty ? [""] : people.map(\.id)
        let totals = ids.map { id in shared + penalties.filter { $0.who == id }.reduce(0) { $0 + $1.points } }
        let fromScore = score.map { ((100 - $0) / 100) * Double(people.count) * comfortBig } ?? 0
        return Comfort(
            cost: totals.reduce(0, +) + (totals.max() ?? 0) + fromScore, penalties: penalties)
    }
}
