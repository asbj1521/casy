import Foundation
import Testing

@testable import CasyCore

// Replays what Vitest wrote (src/lib/parity) for every module but zone, which
// has its own: the Swift must give the TypeScript's answers. An answer's
// missing key and its null are the same thing.

enum JSONValue: Codable, Equatable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() {
            self = .null
        } else if let v = try? c.decode(Bool.self) {
            self = .bool(v)
        } else if let v = try? c.decode(Double.self) {
            self = .number(v)
        } else if let v = try? c.decode(String.self) {
            self = .string(v)
        } else if let v = try? c.decode([JSONValue].self) {
            self = .array(v)
        } else {
            self = .object(try c.decode([String: JSONValue].self))
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .null: try c.encodeNil()
        case .bool(let v): try c.encode(v)
        case .number(let v): try c.encode(v)
        case .string(let v): try c.encode(v)
        case .array(let v): try c.encode(v)
        case .object(let v): try c.encode(v)
        }
    }

    var withoutNulls: JSONValue {
        switch self {
        case .array(let v): .array(v.map(\.withoutNulls))
        case .object(let v): .object(v.compactMapValues { $0 == .null ? nil : $0.withoutNulls })
        default: self
        }
    }

    subscript(key: String) -> JSONValue {
        if case .object(let v) = self { return v[key] ?? .null }
        return .null
    }

    var string: String? {
        if case .string(let v) = self { return v }
        return nil
    }

    var int: Int? {
        if case .number(let v) = self { return Int(v) }
        return nil
    }

    var ms: Int64? {
        if case .number(let v) = self { return Int64(v) }
        return nil
    }

    func decoded<T: Decodable>(_ type: T.Type = T.self) throws -> T {
        try JSONDecoder().decode(T.self, from: JSONEncoder().encode(self))
    }
}

func json<T: Encodable>(_ value: T) throws -> JSONValue {
    try JSONDecoder().decode(JSONValue.self, from: JSONEncoder().encode(value))
}

private struct Item: Decodable {
    struct Input: Decodable {
        var fn: String
        var args: JSONValue
    }
    var name: String
    var input: Input
    var output: JSONValue
}

private func check(
    _ module: String,
    atLeast minimum: Int,
    _ run: (String, JSONValue) throws -> JSONValue
) throws {
    let url = try #require(
        Bundle.module.url(forResource: module, withExtension: "json", subdirectory: "Parity"))
    let items = try JSONDecoder().decode([Item].self, from: Data(contentsOf: url))
    #expect(items.count >= minimum)
    for item in items {
        let answer = try run(item.input.fn, item.input.args)
        #expect(answer.withoutNulls == item.output.withoutNulls, "\(item.name)")
    }
}

private func lang(_ a: JSONValue) throws -> Lang { try a["lang"].decoded() }
private func text(_ a: JSONValue, _ key: String) throws -> String {
    try #require(a[key].string)
}
private func milliseconds(_ a: JSONValue, _ key: String = "ms") throws -> Int64 {
    try #require(a[key].ms)
}
private func unknown(_ fn: String) -> JSONValue {
    Issue.record("A case for a function this test doesn't know: \(fn)")
    return .null
}

private let headlineWords = HeadlineWords(
    timeRange: { "RANGE \($0) \($1)" },
    tripTimes: { "TRIP \($0) \($1)" },
    days: { "DAYS \($0)" }
)

