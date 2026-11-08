import Foundation
import Testing

@testable import CasyCore

// Replays what Vitest wrote (src/lib/parity): the Swift must give the
// TypeScript's answers, exactly.

private struct Arguments: Decodable {
    var ms: Int64?
    var timeZone: String?
    var year: Int?
    var month: Int?
    var day: Int?
    var hours: Double?
    var n: Int?
    var iso: String?
    var a: String?
    var b: String?
}

private enum Answer: Decodable, Equatable, CustomStringConvertible {
    case number(Int64)
    case flag(Bool)
    case text(String)
    case date(LocalDate)

    init(from decoder: Decoder) throws {
        let value = try decoder.singleValueContainer()
        if let flag = try? value.decode(Bool.self) {
            self = .flag(flag)
        } else if let number = try? value.decode(Int64.self) {
            self = .number(number)
        } else if let text = try? value.decode(String.self) {
            self = .text(text)
        } else {
            self = .date(try value.decode(LocalDate.self))
        }
    }

    var description: String {
        switch self {
        case .number(let v): "\(v)"
        case .flag(let v): "\(v)"
        case .text(let v): v
        case .date(let v): "\(v)"
        }
    }
}

private struct ZoneCase: Decodable {
    struct Input: Decodable {
        var fn: String
        var args: Arguments
    }
    var name: String
    var input: Input
    var output: Answer
}

private func zoneCases() throws -> [ZoneCase] {
    let url = try #require(Bundle.module.url(forResource: "zone", withExtension: "json", subdirectory: "Parity"))
    return try JSONDecoder().decode([ZoneCase].self, from: Data(contentsOf: url))
}

private func run(_ input: ZoneCase.Input) throws -> Answer {
    let a = input.args
    func zone() throws -> String { try #require(a.timeZone) }
    func ms() throws -> Int64 { try #require(a.ms) }
    switch input.fn {
    case "offsetAt":
        return .number(offsetAt(try ms(), try zone()))
    case "localDate":
        return .date(localDate(try ms(), try zone()))
    case "wallTime":
        return .number(
            wallTime(
                try #require(a.year), try #require(a.month), try #require(a.day),
                try #require(a.hours), try zone()))
    case "startOfDay":
        return .number(startOfDay(try ms(), try zone()))
    case "addDays":
        return .number(addDays(try ms(), try #require(a.n), try zone()))
    case "atHour":
        return .number(atHour(try ms(), try #require(a.hours), try zone()))
    case "dayOfWeek":
        return .number(Int64(dayOfWeek(try ms(), try zone())))
    case "startOfMonth":
        return .number(startOfMonth(try ms(), try zone(), a.n ?? 0))
    case "dayOf":
        let iso = try #require(a.iso)
        let timeZone = try zone()
        return .text(try #require(dayOf(iso, timeZone)))
    case "sameClock":
        return .flag(sameClock(try #require(a.a), try #require(a.b), try #require(a.year)))
    default:
        Issue.record("A case for a function this test doesn't know: \(input.fn)")
        return .flag(false)
    }
}

@Test func theFixturesAreThere() throws {
    #expect(try zoneCases().count > 500)
}

@Test func zoneGivesTheTypeScriptAnswers() throws {
    for item in try zoneCases() {
        let answer = try run(item.input)
        #expect(answer == item.output, "\(item.name)")
    }
}
