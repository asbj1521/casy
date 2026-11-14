// What a list of groups needs to decide on its own: src/lib/groups.ts.

/// What a swipe on a group does (#223), `groupSwipe` on the web. Only the
/// person who made it can delete it for everyone, which is asked first; anyone
/// else leaves. Alone in it, leaving deletes it, with nobody else to lose it.
public enum GroupSwipe: Sendable, Equatable {
    case deleteAlone
    case deleteForAll
    case leave
}

public func groupSwipe(memberCount: Int, createdBy: String?, youId: String?) -> GroupSwipe {
    if memberCount <= 1 { return .deleteAlone }
    return createdBy != nil && createdBy == youId ? .deleteForAll : .leave
}

/// Who is in a group, you first: "Dig, Simon, Maja" (`memberLine` in GroupList).
public func memberLine(_ members: [(name: String, isYou: Bool)], you: String) -> String {
    let yours = members.filter(\.isYou).map { _ in you }
    let others = members.filter { !$0.isYou }.map(\.name)
    return (yours + others).joined(separator: ", ")
}