@Test func formatGivesTheTypeScriptAnswers() throws {
    try check("format", atLeast: 1500) { fn, a in
        switch fn {
        case "dayLabel": return try json(dayLabel(try milliseconds(a), try lang(a)))
        case "monthName": return try json(monthName(try milliseconds(a), try lang(a)))
        case "monthShortName": return try json(monthShortName(try milliseconds(a), try lang(a)))
        case "weekdayName": return try json(weekdayName(try milliseconds(a), try lang(a)))
        case "weekdayShortName":
            return try json(weekdayShortName(try milliseconds(a), try lang(a)))
        case "formatMonthYear": return try json(formatMonthYear(try text(a, "iso"), try lang(a)))
        case "formatDate":
            return try json(formatDate(try text(a, "iso"), try lang(a), try text(a, "timeZone")))
        case "formatTime": return try json(formatTime(try text(a, "iso"), try text(a, "timeZone")))
        case "formatLongDate": return try json(formatLongDate(try text(a, "iso"), try lang(a)))
        case "formatDaySpan":
            return try json(formatDaySpan(try text(a, "start"), try text(a, "end"), try lang(a)))
        case "formatLongSpanLines":
            return try json(
                formatLongSpanLines(try text(a, "start"), try text(a, "end"), try lang(a)))
        case "formatLongSpan":
            return try json(formatLongSpan(try text(a, "start"), try text(a, "end"), try lang(a)))
        case "formatEventDate":
            return try json(
                formatEventDate(
                    try a["kind"].decoded(), start: try text(a, "start"), end: try text(a, "end"),
                    try lang(a)))
        case "formatHeadline":
            return try json(
                formatHeadline(
                    try a["kind"].decoded(), vacationDays: try #require(a["days"].int),
                    start: try text(a, "start"), end: try text(a, "end"), try lang(a),
                    headlineWords))
        case "formatCountdown": return try json(formatCountdown(try milliseconds(a)))
        case "formatClockMinutes":
            return try json(formatClockMinutes(try #require(a["minutes"].int)))
        case "capitalize": return try json(capitalize(try text(a, "text")))
        case "nameList": return try json(nameList(try a["names"].decoded(), try lang(a)))
        default: return unknown(fn)
        }
    }
}

@Test func holidaysGiveTheTypeScriptAnswers() throws {
    try check("holidays", atLeast: 250) { fn, a in
        switch fn {
        case "easterSunday":
            let e = easterSunday(try #require(a["year"].int))
            return .object(["month": .number(Double(e.month)), "day": .number(Double(e.day))])
        case "danishHolidays":
            return try json(danishHolidays(try #require(a["year"].int), try text(a, "timeZone")))
        case "holidayBlocks":
            return try json(holidayBlocks(try a["years"].decoded(), try text(a, "timeZone")))
        case "withHolidayBlocks":
            return try json(
                withHolidayBlocks(
                    try a["participants"].decoded(), try text(a, "timeZone"),
                    now: try milliseconds(a, "now")))
        case "onNewYearsDay":
            return try json(onNewYearsDay(try text(a, "iso"), try text(a, "timeZone")))
        default: return unknown(fn)
        }
    }
}

private let periodWords = PeriodWords(
    any: "ANY",
    one: { "ONE \($0)" },
    range: { "RANGE \($0)|\($1)" },
    day: { "DAY \($0)" },
    until: { "UNTIL \($0)" }
)

@Test func periodsGiveTheTypeScriptAnswers() throws {
    try check("period", atLeast: 300) { fn, a in
        switch fn {
        case "periodText":
            let value: Period? = a["value"] == .null ? nil : try a["value"].decoded()
            return try json(
                periodText(value, try lang(a), periodWords, now: try milliseconds(a, "now")))
        case "yourTime":
            let answer = yourTime(
                try a["kind"].decoded(), start: try text(a, "start"), end: try text(a, "end"),
                try lang(a), viewerZone: try text(a, "viewerZone"))
            return try answer.map { try json($0) } ?? .null
        default: return unknown(fn)
        }
    }
}

@Test func phoneBusyGivesTheTypeScriptAnswers() throws {
    try check("phoneBusy", atLeast: 200) { fn, a in
        switch fn {
        case "phoneWindow": return try json(phoneWindow(try milliseconds(a, "now")))
        case "busySpan":
            return try busySpan(try a["event"].decoded()).map { try json($0) } ?? .null
        case "phoneBusy":
            return try json(phoneBusy(try a["read"].decoded(), try a["window"].decoded()))
        default: return unknown(fn)
        }
    }
}

private func ids(_ events: [SuggestedEvent]) -> JSONValue { .array(events.map { .string($0.id) }) }

private func staged(_ list: [StagedEvent]) -> JSONValue {
    .array(
        list.map {
            .object(["stage": .string($0.stage.rawValue), "id": .string($0.event.id)])
        })
}

private func idOrNull(_ date: CandidateDate?) -> JSONValue { date.map { .string($0.id) } ?? .null }

@Test func eventsGiveTheTypeScriptAnswers() throws {
    try check("events", atLeast: 200) { fn, a in
        let now = try milliseconds(a, "now")
        switch fn {
        case "needsYourAnswer":
            return try json(needsYourAnswer(try a["event"].decoded(), now: now))
        case "vote":
            let e: SuggestedEvent = try a["event"].decoded()
            return .object([
                "upcoming": .array(upcomingDates(e, now: now).map { .string($0.id) }),
                "firstUnanswered": .number(Double(firstUnanswered(e, now: now))),
                "allAnswered": .bool(allAnswered(e, now: now)),
                "leader": idOrNull(leader(e, now: now)),
                "bestPick": idOrNull(bestPick(e, now: now)),
                "stage": .string(voteStage(e, now: now).rawValue),
                "stillToAnswer": try json(stillToAnswer(e, now: now)),
                "needsYourAnswer": .bool(needsYourAnswer(e, now: now)),
                "tallies": .array(
                    try e.candidates.map { c in
                        .object([
                            "all": try json(tally(c, e)),
                            "required": try json(tally(c, e, required: true)),
                        ])
                    }),
            ])
        case "lists":
            let events: [SuggestedEvent] = try a["events"].decoded()
            let sections = sectionEvents(events, now: now)
            let groups = phoneEventGroups(events, now: now)
            return .object([
                "toSwipe": ids(sections.toSwipe),
                "voting": ids(sections.voting),
                "scheduled": ids(sections.scheduled),
                "closed": ids(sections.closed),
                "answer": staged(groups.answer),
                "coming": staged(groups.coming),
                "past": staged(groups.past),
            ])
        default: return unknown(fn)
        }
    }
}

@Test func pictureCropGivesTheTypeScriptAnswers() throws {
    try check("pictureCrop", atLeast: 500) { fn, a in
        func number(_ key: String) throws -> Double { try a[key].decoded() }
        switch fn {
        case "centredSquare":
            return try json(centredSquare(try number("width"), try number("height")))
        case "moveSquare":
            return try json(
                moveSquare(
                    try a["square"].decoded(), dx: try number("dx"), dy: try number("dy"),
                    frame: try number("frame"), width: try number("width"),
                    height: try number("height")))
        case "zoomSquare":
            return try json(
                zoomSquare(
                    try a["square"].decoded(), factor: try number("factor"), x: try number("x"),
                    y: try number("y"), frame: try number("frame"), width: try number("width"),
                    height: try number("height")))
        default: return unknown(fn)
        }
    }
}

private struct SpanAnswer: Encodable {
    var top: Double
    var height: Double
}

@Test func calendarDayGivesTheTypeScriptAnswers() throws {
    try check("calendarDay", atLeast: 300) { fn, a in
        switch fn {
        case "segmentByDay":
            return try json(
                segmentByDay(
                    try a["blocks"].decoded(), from: try milliseconds(a, "from"), to: try milliseconds(a, "to"),
                    try text(a, "timeZone")))
        case "dayKey": return try json(dayKey(try milliseconds(a), try text(a, "timeZone")))
        case "calendarColors":
            return try json(calendarColors(try a["calendars"].decoded(), own: try a["own"].decoded()))
        case "phoneCalendarIds":
            return try json(phoneCalendarIds(try a["calendars"].decoded(), connectionId: try text(a, "connectionId")))
        case "withPhoneEvents":
            return try json(
                withPhoneEvents(
                    try a["blocks"].decoded(), try a["events"].decoded(), serverIdOf: try a["serverIdOf"].decoded(),
                    from: try milliseconds(a, "from"), to: try milliseconds(a, "to")))
        case "placeSpan":
            let span = placeSpan(
                try milliseconds(a, "start"), try milliseconds(a, "end"), midnight: try milliseconds(a, "midnight"),
                try text(a, "timeZone"))
            return try json(SpanAnswer(top: span.top, height: span.height))
        case "placeBlocks":
            let together: Double? = a["together"] == .null ? nil : try a["together"].decoded()
            return try json(
                placeBlocks(
                    try a["segments"].decoded(), midnight: try milliseconds(a, "midnight"), try text(a, "timeZone"),
                    minHeight: try a["minHeight"].decoded(), together: together))
        case "tint": return try json(tint(try text(a, "rgb"), dark: try a["dark"].decoded()))
        case "shade": return try json(shade(try text(a, "rgb"), dark: try a["dark"].decoded()))
        default: return unknown(fn)
        }
    }
}

@Test func calendarsGiveTheTypeScriptAnswers() throws {
    try check("calendars", atLeast: 400) { fn, a in
        switch fn {
        case "groupCalendarsByBrand": return try json(groupCalendarsByBrand(try a["calendars"].decoded()))
        case "groupVisibility": return try json(groupVisibility(try a["group"].decoded()))
        case "ownCategories": return try json(ownCategories(try a["calendars"].decoded()))
        case "unsortedCalendars":
            return try json(unsortedCalendars(try a["calendars"].decoded(), seen: Set(try a["seen"].decoded([String].self))))
        case "tourSteps":
            return try json(tourSteps(try a["calendars"].decoded(), seen: Set(try a["seen"].decoded([String].self))))
        case "categoryLabel":
            let words = ["work": "W", "school": "S", "personal": "P", "other": "O"]
            return try json(
                categoryLabel(
                    purpose: a["purpose"].string, categoryName: a["categoryName"].string,
                    categories: { words[$0] ?? $0 }, none: "none"))
        case "choiceOf": return try json(choiceOf(try a["calendar"].decoded()))
        case "changesFrom": return try json(changesFrom(try a["calendar"].decoded(), try a["choice"].decoded()))
        case "textOn": return try json(textOn(try text(a, "rgb")))
        case "syncedAgo":
            let ago = syncedAgo(a["iso"].string, now: try milliseconds(a, "now"))
            return try json(
                ago.map { ago -> String in
                    switch ago {
                    case .justNow: "now"
                    case .minutes(let n): "m\(n)"
                    case .hours(let n): "h\(n)"
                    case .days(let n): "d\(n)"
                    }
                })
        case "looksLikeAppSpecificPassword": return try json(looksLikeAppSpecificPassword(try text(a, "value")))
        case "hearSpeech":
            let heard: [String] = try a["heard"].decoded()
            let transcript = heard.reduce(Transcript()) { hearSpeech($0, $1) }
            return try json(["done": transcript.done, "current": transcript.current, "text": transcript.text])
        case "cityName":
            return try json(cityName(try text(a, "key"), legs: try a["legs"].decoded(), try lang(a)))
        case "dayOptions": return try json(dayOptions(try a["question"].decoded(), now: try milliseconds(a, "now")))
        case "stretchShape": return try json(stretchShape(try a["prime"].decoded(), appTimeZone))
        case "everyone": return try json(everyone(try a["names"].decoded(), try lang(a)))
        case "entryWhen": return try json(entryWhen(try a["entry"].decoded(), try lang(a)))
        case "holidaysInYearAhead":
            return try json(holidaysInYearAhead(try text(a, "timeZone"), now: try milliseconds(a, "now")))
        default: return unknown(fn)
        }
    }
}

@Test func monthGivesTheTypeScriptAnswers() throws {
    try check("month", atLeast: 350) { fn, a in
        switch fn {
        case "monthLayout":
            return try json(monthLayout(try #require(a["year"].int), try #require(a["month"].int), try text(a, "timeZone")))
        case "isoWeekNumber": return try json(isoWeekNumber(try milliseconds(a), try text(a, "timeZone")))
        case "layoutWeek":
            return try json(
                layoutWeek(
                    try a["items"].decoded(), days: try a["days"].decoded(), weekEnd: try milliseconds(a, "weekEnd"),
                    lanes: try #require(a["lanes"].int)))
        case "calendarItems":
            return try json(
                calendarItems(
                    try a["counted"].decoded(), names: try a["names"].decoded(), from: try milliseconds(a, "from"),
                    to: try milliseconds(a, "to"), try text(a, "timeZone"), try lang(a)))
        case "formatSegmentRange":
            let seg = DaySegment(
                calendarId: "a", start: try milliseconds(a, "start"), end: try milliseconds(a, "end"),
                allDay: a["allDay"] == .bool(true), continuesBefore: false, continuesAfter: false, details: nil)
            return try json(formatSegmentRange(seg, try text(a, "timeZone"), allDay: "Hele dagen"))
        case "formatDuration":
            return try json(formatDuration(try milliseconds(a, "start"), try milliseconds(a, "end"), hourUnit: "t"))
        default: return unknown(fn)
        }
    }
}

@Test func availabilityGivesTheTypeScriptAnswers() throws {
    try check("availability", atLeast: 500) { fn, a in
        switch fn {
        case "findMeetingSlot":
            return try json(findMeetingSlot(try a["search"].decoded()))
        case "findBestDaySpan":
            return try json(
                findBestDaySpan(
                    try a["participants"].decoded(), try #require(a["days"].int), try text(a, "searchStart"),
                    try text(a, "searchEnd"), try text(a, "timeZone")))
        case "findVacationSuggestions":
            return try json(
                findVacationSuggestions(
                    try a["participants"].decoded(), try #require(a["days"].int), try text(a, "searchStart"),
                    try text(a, "searchEnd"), try text(a, "timeZone")))
        case "findWeeklySpan":
            return try json(
                findWeeklySpan(
                    try a["participants"].decoded(), try a["shape"].decoded(), try text(a, "searchStart"),
                    try text(a, "searchEnd"), try text(a, "timeZone")))
        case "spanAvailability":
            let people: [Participant] = try a["participants"].decoded()
            let found = spanAvailability(people, try milliseconds(a, "start"), try milliseconds(a, "end"))
            return .object([
                "free": .number(Double(found.free)),
                "conditional": .number(Double(found.conditional)),
                "hard": try json(people.map { $0.busy.map(isHardBlock) }),
                "soft": try json(people.map { $0.busy.map(isSoftBlock) }),
            ])
        default:
            return unknown(fn)
        }
    }
}

private func dayList(_ label: DayListLabel) -> JSONValue {
    switch label {
    case .all: .object(["kind": .string("all")])
    case .weekdays: .object(["kind": .string("weekdays")])
    case .weekends: .object(["kind": .string("weekends")])
    case .list(let dows): .object(["kind": .string("list"), "dows": .array(dows.map { .number(Double($0)) })])
    }
}

@Test func eventSearchGivesTheTypeScriptAnswers() throws {
    let zone = "Europe/Copenhagen"
    try check("eventSearch", atLeast: 400) { fn, a in
        switch fn {
        case "findEventSlot":
            let people: [Participant] = try a["participants"].decoded()
            let search: EventSettings = try a["search"].decoded()
            let end = try text(a, "searchEnd")
            let found = findEventSlot(people, search, try text(a, "searchStart"), end, zone)
            let chosen = peopleForSearch(people, search.people)
            let count = try #require(a["count"].int)
            return .object([
                "found": try json(found),
                "people": .object([
                    "searched": try json(chosen.searched),
                    "quorum": chosen.quorum.map { .number(Double($0)) } ?? .null,
                ]),
                "title": .string(fallbackTitleId(search)),
                "later": try json(
                    found.slot.map {
                        laterSlots(people, search, afterStart: $0.start, count: count, searchEnd: end, zone)
                    } ?? []),
                "review": try json(
                    reviewAnswer(found, search, you: a["you"].string, acceptedStart: a["accepted"].string)),
            ])
        case "peopleFromChoice":
            return try json(
                peopleFromChoice(try a["members"].decoded(), try a["choice"].decoded(), meeting: a["meeting"] == .bool(true)))
        case "settings":
            let s: SchedulerSettings = try a["settings"].decoded()
            return .object([
                "search": try json(settingsToSearch(s)),
                "flex": flexOf(s).map { .number(Double($0)) } ?? .null,
                "days": dayList(describeDays(s.dows)),
            ])
        case "period":
            let p: Period? = try? a["period"].decoded()
            let window = periodWindow(p, today: "2026-10-07T08:00:00.000Z", limitEnd: monthIso(12), zone)
            return .object([
                "picked": try json(pickPeriodMonth(p, try text(a, "month"), zone)),
                "window": .object(["start": .string(window.start), "end": .string(window.end)]),
                "bounds": p.map { b in
                    let bounds = periodBounds(b, zone)
                    return .object(["from": .number(Double(bounds.from)), "to": .number(Double(bounds.to))])
                } ?? .null,
            ])
        case "flex":
            let around = flexAround(try a["window"].decoded())
            return .object([
                "around": .object(["startHour": .number(around.startHour), "startWindow": try json(around.startWindow)]),
                "own": try json(flexWindow(Double(try #require(a["hour"].int)), try #require(a["flex"].int))),
            ])
        case "daysUntil":
            return .number(Double(daysUntil(try text(a, "day"), try text(a, "today"))))
        default:
            return unknown(fn)
        }
    }
}

private func monthIso(_ n: Int) -> String {
    isoString(startOfMonth(parseInstant("2026-10-07T08:00:00.000Z")!, "Europe/Copenhagen", n))
}
