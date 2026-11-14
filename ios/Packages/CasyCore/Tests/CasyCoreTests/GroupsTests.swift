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
