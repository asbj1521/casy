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
