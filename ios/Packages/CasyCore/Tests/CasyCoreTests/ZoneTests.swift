import Foundation
import Testing

@testable import CasyCore

// What the generated cases don't say by themselves.

private let copenhagen = "Europe/Copenhagen"

private func instant(_ text: String) throws -> Int64 {
    try #require(parseInstant(text))
}

@Test func theTestsRunInNewYorkSoAReadOfTheDevicesZoneFails() {
    #expect(TimeZone.current.identifier == "America/New_York")
}

@Test func aSpringForwardDayIs23Hours() throws {
    let day = try instant("2026-03-29T12:00:00Z")
    let start = startOfDay(day, copenhagen)
    #expect(addDays(day, 1, copenhagen) - start == 23 * 3_600_000)
}

@Test func aFallBackDayIs25Hours() throws {
    let day = try instant("2026-10-25T12:00:00Z")
    let start = startOfDay(day, copenhagen)
    #expect(addDays(day, 1, copenhagen) - start == 25 * 3_600_000)
}

@Test func aTimeInTheSpringGapMovesForward() throws {
    #expect(wallTime(2026, 2, 29, 2.5, copenhagen) == (try instant("2026-03-29T01:30:00Z")))
}

@Test func hoursPastMidnightAreTheNextDay() throws {
    #expect(wallTime(2026, 5, 19, 26, copenhagen) == (try instant("2026-06-20T00:00:00Z")))
}

@Test func instantsBefore1970FloorDown() throws {
    let d = localDate(-1, "UTC")
    #expect(d == LocalDate(year: 1969, month: 11, day: 31, dow: 3))
}

@Test func anInstantIsWrittenAsTheBrowserDoes() throws {
    #expect(isoString(try instant("2026-06-20T14:00:00+02:00")) == "2026-06-20T12:00:00.000Z")
}

@Test func whatPostgresSendsIsRead() throws {
    #expect(
        try instant("2026-06-20T12:00:00.123456+00:00")
            == (try instant("2026-06-20T12:00:00.123Z")))
}

@Test(arguments: ["", "tomorrow", "2026-06-20", "2026-06-20T12:00", "2026-13-01T12:00:00Z"])
func whatIsNoInstantIsRefused(text: String) {
    #expect(parseInstant(text) == nil)
    #expect(dayOf(text, copenhagen) == nil)
}

@Test func aBusyIntervalReadsTheServersJSON() throws {
    let json = Data(
        #"{"start":"2026-06-20T14:00:00.000Z","end":"2026-06-20T15:00:00.000Z","category":"work","priority":"never"}"#
            .utf8)
    let busy = try JSONDecoder().decode(BusyInterval.self, from: json)
    #expect(busy.category == .work)
    #expect(busy.priority == .never)
    #expect(busy.title == nil)
}
