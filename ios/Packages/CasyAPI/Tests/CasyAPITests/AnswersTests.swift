import Foundation
import Testing

import CasyCore
@testable import CasyAPI

// The answers the fake backend gives the browser tests (e2e/apiAnswers.parity.ts).
// Each must read, and write back with nothing lost: a field the web's types
// have and these don't fails here.

private indirect enum Value: Codable, Equatable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([Value])
    case object([String: Value])

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() {
            self = .null
        } else if let v = try? c.decode(Bool.self) {
            self = .bool(v)
        } else if let v = try? c.decode(Double.self) {
            self = .number(v)
        } else if let v = try? c.decode(String.self) {
            self = .string(v)
        } else if let v = try? c.decode([Value].self) {
            self = .array(v)
        } else {
            self = .object(try c.decode([String: Value].self))
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .null: try c.encodeNil()
        case .bool(let v): try c.encode(v)
        case .number(let v): try c.encode(v)
        case .string(let v): try c.encode(v)
        case .array(let v): try c.encode(v)
        case .object(let v): try c.encode(v)
        }
    }

    var withoutNulls: Value {
        switch self {
        case .array(let v): .array(v.map(\.withoutNulls))
        case .object(let v): .object(v.compactMapValues { $0 == .null ? nil : $0.withoutNulls })
        default: self
        }
    }
}

private func data(_ name: String) throws -> Data {
    let url = try #require(
        Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Answers"))
    return try Data(contentsOf: url)
}

@discardableResult
private func readsWithNothingLost<T: Codable>(_ name: String, as type: T.Type) throws -> T {
    let raw = try data(name)
    let decoded = try JSONDecoder().decode(T.self, from: raw)
    let original = try JSONDecoder().decode(Value.self, from: raw).withoutNulls
    let back = try JSONDecoder().decode(Value.self, from: JSONEncoder().encode(decoded))
    #expect(back.withoutNulls == original, "\(name)")
    return decoded
}

@Test func whoAmIReads() throws {
    let me = try readsWithNothingLost("whoami", as: WhoAmI.self)
    #expect(!me.name.isEmpty)
}

@Test func groupsRead() throws {
    let answer = try readsWithNothingLost("groups-list", as: GroupsAnswer.self)
    let groups = try #require(answer.groups)
    #expect(!groups.isEmpty)
    #expect(groups.allSatisfy { !$0.members.isEmpty })
}

@Test func noGroupsRead() throws {
    let answer = try readsWithNothingLost("groups-list-empty", as: GroupsAnswer.self)
    #expect(answer.groups?.isEmpty == true)
}

@Test func invitationsRead() throws {
    try readsWithNothingLost("groups-invitations", as: InvitationsAnswer.self)
}

@Test func myDataReads() throws {
    let mine = try readsWithNothingLost("account-data", as: MyData.self)
    #expect(!mine.calendars.isEmpty)
}

@Test func myDataWithNothingLinkedReads() throws {
    let mine = try readsWithNothingLost("account-data-empty", as: MyData.self)
    #expect(mine.calendars.isEmpty)
}

@Test func adminStatusReads() throws {
    try readsWithNothingLost("admin-status", as: AdminStatus.self)
}

@Test func deletingAnAccountReads() throws {
    try readsWithNothingLost("account-delete", as: NoAnswer.self)
}

@Test func pushSettingsRead() throws {
    try readsWithNothingLost("account-push-settings", as: PushSettings.self)
}

@Test func changingAPushKindReads() throws {
    let answer = try readsWithNothingLost("account-push-set", as: PushKindsOff.self)
    #expect(answer.off.contains("deadline_near"))
}

@Test func joiningReadsBothLists() throws {
    let answer = try readsWithNothingLost("groups-accept-invitation", as: JoinedGroup.self)
    #expect(answer.groups?.isEmpty == false)
    #expect(answer.invitations?.contains { $0.groupId == "g-badminton" } == false)
}

@Test func decliningReads() throws {
    let answer = try readsWithNothingLost("groups-decline-invitation", as: InvitationsAnswer.self)
    #expect(answer.invitations?.contains { $0.groupId == "g-badminton" } == false)
}

@Test func blockingTheSenderReads() throws {
    let answer = try readsWithNothingLost("groups-block", as: BlockAnswer.self)
    #expect(answer.blocked.first?.name == "Sara")
    #expect(answer.invitations?.isEmpty == true)
}

@Test func leavingAndDeletingRead() throws {
    let left = try readsWithNothingLost("groups-leave", as: LeftGroup.self)
    #expect(left.outcome == "left")
    #expect(left.groups?.contains { $0.id == "g-running" } == false)
    let deleted = try readsWithNothingLost("groups-delete", as: LeftGroup.self)
    #expect(deleted.outcome == "deleted")
}

@Test func groupChangesAnswerYourGroups() throws {
    for name in ["groups-rename", "groups-describe", "groups-set-prime-dates"] {
        let answer = try readsWithNothingLost(name, as: GroupsAnswer.self)
        #expect(answer.groups?.contains { $0.id == "g-friday" } == true, "\(name)")
    }
}

