import Testing

@testable import CasyCore

// The same cases as src/lib/groups.test.ts's groupSwipe (#223).

@Test func aGroupYouAreAloneInIsDeletedWhoeverMadeIt() {
    #expect(groupSwipe(memberCount: 1, createdBy: "me", youId: "me") == .deleteAlone)
    #expect(groupSwipe(memberCount: 1, createdBy: "other", youId: "me") == .deleteAlone)
    #expect(groupSwipe(memberCount: 1, createdBy: nil, youId: "me") == .deleteAlone)
}

@Test func onlyWhoeverMadeItDeletesForAllAndEveryoneElseLeaves() {
    #expect(groupSwipe(memberCount: 2, createdBy: "me", youId: "me") == .deleteForAll)
    #expect(groupSwipe(memberCount: 2, createdBy: "other", youId: "me") == .leave)
    #expect(groupSwipe(memberCount: 2, createdBy: nil, youId: "me") == .leave)
    // Not known who you are yet: never delete for others.
    #expect(groupSwipe(memberCount: 2, createdBy: nil, youId: nil) == .leave)
}

@Test func theMemberLinePutsYouFirst() {
    let line = memberLine(
        [(name: "Freja", isYou: false), (name: "Mia", isYou: true), (name: "Oliver", isYou: false)],
        you: "Dig")
    #expect(line == "Dig, Freja, Oliver")
}

// What the web's formatMonthYear says for the same moments, in Danish time.
@Test func aGroupsAgeReadsAsTheWebSaysIt() throws {
    let cases: [(String, String, String)] = [
        ("2026-08-31T22:30:00Z", "sep. 2026", "Sept 2026"),
        ("2026-05-15T12:00:00Z", "maj 2026", "May 2026"),
        ("2025-12-31T23:30:00Z", "jan. 2026", "Jan 2026"),
    ]
    for (iso, da, en) in cases {
        let ms = try #require(parseInstant(iso))
        #expect(monthYear(ms, .da) == da)
        #expect(monthYear(ms, .en) == en)
    }
}

// What the web's toLocaleDateString says for the same moments (Dine data).
@Test func datesReadAsTheWebSaysThem() {
    #expect(formatDayMonthYear("2026-08-31T22:30:00Z", .da) == "1. sep. 2026")
    #expect(formatDayMonthYear("2026-08-31T22:30:00Z", .en) == "1 Sept 2026")
    #expect(formatDayMonthYear("2026-05-15T12:00:00Z", .da) == "15. maj 2026")
    #expect(formatDayMonth("2026-08-31T22:30:00Z", .da) == "1. sep.")
    #expect(formatDayMonth("2026-08-31T22:30:00Z", .en) == "1 Sept")
    #expect(formatDayLongMonthYear("2026-08-31T22:30:00Z", .da) == "1. september 2026")
    #expect(formatDayLongMonthYear("2026-05-15T12:00:00Z", .en) == "15 May 2026")
}
