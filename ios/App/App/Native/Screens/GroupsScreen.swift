import CasyAPI
import CasyCore
import CasyUI
import SwiftUI

/// Your groups and the invitations waiting for you, as Grupper shows them.
/// One for the whole launch, like `ProfileModel`; forgotten when the person
/// changes. Every change also reaches the page, whose own copies (and the
/// Profil button's count) are fetched again.
@MainActor @Observable
final class GroupsModel {
    static let shared = GroupsModel()

    private(set) var groups: [CasyAPI.Group]?
    private(set) var invitations: [Invitation] = []
    private(set) var loadFailed = false
    /// The groups being left or deleted right now.
    private(set) var working: Set<String> = []
    var failure: String?
    /// People from groups since gone (#222), offered in Invitér too.
    private(set) var friends: [Friend] = []
    /// Tells the page someone was invited to a group in a way the server
    /// can't tell it (a link, a text, an email), for its home page's nudge.
    var onInviteSent: ((String) -> Void)?

    func reset() {
        groups = nil
        invitations = []
        friends = []
        loadFailed = false
        working = []
        failure = nil
    }

    func load() async {
        guard let api = await Native.api() else { return }
        async let mine = try? api.groups(errorMessage: CasyStrings.groupsLoadFailed)
        async let waiting = try? api.invitations()
        let (groups, invited) = await (mine, waiting)
        if let groups {
            self.groups = groups
            loadFailed = false
        } else if self.groups == nil {
            loadFailed = true
        }
        if let invited { setInvitations(invited) }
    }

    /// Who you are in a group, from the group itself: the same id the server
    /// has as its maker.
    func swipe(for group: CasyAPI.Group) -> GroupSwipe {
        groupSwipe(
            memberCount: group.members.count, createdBy: group.createdBy,
            youId: group.members.first(where: \.isYou)?.profileId)
    }

    /// A swipe's answer: deleting for everyone is asked first, by the screen.
    func leaveOrDelete(_ group: CasyAPI.Group) {
        let forAll = swipe(for: group) == .deleteForAll
        failure = nil
        working.insert(group.id)
        Task {
            defer { working.remove(group.id) }
            do {
                try await remove(group, forAll: forAll)
            } catch {
                failure = error.localizedDescription
            }
        }
    }

    /// Leaves the group (the last one out deletes it), or deletes it for
    /// everyone: only whoever made it may.
    func remove(_ group: CasyAPI.Group, forAll: Bool) async throws {
        let message = forAll ? CasyStrings.groupsDeleteFailed : CasyStrings.groupsLeaveFailed
        let api = try await signedIn(message)
        let answer =
            forAll
            ? try await api.deleteGroup(group.id, errorMessage: message)
            : try await api.leaveGroup(group.id, errorMessage: message)
        groups = answer.groups ?? groups?.filter { $0.id != group.id }
        changed()
    }

    /// Everyone you could invite to `groupId`: your groups' members and your
    /// friends, without who is in it already (`knownPeople`).
    func people(for groupId: String) -> [KnownPerson] {
        let mine = (groups ?? []).map { group in
            GroupMembers(
                id: group.id, name: group.name,
                members: group.members.map {
                    (profileId: $0.profileId, name: $0.name, isYou: $0.isYou, avatarUrl: $0.avatarUrl)
                })
        }
        return knownPeople(
            mine, except: groupId,
            friends: friends.map { (profileId: $0.profileId, name: $0.name, avatarUrl: $0.avatarUrl) })
    }

    func loadFriends() async {
        guard let api = await Native.api() else { return }
        if let answer = try? await api.friends() { friends = answer }
    }

    /// Invitations sent: the people show as invited once the picks are cleared.
    func invite(_ groupId: String, profileIds: [String], emails: [String]) async throws {
        let api = try await signedIn(CasyStrings.inviteSendFailed)
        groups = try await api.inviteMembers(
            groupId, profileIds: profileIds, emails: emails, errorMessage: CasyStrings.inviteSendFailed)
        inviteSent(groupId)
        changed()
    }

    /// A fresh link: only a fingerprint is stored, so one can't be shown again.
    func makeLink(_ groupId: String) async throws -> InviteLink {
        let api = try await signedIn(CasyStrings.inviteLinkFailed)
        return try await api.makeInviteLink(groupId, errorMessage: CasyStrings.inviteLinkFailed)
    }

    func inviteSent(_ groupId: String) { onInviteSent?(groupId) }

    /// A link anyone can open to become your friend (#226).
    func makeFriendLink() async throws -> InviteLink {
        let api = try await signedIn(CasyStrings.friendLinkFailed)
        return try await api.makeFriendLink(errorMessage: CasyStrings.friendLinkFailed)
    }

