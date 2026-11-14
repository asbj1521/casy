// The calls the first native screens need: the same functions and actions the
// web's src/api makes. `errorMessage` is the screen's own fallback.

private struct Action: Encodable, Sendable {
    let action: String
}

private struct ConfirmedAction: Encodable, Sendable {
    let action: String
    let confirm: Bool
}

private struct PushSet: Encodable, Sendable {
    let action = "push-set"
    let kind: String
    let on: Bool
}

private struct SetName: Encodable, Sendable {
    let action = "set-name"
    let name: String
}

private struct GroupAction: Encodable, Sendable {
    let action: String
    let groupId: String
}

private struct RenameGroup: Encodable, Sendable {
    let action = "rename"
    let groupId: String
    let name: String
}

private struct DescribeGroup: Encodable, Sendable {
    let action = "describe"
    let groupId: String
    let description: String
}

private struct SetPrimeDates: Encodable, Sendable {
    let action = "set-prime-dates"
    let groupId: String
    let on: Bool
}

private struct SetGroupPicture: Encodable, Sendable {
    let action = "set-group-picture"
    let groupId: String
    let image: String
}

private struct BlockMember: Encodable, Sendable {
    let action = "block"
    let profileId: String
}

/// What a report is about: the group, or a member of it (#142).
public enum ReportTarget: Sendable, Equatable {
    case group(groupId: String)
    case member(groupId: String, memberId: String)
}

private struct Report: Encodable, Sendable {
    let action = "report"
    let kind: String
    let groupId: String
    let memberId: String?
    let reason: String
    let note: String

    init(_ target: ReportTarget, reason: String, note: String) {
        switch target {
        case .group(let groupId):
            kind = "group"
            self.groupId = groupId
            memberId = nil
        case .member(let groupId, let memberId):
            kind = "member"
            self.groupId = groupId
            self.memberId = memberId
        }
        self.reason = reason
        self.note = note
    }
}

private struct MakeInvite: Encodable, Sendable {
    let action = "invite"
    let groupId: String
    /// The link opens the app when it has it (#277).
    let app = true
}

private struct InviteMembers: Encodable, Sendable {
    let action = "invite-members"
    let groupId: String
    let profileIds: [String]
    let emails: [String]
}

private struct CreateGroup: Encodable, Sendable {
    let action = "create"
    let name: String
    let description: String?
}

private struct BlockSender: Encodable, Sendable {
    let action = "block"
    let invitationGroupId: String
}

private struct SetAvatar: Encodable, Sendable {
    let action = "set-avatar"
    let image: String
}

extension EdgeFunctions {
    public func pushSettings(errorMessage: String? = nil) async throws -> PushSettings {
        try await call("account", body: Action(action: "push-settings"), errorMessage: errorMessage)
    }

    /// One notification kind switched on or off; answers the kinds now off.
    public func setPushKind(
        _ kind: String,
        on: Bool,
        errorMessage: String? = nil
    ) async throws -> [String] {
        let answer: PushKindsOff = try await call(
            "account", body: PushSet(kind: kind, on: on), errorMessage: errorMessage)
        return answer.off
    }

    public func whoAmI(errorMessage: String? = nil) async throws -> WhoAmI {
        try await call("groups", body: Action(action: "whoami"), errorMessage: errorMessage)
    }

    /// The name your groups see; answers it as it was saved.
    public func setDisplayName(_ name: String, errorMessage: String? = nil) async throws -> String {
        let answer: DisplayName = try await call(
            "groups", body: SetName(name: name), errorMessage: errorMessage)
        return answer.name
    }

    /// Your new picture, a base64 JPEG; answers a link to it.
    public func setAvatar(_ image: String, errorMessage: String? = nil) async throws -> String? {
        let answer: AvatarAnswer = try await call(
            "pictures", body: SetAvatar(image: image), errorMessage: errorMessage)
        return answer.avatarUrl
    }

    public func removeAvatar(errorMessage: String? = nil) async throws {
        let _: AvatarAnswer = try await call(
            "pictures", body: Action(action: "remove-avatar"), errorMessage: errorMessage)
    }

    public func groups(errorMessage: String? = nil) async throws -> [Group] {
        let answer: GroupsAnswer = try await call(
            "groups", body: Action(action: "list"), errorMessage: errorMessage)
        return answer.groups ?? []
    }

    public func invitations(errorMessage: String? = nil) async throws -> [Invitation] {
        let answer: InvitationsAnswer = try await call(
            "groups", body: Action(action: "invitations"), errorMessage: errorMessage)
        return answer.invitations ?? []
    }

    /// Yes to an invitation: answers your groups and the invitations left.
    public func acceptInvitation(
        _ groupId: String, errorMessage: String? = nil
    ) async throws -> JoinedGroup {
        try await call(
            "groups", body: GroupAction(action: "accept-invitation", groupId: groupId),
            errorMessage: errorMessage)
    }

    /// No thanks: answers the invitations left. The group is never told.
    public func declineInvitation(
        _ groupId: String, errorMessage: String? = nil
    ) async throws -> [Invitation] {
        let answer: InvitationsAnswer = try await call(
            "groups", body: GroupAction(action: "decline-invitation", groupId: groupId),
            errorMessage: errorMessage)
        return answer.invitations ?? []
    }

