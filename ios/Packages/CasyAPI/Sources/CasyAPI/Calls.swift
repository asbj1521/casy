// The calls the first native screens need: the same functions and actions the
// web's src/api makes. `errorMessage` is the screen's own fallback.

import CasyCore

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
    case event(groupId: String, eventId: String)
}

private struct Report: Encodable, Sendable {
    let action = "report"
    let kind: String
    let groupId: String
    let memberId: String?
    let eventId: String?
    let reason: String
    let note: String

    init(_ target: ReportTarget, reason: String, note: String) {
        switch target {
        case .group(let groupId):
            kind = "group"
            self.groupId = groupId
            memberId = nil
            eventId = nil
        case .member(let groupId, let memberId):
            kind = "member"
            self.groupId = groupId
            self.memberId = memberId
            eventId = nil
        case .event(let groupId, let eventId):
            kind = "event"
            self.groupId = groupId
            memberId = nil
            self.eventId = eventId
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

private struct FriendLink: Encodable, Sendable {
    let action = "friend-link"
    /// The link opens the app when it has it (#277).
    let app = true
}

private struct RemoveFriend: Encodable, Sendable {
    let action = "remove-friend"
    let profileId: String
}

private struct Switch: Encodable, Sendable {
    let action: String
    let on: Bool
}

private struct Unblock: Encodable, Sendable {
    let action = "unblock"
    let profileId: String
}

private struct AdminGroup: Encodable, Sendable {
    let action: String
    let groupId: String
}

private struct AdminMember: Encodable, Sendable {
    let action = "removeMember"
    let groupId: String
    let profileId: String
}

private struct AdminUser: Encodable, Sendable {
    let action = "deleteUser"
    let profileId: String
}

private struct EventAction: Encodable, Sendable {
    let action: String
    let proposalId: String
}

private struct EventChoice: Encodable, Sendable {
    let action = "choose"
    let proposalId: String
    let dateId: String
}

private struct EventDeadline: Encodable, Sendable {
    let action = "deadline"
    let proposalId: String
    let answerDays: Int?

    // `null` sent as such: no deadline at all.
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(action, forKey: .action)
        try c.encode(proposalId, forKey: .proposalId)
        try c.encode(answerDays, forKey: .answerDays)
    }

    private enum CodingKeys: String, CodingKey { case action, proposalId, answerDays }
}

private struct EventAnswer: Encodable, Sendable {
    let action = "answer"
    let proposalId: String
    let dateId: String
    let response: EventResponse
}

private struct SetPrimary: Encodable, Sendable {
    let action = "set"
    let calendarId: String
}

private struct AdminId: Encodable, Sendable {
    let action: String
    let id: String
}

private struct AdminAvatar: Encodable, Sendable {
    let action = "removeAvatar"
    let memberId: String
}

private struct LangAction: Encodable, Sendable {
    let action: String
    let lang: String
}

private struct AdminSyncUser: Encodable, Sendable {
    let action = "syncUser"
    let userId: String
}

private struct AdminSyncConnection: Encodable, Sendable {
    let action = "syncConnection"
    let connectionId: String
}

private struct AdminTester: Encodable, Sendable {
    let action = "setAiTester"
    let profileId: String
    let allowed: Bool
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

    /// A link anyone can open to become your friend (#226).
    public func makeFriendLink(errorMessage: String? = nil) async throws -> InviteLink {
        try await call("groups", body: FriendLink(), errorMessage: errorMessage)
    }

    /// No longer friends; answers the friends left.
    public func removeFriend(_ profileId: String, errorMessage: String? = nil) async throws -> [Friend] {
        let answer: FriendsAnswer = try await call(
            "groups", body: RemoveFriend(profileId: profileId), errorMessage: errorMessage)
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

    /// Your yes to the AI reading your calendars' names and events' titles
    /// (#120), given or taken back; taking it back deletes what was sent for review.
    public func setAiConsent(_ on: Bool, errorMessage: String? = nil) async throws {
        let _: Outcome = try await call(
            "account", body: Switch(action: "ai-consent", on: on), errorMessage: errorMessage)
    }

    /// Whether your corrections of the AI are sent to us for review (#122).
    public func setAiShare(_ on: Bool, errorMessage: String? = nil) async throws {
        let _: Outcome = try await call(
            "account", body: Switch(action: "ai-share", on: on), errorMessage: errorMessage)
    }

    /// Deletes every correction you sent (#122).
    public func deleteMyCorrections(errorMessage: String? = nil) async throws {
        let _: Outcome = try await call(
            "account", body: Action(action: "corrections-delete"), errorMessage: errorMessage)
    }

    /// Everything we hold about you, whole, for Hent en kopi.
    public func exportMyData(errorMessage: String? = nil) async throws -> JSONValue {
        try await call("account", body: Action(action: "export"), errorMessage: errorMessage)
    }

    public func blocked(errorMessage: String? = nil) async throws -> [BlockedPerson] {
        let answer: BlockedAnswer = try await call(
            "groups", body: Action(action: "blocked"), errorMessage: errorMessage)
        return answer.blocked
    }

    public func unblock(_ profileId: String, errorMessage: String? = nil) async throws -> [BlockedPerson] {
        let answer: BlockedAnswer = try await call(
            "groups", body: Unblock(profileId: profileId), errorMessage: errorMessage)
        return answer.blocked
    }

    /// Everything admin mode shows; the server checks who is asking.
    public func adminOverview(errorMessage: String? = nil) async throws -> AdminOverview {
        try await call("admin", body: Action(action: "overview"), errorMessage: errorMessage)
    }

    public func adminDeleteGroup(_ groupId: String, errorMessage: String? = nil) async throws {
        let _: Outcome = try await call(
            "admin", body: AdminGroup(action: "deleteGroup", groupId: groupId), errorMessage: errorMessage)
    }

    /// Takes someone out of a group; the last one out deletes it.
    public func adminRemoveMember(
        _ profileId: String, from groupId: String, errorMessage: String? = nil
    ) async throws {
        let _: Outcome = try await call(
            "admin", body: AdminMember(groupId: groupId, profileId: profileId), errorMessage: errorMessage)
    }

    /// Deletes an account; answers how many groups went with it.
    public func adminDeleteUser(_ profileId: String, errorMessage: String? = nil) async throws -> AdminDeleted {
        try await call("admin", body: AdminUser(profileId: profileId), errorMessage: errorMessage)
    }

    /// Every calendar account of one person, synced now.
    public func adminSyncUser(_ userId: String, errorMessage: String? = nil) async throws -> AdminUserSync {
        try await call("admin", body: AdminSyncUser(userId: userId), errorMessage: errorMessage)
    }

    public func adminSyncConnection(
        _ connectionId: String, errorMessage: String? = nil
    ) async throws -> AdminConnectionSync {
        try await call(
            "admin", body: AdminSyncConnection(connectionId: connectionId), errorMessage: errorMessage)
    }

    /// An AI tester gets every AI feature otherwise only for admins (#111).
    public func adminSetAiTester(
        _ profileId: String, allowed: Bool, errorMessage: String? = nil
    ) async throws -> Bool {
        let answer: AdminTesterAnswer = try await call(
            "admin", body: AdminTester(profileId: profileId, allowed: allowed), errorMessage: errorMessage)
        return answer.tester
    }

    /// Every event you were asked about.
    public func events(errorMessage: String? = nil) async throws -> [SuggestedEvent] {
        let answer: EventsAnswer = try await call(
            "events", body: Action(action: "list"), errorMessage: errorMessage)
        return answer.events
    }

    /// Your own event, cancelled for everyone; the events as they are now.
    public func cancelEvent(_ id: String, errorMessage: String? = nil) async throws -> [SuggestedEvent] {
        let answer: EventsAnswer = try await call(
            "events", body: EventAction(action: "cancel", proposalId: id), errorMessage: errorMessage)
        return answer.events
    }

    /// Your answer for one date; `outcome` says whether that settled the vote.
    public func answerDate(
        _ id: String, dateId: String, response: EventResponse, errorMessage: String? = nil
    ) async throws -> AnswerOutcome {
        try await call(
            "events", body: EventAnswer(proposalId: id, dateId: dateId, response: response),
            errorMessage: errorMessage)
    }

    /// Into your primary calendar now; on a phone calendar, "adding" until the app writes it.
    public func addToMyCalendar(_ id: String, errorMessage: String? = nil) async throws -> [SuggestedEvent] {
        let answer: EventsAnswer = try await call(
            "events", body: EventAction(action: "add-to-calendar", proposalId: id), errorMessage: errorMessage)
        return answer.events
    }

    /// A scheduled event as a calendar file, for adding by hand.
    public func eventFile(_ id: String, errorMessage: String? = nil) async throws -> EventFile {
        try await call("events", body: EventAction(action: "ics", proposalId: id), errorMessage: errorMessage)
    }

    /// Every account you linked, with its calendars.
    public func calendarConnections(errorMessage: String? = nil) async throws -> [CalendarConnection] {
        let answer: CalendarConnections = try await call("calendar-status", errorMessage: errorMessage)
        return answer.connections ?? []
    }

    /// Your calendar's busy blocks over [from, to), ISO instants.
    public func calendarBusy(from: String, to: String, errorMessage: String? = nil) async throws -> OverviewData {
        try await call("calendar-busy", params: ["from": from, "to": to], errorMessage: errorMessage)
    }

    /// Your primary calendar, or nil if you haven't chosen one.
    public func primaryCalendar(errorMessage: String? = nil) async throws -> PrimaryCalendar? {
        let answer: PrimaryAnswer = try await call(
            "calendar-primary", body: Action(action: "get"), errorMessage: errorMessage)
        return answer.primary
    }

    /// A calendar chosen as primary.
    public func setPrimaryCalendar(_ calendarId: String, errorMessage: String? = nil) async throws -> PrimaryCalendar? {
        let answer: PrimaryAnswer = try await call(
            "calendar-primary", body: SetPrimary(calendarId: calendarId), errorMessage: errorMessage)
        return answer.primary
    }

    /// The suggester picks the date of a vote no date could win.
    public func chooseDate(_ id: String, dateId: String, errorMessage: String? = nil) async throws -> [SuggestedEvent] {
        let answer: EventsAnswer = try await call(
            "events", body: EventChoice(proposalId: id, dateId: dateId), errorMessage: errorMessage)
        return answer.events
    }

    /// The suggester's deadline: 1 to 7 days from now, or nil for none (#179).
    public func setVoteDeadline(_ id: String, days: Int?, errorMessage: String? = nil) async throws -> [SuggestedEvent] {
        let answer: EventsAnswer = try await call(
            "events", body: EventDeadline(proposalId: id, answerDays: days), errorMessage: errorMessage)
        return answer.events
    }

    /// The suggester settles an open vote now, with the answers so far (#179).
    public func settleVote(_ id: String, errorMessage: String? = nil) async throws -> [SuggestedEvent] {
        let answer: EventsAnswer = try await call(
            "events", body: EventAction(action: "settle", proposalId: id), errorMessage: errorMessage)
        return answer.events
    }

    /// A notification to those still to answer, once a day at most.
    public func remindVoters(_ id: String, errorMessage: String? = nil) async throws -> RemindAnswer {
        try await call("events", body: EventAction(action: "remind", proposalId: id), errorMessage: errorMessage)
    }

    /// Someone else's event, left: you're no longer asked or counted.
    public func leaveEvent(_ id: String, errorMessage: String? = nil) async throws -> [SuggestedEvent] {
        let answer: EventsAnswer = try await call(
            "events", body: EventAction(action: "leave", proposalId: id), errorMessage: errorMessage)
        return answer.events
    }

    /// What people reported, newest first (#142).
    public func adminReports(errorMessage: String? = nil) async throws -> [AdminReport] {
        let answer: AdminReports = try await call(
            "admin", body: Action(action: "reports"), errorMessage: errorMessage)
        return answer.reports
    }

    /// One dealt with: deleted (#142).
    public func adminReportHandled(_ id: String, errorMessage: String? = nil) async throws {
        let _: Outcome = try await call(
            "admin", body: AdminId(action: "reportHandled", id: id), errorMessage: errorMessage)
    }

    /// A reported member's profile picture taken down (#187).
    public func adminRemoveAvatar(_ memberId: String, errorMessage: String? = nil) async throws {
        let _: Outcome = try await call(
            "admin", body: AdminAvatar(memberId: memberId), errorMessage: errorMessage)
    }

    /// A reported group's picture taken down (#188).
    public func adminRemoveGroupPicture(_ groupId: String, errorMessage: String? = nil) async throws {
        let _: Outcome = try await call(
            "admin", body: AdminGroup(action: "removeGroupPicture", groupId: groupId),
            errorMessage: errorMessage)
    }

    /// The corrections of the AI sent for review, newest first (#122).
    public func adminCorrections(errorMessage: String? = nil) async throws -> [AdminCorrection] {
        let answer: AdminCorrections = try await call(
            "admin", body: Action(action: "corrections"), errorMessage: errorMessage)
        return answer.corrections
    }

    /// One reviewed: its lesson is in the prompt or the evals now, so it is deleted.
    public func adminCorrectionHandled(_ id: String, errorMessage: String? = nil) async throws {
        let _: Outcome = try await call(
            "admin", body: AdminId(action: "correctionHandled", id: id), errorMessage: errorMessage)
    }

    /// A test notification to the admin's own phones (#139).
    public func adminPushTest(lang: String, errorMessage: String? = nil) async throws -> PushTestAnswer {
        try await call("admin", body: LangAction(action: "pushTest", lang: lang), errorMessage: errorMessage)
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