    /// No longer friends (#222): only someone you share no group with.
    func removeFriend(_ profileId: String) async throws {
        let api = try await signedIn(CasyStrings.friendsFailed)
        friends = try await api.removeFriend(profileId, errorMessage: CasyStrings.friendsFailed)
        changed()
    }

    /// A new group with you in it, then its picture, which needs the group to
    /// exist; without the picture the group is still made (`pictureLost`).
    func create(
        name: String, description: String, picture: String?
    ) async throws -> (id: String, pictureLost: Bool) {
        let api = try await signedIn(CasyStrings.newGroupFailed)
        let made = try await api.createGroup(
            name: name, description: description.isEmpty ? nil : description,
            errorMessage: CasyStrings.newGroupFailed)
        groups = made.groups
        changed()
        guard let picture else { return (made.createdId, false) }
        do {
            _ = try await api.setGroupPicture(made.createdId, picture)
            await load()
            changed()
            return (made.createdId, false)
        } catch {
            return (made.createdId, true)
        }
    }

    /// One group and its place in the list, which colours its letter as its row.
    func indexed(_ id: String) -> (group: CasyAPI.Group, index: Int)? {
        guard let index = groups?.firstIndex(where: { $0.id == id }), let groups else { return nil }
        return (groups[index], index)
    }

    /// Tid til hinanden (#171), your own choice for this group.
    func setPrimeDates(_ group: CasyAPI.Group, on: Bool) async throws {
        let api = try await signedIn(CasyStrings.groupPrimeFailed)
        groups = try await api.setPrimeDates(group.id, on: on, errorMessage: CasyStrings.groupPrimeFailed)
        changed()
    }

    /// Rediger gruppe's Gem: only what changed, one call each, as the web.
    /// The list is fetched again either way, as part may have been saved.
    func save(
        _ group: CasyAPI.Group, name: String, description: String, picture: PictureChange
    ) async throws {
        defer {
            Task {
                await load()
                changed()
            }
        }
        let api = try await signedIn(CasyStrings.groupRenameFailed)
        if name != group.name {
            groups = try await api.renameGroup(group.id, to: name, errorMessage: CasyStrings.groupRenameFailed)
        }
        if description != (group.description ?? "") {
            groups = try await api.describeGroup(
                group.id, as: description, errorMessage: CasyStrings.groupDescribeFailed)
        }
        switch picture {
        case .keep: break
        case .set(let jpeg):
            _ = try await api.setGroupPicture(group.id, jpeg, errorMessage: CasyStrings.picturesSaveFailed)
        case .remove:
            try await api.removeGroupPicture(group.id, errorMessage: CasyStrings.picturesRemoveFailed)
        }
    }

    /// A report to us (#142), then blocking the member and leaving the group
    /// if those were switched on, in that order, as the web.
    func report(
        _ target: ReportTarget, reason: String, note: String, block member: String?,
        leave group: CasyAPI.Group?
    ) async throws {
        let api = try await signedIn(CasyStrings.reportFailed)
        try await api.report(target, reason: reason, note: note, errorMessage: CasyStrings.reportFailed)
        if let member {
            _ = try await api.blockPerson(member, errorMessage: CasyStrings.invitationsBlockFailed)
            changed()
        }
        if let group { try await remove(group, forAll: false) }
    }

    /// Yes: returns once you are in the group, throws with words to show.
    func accept(_ invitation: Invitation) async throws {
        let api = try await signedIn(CasyStrings.invitationsAnswerFailed)
        do {
            let answer = try await api.acceptInvitation(
                invitation.groupId, errorMessage: CasyStrings.invitationsAnswerFailed)
            if let joined = answer.groups { groups = joined }
            setInvitations(answer.invitations ?? invitationsWithout(invitation))
            changed()
        } catch {
            await load()  // gone meanwhile (deleted, say): the fresh list drops it
            throw error
        }
    }

    func decline(_ invitation: Invitation) async throws {
        let api = try await signedIn(CasyStrings.invitationsAnswerFailed)
        do {
            setInvitations(
                try await api.declineInvitation(
                    invitation.groupId, errorMessage: CasyStrings.invitationsAnswerFailed))
            changed()
        } catch {
            await load()
            throw error
        }
    }

    /// Blocks whoever sent it (#142): the invitation is declined, and none come from them again.
    func blockSender(of invitation: Invitation) async throws {
        let api = try await signedIn(CasyStrings.invitationsBlockFailed)
        let answer = try await api.blockInvitationSender(
            invitation.groupId, errorMessage: CasyStrings.invitationsBlockFailed)
        setInvitations(answer.invitations ?? invitationsWithout(invitation))
        changed()
    }

