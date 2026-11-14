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
