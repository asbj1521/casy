// Inviting people to a group: who you know, what an email looks like, how
// long a link lasts, and whom a text goes to. src/lib/groups.ts and
// contactInvite.ts.

import Foundation

/// Someone you share at least one group with, and which groups those are;
/// a friend from groups since gone (#222) has none to name.
public struct KnownPerson: Sendable, Equatable, Identifiable {
    public let profileId: String
    public let name: String
    public var groupNames: [String]
    public let avatarUrl: String?

    public var id: String { profileId }

    public init(profileId: String, name: String, groupNames: [String], avatarUrl: String? = nil) {
        self.profileId = profileId
        self.name = name
        self.groupNames = groupNames
        self.avatarUrl = avatarUrl
    }
}

/// A group as far as inviting cares: who is in it.
public struct GroupMembers: Sendable {
    public let id: String
    public let name: String
    public let members: [(profileId: String, name: String, isYou: Bool, avatarUrl: String?)]

    public init(
        id: String, name: String,
        members: [(profileId: String, name: String, isYou: Bool, avatarUrl: String?)]
    ) {
        self.id = id
        self.name = name
        self.members = members
    }
}

/// Everyone you know from your groups and as friends, once each, leaving out
/// anyone already in `except` (the group being invited to); sorted by name,
/// as the web's `knownPeople` (`localeCompare`, which reads å as a).
public func knownPeople(
    _ groups: [GroupMembers], except: String? = nil,
    friends: [(profileId: String, name: String, avatarUrl: String?)] = []
) -> [KnownPerson] {
    let inExcept = Set(groups.first { $0.id == except }?.members.map(\.profileId) ?? [])
    var order: [String] = []
    var people: [String: KnownPerson] = [:]
    for group in groups {
        for member in group.members where !member.isYou && !inExcept.contains(member.profileId) {
            if people[member.profileId] != nil {
                people[member.profileId]?.groupNames.append(group.name)
            } else {
                order.append(member.profileId)
                people[member.profileId] = KnownPerson(
                    profileId: member.profileId, name: member.name, groupNames: [group.name],
                    avatarUrl: member.avatarUrl)
            }
        }
    }
    for friend in friends where !inExcept.contains(friend.profileId) && people[friend.profileId] == nil {
        order.append(friend.profileId)
        people[friend.profileId] = KnownPerson(
            profileId: friend.profileId, name: friend.name, groupNames: [], avatarUrl: friend.avatarUrl)
    }
    let english = Locale(identifier: "en")
    return order.compactMap { people[$0] }.sorted {
        $0.name.compare($1.name, options: [.caseInsensitive, .diacriticInsensitive], locale: english)
            == .orderedAscending
    }
}

/// Whether text reads as an email address, spaces around it allowed.
public func looksLikeEmail(_ text: String) -> Bool {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.range(of: #"^[^\s@]+@[^\s@]+\.[^\s@]+$"#, options: .regularExpression) != nil
}

/// At most this many addresses go in one invite (`MAX_EMAILS_PER_INVITE`).
public let maxEmailsPerInvite = 10

/// How long an invite link has left, for "Det virker i 7 dage."
public enum LinkLife: Sendable, Equatable {
    case expired
    case days(Int)
    case hours(Int)
    case underAnHour
}

/// `inviteExpiryLabel` without the words: whole days while there are any,
/// then hours, then under an hour.
public func linkLife(expiresAt: Int64, now: Int64) -> LinkLife {
    let left = expiresAt - now
    if left <= 0 { return .expired }
    let days = left / 86_400_000
    if days >= 1 { return .days(Int(days)) }
    let hours = left / 3_600_000
    if hours >= 1 { return .hours(Int(hours)) }
    return .underAnHour
}

/// Whom a text goes to (#149): each person's first number, or their first
/// email (iMessage) when they have no number; each address once, people with
/// neither left out. `recipientsOf` on the web.
public func recipients(_ contacts: [(phones: [String], emails: [String])]) -> [String] {
    var seen = Set<String>()
    var out: [String] = []
    for contact in contacts {
        let blank = { (s: String) in s.trimmingCharacters(in: .whitespaces).isEmpty }
        guard let address = contact.phones.first(where: { !blank($0) })
            ?? contact.emails.first(where: { !blank($0) })
        else { continue }
        let trimmed = address.trimmingCharacters(in: .whitespaces)
        if seen.insert(trimmed).inserted { out.append(trimmed) }
    }
    return out
}