@Test func aReportAndABlockRead() throws {
    #expect(try readsWithNothingLost("groups-report", as: ReportAnswer.self).reported)
    let blocked = try readsWithNothingLost("groups-block-member", as: BlockAnswer.self)
    #expect(blocked.blocked.first?.profileId == "p-jonas")
}

@Test func aGroupPictureIsALinkOrNone() throws {
    let set = try readsWithNothingLost("pictures-set-group-picture", as: GroupPictureAnswer.self)
    #expect(set.pictureUrl != nil)
    let removed = try readsWithNothingLost("pictures-remove-group-picture", as: GroupPictureAnswer.self)
    #expect(removed.pictureUrl == nil)
}

@Test func invitingReads() throws {
    _ = try readsWithNothingLost("groups-friends", as: FriendsAnswer.self)
    let link = try readsWithNothingLost("groups-invite", as: InviteLink.self)
    #expect(link.url.contains("/join/"))
    let invited = try readsWithNothingLost("groups-invite-members", as: GroupsAnswer.self)
    #expect(invited.groups?.isEmpty == false)
    let made = try readsWithNothingLost("groups-create", as: CreatedGroup.self)
    #expect(made.groups.contains { $0.id == made.createdId })
}

@Test func friendsRead() throws {
    let link = try readsWithNothingLost("groups-friend-link", as: InviteLink.self)
    #expect(link.url.contains("/friend/"))
    _ = try readsWithNothingLost("groups-remove-friend", as: FriendsAnswer.self)
}

@Test func dineDataActionsRead() throws {
    _ = try readsWithNothingLost("account-ai-consent", as: Outcome.self)
    _ = try readsWithNothingLost("account-corrections-delete", as: Outcome.self)
    _ = try readsWithNothingLost("groups-blocked", as: BlockedAnswer.self)
    _ = try readsWithNothingLost("groups-unblock", as: BlockedAnswer.self)
    // The export is handed on whole: every field comes back out.
    let export = try readsWithNothingLost("account-export", as: JSONValue.self)
    guard case .object(let fields) = export else { Issue.record("not an object"); return }
    #expect(fields["account"] != nil)
}

@Test func theAdminOverviewReads() throws {
    let overview = try readsWithNothingLost("admin-overview", as: AdminOverview.self)
    #expect(overview.users.count == 2)
}

@Test func adminActionsRead() throws {
    _ = try readsWithNothingLost("admin-delete-group", as: Outcome.self)
    _ = try readsWithNothingLost("admin-remove-member", as: Outcome.self)
    _ = try readsWithNothingLost("admin-delete-user", as: AdminDeleted.self)
    _ = try readsWithNothingLost("admin-sync-user", as: AdminUserSync.self)
    _ = try readsWithNothingLost("admin-report-handled", as: Outcome.self)
    _ = try readsWithNothingLost("admin-remove-avatar", as: Outcome.self)
    _ = try readsWithNothingLost("admin-remove-group-picture", as: Outcome.self)
    _ = try readsWithNothingLost("admin-correction-handled", as: Outcome.self)
    _ = try readsWithNothingLost("admin-push-test", as: PushTestAnswer.self)
    _ = try readsWithNothingLost("admin-sync-connection", as: AdminConnectionSync.self)
    #expect(try readsWithNothingLost("admin-set-ai-tester", as: AdminTesterAnswer.self).tester)
}

@Test func adminReviewsRead() throws {
    let reports = try readsWithNothingLost("admin-reports", as: AdminReports.self).reports
    #expect(reports.map(\.kind) == ["group", "member"])
    #expect(reports[1].content.memberId == "p-kim")
    let corrections = try readsWithNothingLost("admin-corrections", as: AdminCorrections.self).corrections
    #expect(corrections.map(\.kind) == ["plan", "label", "plan"])
    let label = try #require(corrections[1].data.decoded(as: LabelCorrection.self))
    #expect(label.previous.importance == "normal" && label.label.importance == "critical")
    let plan = try #require(corrections[2].data.decoded(as: PlanCorrection.self))
    #expect(plan.overridden == ["startHour"])
    #expect(plan.plan["startHour"]?.compactJSON == "18" && plan.final["startHour"]?.compactJSON == "16")
    #expect(plan.plan["weekdays"]?.compactJSON == "[5,6]")
    #expect(plan.plan["kind"]?.compactJSON == "\"evening\"")
}

@Test func eventsRead() throws {
    let events = try readsWithNothingLost("events-list", as: EventsAnswer.self).events
    #expect(events.count == 7)
    #expect(events.first { $0.id == "ev-boardgames" }?.mode == .vote)
    #expect(try readsWithNothingLost("events-list-empty", as: EventsAnswer.self).events.isEmpty)
    _ = try readsWithNothingLost("events-cancel", as: EventsAnswer.self)
    _ = try readsWithNothingLost("events-leave", as: EventsAnswer.self)
}