    /// The client, or the screen's own words when the page hasn't lent a login.
    private func signedIn(_ message: String) async throws -> EdgeFunctions {
        if let api = await Native.api() { return api }
        throw NotSignedIn(errorDescription: message)
    }

    private func invitationsWithout(_ invitation: Invitation) -> [Invitation] {
        invitations.filter { $0.groupId != invitation.groupId }
    }

    private func setInvitations(_ list: [Invitation]) {
        invitations = list
        ProfileModel.shared.invitations = list.count
    }

    private func changed() { ProfileModel.shared.onChange?() }
}

/// What Rediger gruppe does with the picture: leaves it, sets a new one, or takes it away.
enum PictureChange: Equatable {
    case keep
    case set(String)
    case remove
}

private struct NotSignedIn: LocalizedError {
    let errorDescription: String?
}

/// Grupper (#198), pushed inside the Profil sheet: the invitations waiting for
/// an answer, then your groups (`PhoneGroupsContent` on the web), and making
/// a new one.
struct GroupsScreen: View {
    let leave: (LeavingProfile) -> Void

    private let model = GroupsModel.shared
    @Environment(\.closeSheet) private var closeSheet
    @State private var asking: CasyAPI.Group?
    @State private var making = false

    var body: some View {
        List {
            if !model.invitations.isEmpty {
                Section(CasyStrings.invitationsTitle) {
                    ForEach(Array(model.invitations.enumerated()), id: \.element.id) { i, invitation in
                        NavigationLink {
                            InvitationScreen(invitation: invitation, index: i, leave: leave)
                        } label: {
                            ListAvatarRow(
                                invitation.groupName,
                                detail: [invitation.invitedBy, CasyStrings.members(invitation.memberCount)]
                                    .compactMap { $0 }.joined(separator: " · "),
                                index: i, url: invitation.pictureUrl.flatMap(URL.init(string:)))
                        }
                    }
                }
            }
            Section {
                yourGroups
            } header: {
                Text(CasyStrings.groupsYours)
            } footer: {
                if model.groups?.isEmpty == true { Text(CasyStrings.groupsEmpty) }
            }
        }
        .casyPushedBar(CasyStrings.groupsTitle, close: CasyStrings.done, action: closeSheet)
        .task { await model.load() }
        .refreshable { await model.load() }
        .sheet(isPresented: $making) {
            NewGroupSheet()
                .nativeSheetLook(NativePreferences.shared)
        }
        .confirmationDialog(
            asking.map { CasyStrings.groupsDeleteConfirm($0.name, members: $0.members.count) } ?? "",
            isPresented: Binding(get: { asking != nil }, set: { if !$0 { asking = nil } }),
            titleVisibility: .visible,
            presenting: asking
        ) { group in
            Button(CasyStrings.groupsDelete, role: .destructive) { model.leaveOrDelete(group) }
            Button(CasyStrings.cancel, role: .cancel) {}
        }
    }

    @ViewBuilder private var yourGroups: some View {
        if let groups = model.groups {
            ForEach(Array(groups.enumerated()), id: \.element.id) { i, group in
                groupRow(group, index: i)
            }
            if let failure = model.failure { Notice(failure, tone: .error, bare: true) }
        } else if model.loadFailed {
            Notice(CasyStrings.groupsLoadFailed, tone: .error, bare: true)
        } else {
            HStack(spacing: 8) {
                ProgressView().controlSize(.small)
                Text(CasyStrings.groupsLoading)
                    .font(.subheadline)
                    .foregroundStyle(Theme.mutedForeground.color)
            }
        }
        Button {
            making = true
        } label: {
            ListRow(CasyStrings.groupsMake, systemImage: "plus", tone: .primary)
                .contentShape(Rectangle())
        }
    }

    /// Opens the group's screen; swiped left, leaves or deletes it, as on the web (#223).
    private func groupRow(_ group: CasyAPI.Group, index: Int) -> some View {
        let busy = model.working.contains(group.id)
        let swipe = model.swipe(for: group)
        return NavigationLink {
            GroupScreen(groupId: group.id)
        } label: {
            ListAvatarRow(
                group.name,
                detail: memberLine(
                    group.members.map { (name: $0.name, isYou: $0.isYou) }, you: CasyStrings.groupsYou),
                index: index, url: group.pictureUrl.flatMap(URL.init(string:))
            ) {
                if busy { ProgressView().controlSize(.small) }
            }
            .contentShape(Rectangle())
        }
        .disabled(busy)
        // Not .destructive: the row stays until the server has said yes.
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            Button(swipe == .leave ? CasyStrings.groupsLeave : CasyStrings.groupsDelete) {
                if swipe == .deleteForAll { asking = group } else { model.leaveOrDelete(group) }
            }
            .tint(Theme.red600.color)
        }
    }
}

