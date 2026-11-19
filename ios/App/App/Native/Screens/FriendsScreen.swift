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
    private var people: [KnownPerson] { model.people() }

    /// The web's FriendsContent (#281): one CardList, Tilføj en ven first
    /// (user-plus, orange), then each person led by their 40 point picture,
    /// where from under the name, and Fjern (13 medium muted) at the end for
    /// someone from a group since gone; the footnote under it.
    var body: some View {
        let everyone = people
        ScrollView {
            VStack(spacing: 0) {
                CardList(footnote: everyone.isEmpty ? CasyStrings.friendsEmpty : CasyStrings.friendsNote) {
                    Button {
                        adding = true
                    } label: {
                        CardRow(CasyStrings.friendLinkAdd, icon: "user-plus", tone: .primary)
                    }
                    .buttonStyle(.cardRow)
                    ForEach(Array(everyone.enumerated()), id: \.element.id) { i, person in
                        CardRow(
                            person.name,
                            detail: person.groupNames.isEmpty
                                ? CasyStrings.inviteFromPast
                                : CasyStrings.inviteFrom(person.groupNames.joined(separator: ", "))
                        ) {
                            Avatar(
                                name: person.name, index: i, size: .row,
                                url: person.avatarUrl.flatMap(URL.init(string:)))
                        } trailing: {
                            // Only a friend from a group since gone: anyone else would come back.
                            if person.groupNames.isEmpty {
                                Button(CasyStrings.friendsRemove) { removing = person }
                                    .buttonStyle(.plain)
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundStyle(Theme.mutedForeground.color)
                                    .frame(minWidth: 44, minHeight: 44, alignment: .trailing)
                                    .contentShape(Rectangle())
                                    .accessibilityLabel("\(CasyStrings.friendsRemove) \(person.name)")
                            }
                        }
                    }
                }
                if let failure {
                    Notice(failure, tone: .error, bare: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 12)
                }
            }
            .disabled(working)
            .padding(.horizontal, 16)
            .padding(.bottom, 16)
        }
        .accessibilityIdentifier("friends.list")
        .casyPushedBar(CasyStrings.profileFriends, close: CasyStrings.done, action: closeSheet)
        .task {
            async let groups: Void = model.load()
            async let friends: Void = model.loadFriends()
            _ = await (groups, friends)
        }
        .refreshable { await model.loadFriends() }
        .askFirst(
            isPresented: Binding(get: { removing != nil }, set: { if !$0 { removing = nil } }), presenting: removing,
            words: { AskWords(message: CasyStrings.friendsRemoveAsk($0.name), confirm: CasyStrings.friendsRemove) }
        ) { remove($0) }
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
