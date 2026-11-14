import CasyAPI
import CasyCore
import CasyUI
import SwiftUI

/// Venner (#198), pushed inside the Profil sheet, as the web's FriendsContent
/// (#227): everyone you share a group with or once did, each with where from.
/// Only someone from a group since gone, or added by link, can be removed:
/// anyone else would be back at the next look. Tilføj en ven sends a link (#226).
struct FriendsScreen: View {
    private let model = GroupsModel.shared
    @Environment(\.closeSheet) private var closeSheet
    @State private var adding = false
    @State private var removing: KnownPerson?
    @State private var working = false
    @State private var failure: String?

    /// Everyone you know: your groups' members and your friends.
    private var people: [KnownPerson] {
        let mine = (model.groups ?? []).map { group in
            GroupMembers(
                id: group.id, name: group.name,
                members: group.members.map {
                    (profileId: $0.profileId, name: $0.name, isYou: $0.isYou, avatarUrl: $0.avatarUrl)
                })
        }
        return knownPeople(
            mine, friends: model.friends.map { (profileId: $0.profileId, name: $0.name, avatarUrl: $0.avatarUrl) })
    }

    var body: some View {
        let everyone = people
        List {
            Section {
                Button {
                    adding = true
                } label: {
                    ListRow(CasyStrings.friendLinkAdd, systemImage: "person.badge.plus", tone: .primary)
                        .contentShape(Rectangle())
                }
                ForEach(Array(everyone.enumerated()), id: \.element.id) { i, person in
                    ListAvatarRow(
                        person.name,
                        detail: person.groupNames.isEmpty
                            ? CasyStrings.inviteFromPast
                            : CasyStrings.inviteFrom(person.groupNames.joined(separator: ", ")),
                        index: i, url: person.avatarUrl.flatMap(URL.init(string:))
                    ) {
                        // Only a friend from a group since gone: anyone else would come back.
                        if person.groupNames.isEmpty {
                            Button(CasyStrings.friendsRemove) { removing = person }
                                .buttonStyle(.borderless)
                                .font(.footnote.weight(.medium))
                                .foregroundStyle(Theme.mutedForeground.color)
                                .frame(minHeight: 44)
                                .accessibilityLabel("\(CasyStrings.friendsRemove) \(person.name)")
                        }
                    }
                }
                if let failure { Notice(failure, tone: .error, bare: true) }
            } footer: {
                Text(everyone.isEmpty ? CasyStrings.friendsEmpty : CasyStrings.friendsNote)
            }
            .disabled(working)
        }
        .casyPushedBar(CasyStrings.profileFriends, close: CasyStrings.done, action: closeSheet)
        .task {
            async let groups: Void = model.load()
            async let friends: Void = model.loadFriends()
            _ = await (groups, friends)
        }
        .refreshable { await model.loadFriends() }
        .confirmationDialog(
            removing.map { CasyStrings.friendsRemoveAsk($0.name) } ?? "",
            isPresented: Binding(get: { removing != nil }, set: { if !$0 { removing = nil } }),
            titleVisibility: .visible, presenting: removing
        ) { person in
            Button(CasyStrings.friendsRemove, role: .destructive) { remove(person) }
            Button(CasyStrings.cancel, role: .cancel) {}
        }
        .sheet(isPresented: $adding) {
            AddFriendSheet()
                .nativeSheetLook(NativePreferences.shared)
        }
    }

    private func remove(_ person: KnownPerson) {
        working = true
        failure = nil
        Task {
            defer { working = false }
            do {
                try await model.removeFriend(person.profileId)
            } catch {
                failure = error.localizedDescription
            }
        }
    }
}

/// Tilføj en ven (#226): the invite sheet's contacts and link, for a friend.
struct AddFriendSheet: View {
    @State private var model = InviteModel.forFriend()

    var body: some View {
        NavigationStack {
            InviteContent(model: model, onSent: nil)
        }
    }
}
