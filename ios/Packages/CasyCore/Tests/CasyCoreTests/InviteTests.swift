import Testing

@testable import CasyCore

// The same cases as the web's tests: src/lib/groups.test.ts (knownPeople,
// looksLikeEmail, inviteExpiryLabel) and contactInvite.test.ts (recipientsOf).

private let you = (profileId: "me", name: "Asbjørn", isYou: true, avatarUrl: String?.none)
private let anna = (profileId: "a", name: "Anna", isYou: false, avatarUrl: String?.none)
private let bo = (profileId: "b", name: "Bo", isYou: false, avatarUrl: String?.none)
private let cille = (profileId: "c", name: "Cille", isYou: false, avatarUrl: String?.none)
private let groups = [
    GroupMembers(id: "g1", name: "Gymnasiet", members: [you, cille, anna]),
    GroupMembers(id: "g2", name: "Kollegerne", members: [you, anna, bo]),
]

@Test func everyoneOnceByNameWithEveryGroupYouShare() {
    #expect(
        knownPeople(groups) == [
            KnownPerson(profileId: "a", name: "Anna", groupNames: ["Gymnasiet", "Kollegerne"]),
            KnownPerson(profileId: "b", name: "Bo", groupNames: ["Kollegerne"]),
            KnownPerson(profileId: "c", name: "Cille", groupNames: ["Gymnasiet"]),
        ])
}

@Test func whoeverIsInTheGroupAlreadyIsLeftOut() {
    #expect(knownPeople(groups, except: "g2").map(\.name) == ["Cille"])
    #expect(knownPeople([]).isEmpty)
}

@Test func friendsFromGoneGroupsComeAfterWithNoGroup() {
    let people = knownPeople(groups, except: "g2", friends: [("d", "Ditte", nil), ("a", "Anna", nil)])
    #expect(people.map(\.name) == ["Cille", "Ditte"])
    #expect(people.last?.groupNames == [])
}

@Test func anEmailIsAnEmail() {
    #expect(looksLikeEmail(" anna@example.dk "))
    #expect(!looksLikeEmail("anna"))
    #expect(!looksLikeEmail("anna@example"))
    #expect(!looksLikeEmail("an na@example.dk"))
}

@Test func aLinksLifeIsDaysThenHours() {
    let now: Int64 = 1_000_000_000_000
    #expect(linkLife(expiresAt: now + 7 * 86_400_000, now: now) == .days(7))
    #expect(linkLife(expiresAt: now + 86_400_000 + 1000, now: now) == .days(1))
    #expect(linkLife(expiresAt: now + 5 * 3_600_000, now: now) == .hours(5))
    #expect(linkLife(expiresAt: now + 60_000, now: now) == .underAnHour)
    #expect(linkLife(expiresAt: now, now: now) == .expired)
}

@Test func aTextGoesToTheFirstNumberOrElseTheEmail() {
    #expect(
        recipients([
            (["+45 12 34 56 78", "+45 87 65 43 21"], ["f@x.dk"]), ([], ["oliver@x.dk"]),
        ]) == ["+45 12 34 56 78", "oliver@x.dk"])
    #expect(
        recipients([([" "], []), (["+45 11 11 11 11"], []), (["+45 11 11 11 11"], [])])
            == ["+45 11 11 11 11"])
}