    /// Blocks whoever sent this invitation, which is declined with it (#142).
    public func blockInvitationSender(
        _ groupId: String, errorMessage: String? = nil
    ) async throws -> BlockAnswer {
        try await call(
            "groups", body: BlockSender(invitationGroupId: groupId), errorMessage: errorMessage)
    }

    /// Leaves a group; the last one out deletes it.
    public func leaveGroup(_ groupId: String, errorMessage: String? = nil) async throws -> LeftGroup {
        try await call(
            "groups", body: GroupAction(action: "leave", groupId: groupId),
            errorMessage: errorMessage)
    }

    /// Deletes a group for everyone: only whoever made it may.
    public func deleteGroup(_ groupId: String, errorMessage: String? = nil) async throws -> LeftGroup {
        try await call(
            "groups", body: GroupAction(action: "delete", groupId: groupId),
            errorMessage: errorMessage)
    }

    /// A group's new name; answers your groups.
    public func renameGroup(
        _ groupId: String, to name: String, errorMessage: String? = nil
    ) async throws -> [Group] {
        let answer: GroupsAnswer = try await call(
            "groups", body: RenameGroup(groupId: groupId, name: name), errorMessage: errorMessage)
        return answer.groups ?? []
    }

    /// What the group is for (#152), empty for none; answers your groups.
    public func describeGroup(
        _ groupId: String, as description: String, errorMessage: String? = nil
    ) async throws -> [Group] {
        let answer: GroupsAnswer = try await call(
            "groups", body: DescribeGroup(groupId: groupId, description: description),
            errorMessage: errorMessage)
        return answer.groups ?? []
    }

    /// Tid til hinanden (#171) on or off for you; answers your groups.
    public func setPrimeDates(
        _ groupId: String, on: Bool, errorMessage: String? = nil
    ) async throws -> [Group] {
        let answer: GroupsAnswer = try await call(
            "groups", body: SetPrimeDates(groupId: groupId, on: on), errorMessage: errorMessage)
        return answer.groups ?? []
    }

    /// A group's new picture (#188), a base64 JPEG; answers a link to it.
    public func setGroupPicture(
        _ groupId: String, _ image: String, errorMessage: String? = nil
    ) async throws -> String? {
        let answer: GroupPictureAnswer = try await call(
            "pictures", body: SetGroupPicture(groupId: groupId, image: image),
            errorMessage: errorMessage)
        return answer.pictureUrl
    }

    public func removeGroupPicture(_ groupId: String, errorMessage: String? = nil) async throws {
        let _: GroupPictureAnswer = try await call(
            "pictures", body: GroupAction(action: "remove-group-picture", groupId: groupId),
            errorMessage: errorMessage)
    }

    /// A report to us (#142): `reason` is spam, offensive, harassment or other.
    public func report(
        _ target: ReportTarget, reason: String, note: String, errorMessage: String? = nil
    ) async throws {
        let _: ReportAnswer = try await call(
            "groups", body: Report(target, reason: reason, note: note), errorMessage: errorMessage)
    }

    /// Blocks a member (#142): no more invitations from them.
    public func blockPerson(_ profileId: String, errorMessage: String? = nil) async throws -> BlockAnswer {
        try await call("groups", body: BlockMember(profileId: profileId), errorMessage: errorMessage)
    }

    /// People from groups since gone (#222).
    public func friends(errorMessage: String? = nil) async throws -> [Friend] {
        let answer: FriendsAnswer = try await call(
            "groups", body: Action(action: "friends"), errorMessage: errorMessage)
        return answer.friends ?? []
    }

    /// A fresh link to the group: only a fingerprint is stored, so an old one
    /// can't be shown again.
    public func makeInviteLink(_ groupId: String, errorMessage: String? = nil) async throws -> InviteLink {
        try await call("groups", body: MakeInvite(groupId: groupId), errorMessage: errorMessage)
    }

    /// Invitations by name and by email; answers your groups, the people now
    /// marked invited. Never says which emails have an account.
    public func inviteMembers(
        _ groupId: String, profileIds: [String], emails: [String], errorMessage: String? = nil
    ) async throws -> [Group] {
        let answer: GroupsAnswer = try await call(
            "groups",
            body: InviteMembers(groupId: groupId, profileIds: profileIds, emails: emails),
            errorMessage: errorMessage)
        return answer.groups ?? []
    }

    /// A new group with you in it; `description` nil for none.
    public func createGroup(
        name: String, description: String?, errorMessage: String? = nil
    ) async throws -> CreatedGroup {
        try await call(
            "groups", body: CreateGroup(name: name, description: description),
            errorMessage: errorMessage)
    }

    public func isAdmin(errorMessage: String? = nil) async throws -> Bool {
        let answer: AdminStatus = try await call(
            "admin", body: Action(action: "status"), errorMessage: errorMessage)
        return answer.isAdmin
    }

    public func myData(errorMessage: String? = nil) async throws -> MyData {
        try await call("account", body: Action(action: "data"), errorMessage: errorMessage)
    }

    /// Deletes the account. `confirm` is the server's own guard against a stray call.
    public func deleteMyAccount(errorMessage: String? = nil) async throws {
        let _: NoAnswer = try await call(
            "account", body: ConfirmedAction(action: "delete", confirm: true),
            errorMessage: errorMessage)
    }
}
