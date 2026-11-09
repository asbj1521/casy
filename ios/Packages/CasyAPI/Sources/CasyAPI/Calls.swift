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