/// An invitation by name (#224), pushed from its row: the invite page's
/// contents. Joining closes the sheet, as Færdig does (#230); declining or
/// blocking goes back to Grupper.
struct InvitationScreen: View {
    let invitation: Invitation
    let index: Int
    let leave: (LeavingProfile) -> Void

    private enum Answer { case join, decline, block }

    private let model = GroupsModel.shared
    @Environment(\.dismiss) private var dismiss
    @Environment(\.closeSheet) private var closeSheet
    @State private var answering: Answer?
    @State private var failure: String?
    @State private var about = false
    @State private var blockAfterAbout = false
    @State private var blocking = false

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                Avatar(
                    name: invitation.groupName, index: index, size: .hero,
                    url: invitation.pictureUrl.flatMap(URL.init(string:)))
                Text(
                    invitation.invitedBy.map(CasyStrings.invitationsInvitedBy)
                        ?? CasyStrings.invitationsInvitedTo
                )
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Theme.mutedForeground.color)
                .padding(.top, 20)
                Text(invitation.groupName)
                    .font(.title.bold())
                    .foregroundStyle(Theme.foreground.color)
                    .padding(.top, 2)
                if let description = invitation.groupDescription, !description.isEmpty {
                    Text(description)
                        .font(.subheadline)
                        .foregroundStyle(Theme.foreground.color)
                        .padding(.top, 8)
                }
                HStack(spacing: 6) {
                    Text(CasyStrings.invitationsMembersSoFar(invitation.memberCount))
                    aboutButton
                }
                .font(.footnote)
                .foregroundStyle(Theme.mutedForeground.color)
                .padding(.top, 8)
                if let failure {
                    Notice(failure, tone: .error, bare: true).padding(.top, 16)
                }
            }
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 24)
            .padding(.vertical, 40)
        }
        .background(Theme.background.color)
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 8) {
                FlowButton(kind: .solid, busy: answering == .join) {
                    answer(.join)
                } label: {
                    Text(CasyStrings.invitationsJoin)
                }
                FlowButton(kind: .quiet, busy: answering == .decline) {
                    answer(.decline)
                } label: {
                    Text(CasyStrings.invitationsNoThanks)
                }
            }
            .disabled(answering != nil)
            .padding(.horizontal, 16)
            .padding(.bottom, 8)
        }
        .casyPushedBar(CasyStrings.invitationsTitle, close: CasyStrings.done, action: closeSheet)
        // The question waits for the ? panel to have gone: two can't show at once.
        .onChange(of: about) { _, open in
            if !open, blockAfterAbout {
                blockAfterAbout = false
                blocking = true
            }
        }
        .confirmationDialog(
            invitation.invitedBy.map(CasyStrings.invitationsBlockConfirm) ?? "",
            isPresented: $blocking, titleVisibility: .visible
        ) {
            Button(CasyStrings.invitationsBlock, role: .destructive) { answer(.block) }
            Button(CasyStrings.cancel, role: .cancel) {}
        }
    }

    /// What joining shares, behind the ?, and blocking the sender under it.
    private var aboutButton: some View {
        Button {
            about = true
        } label: {
            Image(systemName: "questionmark.circle")
                .foregroundStyle(Theme.primary.color)
                .frame(minWidth: 44, minHeight: 44)
                .contentShape(Rectangle())
        }
        .accessibilityLabel(CasyStrings.invitationsAbout)
        .popover(isPresented: $about) {
            VStack(alignment: .leading, spacing: 16) {
                Text(CasyStrings.invitationsPrivacy)
                    .font(.subheadline)
                    .foregroundStyle(Theme.foreground.color)
                    .fixedSize(horizontal: false, vertical: true)
                if invitation.invitedBy != nil {
                    Button(CasyStrings.invitationsBlockSender) {
                        blockAfterAbout = true
                        about = false
                    }
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.red600.color)
                    .disabled(answering != nil)
                }
            }
            // Read as a paragraph, not centred like the screen under it.
            .multilineTextAlignment(.leading)
            .padding(20)
            .frame(idealWidth: 320)
            .presentationCompactAdaptation(.popover)
        }
    }

    private func answer(_ answer: Answer) {
        answering = answer
        failure = nil
        Task {
            defer { answering = nil }
            do {
                switch answer {
                case .join:
                    try await model.accept(invitation)
                    leave(.joined)
                case .decline:
                    try await model.decline(invitation)
                    dismiss()
                case .block:
                    try await model.blockSender(of: invitation)
                    dismiss()
                }
            } catch {
                failure = error.localizedDescription
            }
        }
    }
}
