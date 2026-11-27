import CasyAPI
import CasyUI
import SwiftUI

/// What the Profil list shows. One for the whole launch, so reopening the
/// sheet shows what is known at once; forgotten when the person changes.
@MainActor @Observable
final class ProfileModel {
    static let shared = ProfileModel()

    private(set) var whoAmI: WhoAmI?
    private(set) var email: String?
    /// Who is signed in, for marking "Dig" in admin mode's lists.
    private(set) var userId: String?
    /// The Grupper row's count; Grupper sets it too as invitations are answered.
    var invitations = 0
    private(set) var isAdmin = false
    fileprivate(set) var failure: String?
    private(set) var saving = false
    private(set) var pictureBusy = false

    /// Tells the web view that your name or picture changed, so its own
    /// copies (the groups and events lists) are fetched again.

    func reset() {
        whoAmI = nil
        email = nil
        invitations = 0
        isAdmin = false
        failure = nil
    }

    func load() async {
        let session = await SessionBox.shared.current()
        email = session?.email
        userId = session?.userId
        guard let api = await Native.api() else { return }
        async let who = try? api.whoAmI()
        async let waiting = try? api.invitations()
        async let admin = try? api.isAdmin()
        let (answer, invited, adminAnswer) = await (who, waiting, admin)
        if let answer { whoAmI = answer }
        if let invited { invitations = invited.count }
        if let adminAnswer { isAdmin = adminAnswer }
    }

    /// A yes or a no to the AI saved elsewhere (Dine data): a no stops sharing too.
    func noteAiConsent(_ on: Bool) {
        whoAmI?.aiConsent = on
        if !on { whoAmI?.aiShare = false }
    }

    func rename(to name: String) {
        saving = true
        failure = nil
        Task {
            defer { saving = false }
            do {
                guard let api = await Native.api() else { return }
                let saved = try await api.setDisplayName(
                    name, errorMessage: CasyStrings.profileSetNameFailed)
                whoAmI?.name = saved
                whoAmI?.unnamed = false
            } catch {
                failure = error.localizedDescription
            }
        }
    }
}

extension ProfileModel {
    func setPicture(_ jpeg: String) {
        changePicture(failedWith: CasyStrings.picturesSaveFailed) { api in
            try await api.setAvatar(jpeg, errorMessage: CasyStrings.picturesSaveFailed)
        }
    }

    func removePicture() {
        changePicture(failedWith: CasyStrings.picturesRemoveFailed) { api in
            try await api.removeAvatar(errorMessage: CasyStrings.picturesRemoveFailed)
            return nil
        }
    }

    func unreadable() { failure = CasyStrings.picturesUnreadable }

    private func changePicture(
        failedWith message: String, _ send: @escaping (EdgeFunctions) async throws -> String?
    ) {
        pictureBusy = true
        failure = nil
        Task {
            defer { pictureBusy = false }
            do {
                guard let api = await Native.api() else { return }
                whoAmI?.avatarUrl = try await send(api)
            } catch {
                failure = error.localizedDescription
            }
        }
    }
}

/// How the Profil sheet was left for something only the page can do.
enum LeavingProfile {
    /// The page's own screen at this address.
    case webScreen(String)
    case signOut
    /// Joined a group from its invitation: the sheet closes, as on the web (#230).
    case joined
    /// The account is gone: the page drops its login and says so.
    case accountDeleted
    /// Tilføj til kalender kept something (#200): the month glides to its first day.
    case added(String)
    /// Tid til hinanden's Planlæg (#200): the page opens it with the group and the day.
    case plan
    /// A vote searched again (#240): Find dato, on to the paper pile.
    case findDates
}

/// A screen inside Profil the sheet opens on (#202): where a friend link, an
/// invite for a group you are in, or a notification about a group leads.
enum ProfileStart: Hashable {
    case friends
    case groups
    case group(String)
    /// An invitation to the group, waiting for your answer.
    case invitation(String)
    /// Sikkerhed with the new password's form open (the weak password's note, `/profile/password?password=new`).
    case newPassword

    /// As the bridge's state names it: "friends", "groups", "group:<id>", "invitation:<id>".
    init?(_ text: String?) {
        guard let text else { return nil }
        let parts = text.split(separator: ":", maxSplits: 1).map(String.init)
        switch (parts.first, parts.count) {
        case ("friends", 1): self = .friends
        case ("groups", 1): self = .groups
        case ("group", 2): self = .group(parts[1])
        case ("invitation", 2): self = .invitation(parts[1])
        case ("newPassword", 1): self = .newPassword
        default: return nil
        }
    }

    var text: String {
        switch self {
        case .friends: "friends"
        case .groups: "groups"
        case .group(let id): "group:\(id)"
        case .invitation(let id): "invitation:\(id)"
        case .newPassword: "newPassword"
        }
    }
}

/// The screen Profil opened on, once your groups are known: a group's screen
/// goes straight back without its group, and an invitation is looked up in
/// them. A group and an invitation open over Grupper, the way back the web's
/// leads too (`parentScreen`).
private struct StartScreen: View {
    let start: ProfileStart
    let leave: (LeavingProfile) -> Void

    private let model = GroupsModel.shared
    @State private var ready = false
    @State private var inside: ProfileStart?

    var body: some View {
        ZStack {
            if ready {
                switch start {
                case .friends: FriendsScreen()
                default:
                    GroupsScreen(leave: leave)
                        .navigationDestination(item: $inside) { inner in
                            switch inner {
                            case .invitation(let id):
                                if let i = model.invitations.firstIndex(where: { $0.groupId == id }) {
                                    InvitationScreen(invitation: model.invitations[i], index: i, leave: leave)
                                }
                            case .group(let id): GroupScreen(groupId: id)
                            default: EmptyView()
                            }
                        }
                }
            } else {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .task {
            if model.groups == nil { await model.load() }
            ready = true
            switch start {
            case .group: inside = start
            // Answered already, here or on another phone: Grupper, where it went.
            case .invitation(let id) where model.invitations.contains(where: { $0.groupId == id }): inside = start
            default: break
            }
        }
    }
}

/// The Profil list as a native screen (#198), `ProfileHubList` on the web.
/// Rows whose screens aren't native yet hand over to the page's own.
struct ProfileScreen: View {
    let preferences: NativePreferences
    let build: String
    let userAgent: String
    let onChoose: (_ lang: String, _ theme: String) -> Void
    let onDone: () -> Void
    let enablePush: () async -> String
    let leave: (LeavingProfile) -> Void
    /// Opened on one of its screens, the list under it to go back to.
    var start: ProfileStart?

    private let model = ProfileModel.shared
    /// What "Del appen" sends, as the web app does (shareAppUrl, #271).
    private static let site = URL(string: "https://vifinderligeendag.dk/app")!
    /// The App Store's page for writing a review (the web's WRITE_REVIEW, #256).
    private static let writeReview = URL(
        string: "itms-apps://apps.apple.com/app/id6830713238?action=write-review")!
    private static let feedbackEmail = "asbjornbay@gmail.com"
    private static let maxNameLength = 40

    @Environment(\.openURL) private var openURL
    @State private var renaming = false
    @State private var opened: ProfileStart?
    @State private var startedOn = false
    @State private var newName = ""

    private var name: String { model.whoAmI?.name ?? model.email ?? "" }
    private var release: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? ""
    }

    var body: some View {
        NavigationStack {
            // The web's ProfileHubList, drawn as the web draws it (#281): cards
            // in the sheet's own scrolling, px-4, the build line at the end.
            ScrollView {
                VStack(spacing: 0) {
                    nameCard
                    CardList {
                        link(SettingsList(
                            preferences: preferences, onChoose: onChoose, onDone: onDone,
                            enablePush: enablePush, pushed: true)
                        ) {
                            CardRow(
                                CasyStrings.settingsTitle, icon: "settings",
                                value: preferences.lang == "da" ? "Dansk" : "English", chevron: true)
                        }
                        .accessibilityIdentifier("profile.settings")
                        link(GroupsScreen(leave: leave)) {
                            CardRow(CasyStrings.profileGroups, icon: "users", chevron: true) {
                                CardRowCount(model.invitations)
                            }
                        }
                        .accessibilityIdentifier("profile.groups")
                        link(FriendsScreen()) {
                            CardRow(CasyStrings.profileFriends, icon: "contact", chevron: true)
                        }
                    }
                    CardList {
                        link(SecurityScreen(email: model.email ?? "", name: name, signedOutEverywhere: onDone)) {
                            CardRow(CasyStrings.profileSecurity, icon: "key-round", chevron: true)
                        }
                        .accessibilityIdentifier("profile.security")
                        if model.isAdmin {
                            link(AdminScreen(enablePush: enablePush)) {
                                CardRow(CasyStrings.profileAdmin, icon: "shield-check", chevron: true)
                            }
                        }
                    }
                    CardList {
                        Button(action: sendFeedback) {
                            CardRow(CasyStrings.profileFeedback, icon: "message-square")
                        }
                        .buttonStyle(.cardRow)
                        // The preview given here: without one, iOS fetches the page
                        // first, which held up the share sheet the first time.
                        ShareLink(
                            item: Self.site, subject: Text(CasyStrings.appName),
                            message: Text(CasyStrings.profileShareText),
                            preview: SharePreview(CasyStrings.appName, image: Image("ShareIcon"))
                        ) {
                            CardRow(CasyStrings.profileShare, icon: "share")
                        }
                        .buttonStyle(.cardRow)
                        // The App Store's own page for a review (#256), never Safari.
                        Button {
                            openURL(Self.writeReview)
                        } label: {
                            CardRow(CasyStrings.profileRate, icon: "star")
                        }
                        .buttonStyle(.cardRow)
                    }
                    CardList {
                        link(MyDataScreen(leave: leave)) {
                            CardRow(CasyStrings.profileMyData, icon: "database", chevron: true)
                        }
                        page(CasyStrings.profileSupport, "life-buoy", .support)
                        page(CasyStrings.profileHowItWorks, "circle-question-mark", .howItWorks)
                        page(CasyStrings.profileTerms, "file-text", .terms)
                        page(CasyStrings.profilePrivacy, "lock", .privacy(section: nil))
                    }
                    CardList {
                        Button {
                            leave(.signOut)
                        } label: {
                            CardRow(CasyStrings.profileSignOut, icon: "log-out")
                        }
                        .buttonStyle(.cardRow)
                        link(DeleteAccountScreen(leave: leave)) {
                            CardRow(
                                CasyStrings.profileDeleteAccount, icon: "trash", tone: .danger,
                                chevron: true)
                        }
                    }
                    // BuildLine: mt-6, 12 muted, in the middle.
                    Text(verbatim: "\(CasyStrings.appName) \(release) · \(build)")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.mutedForeground.color)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 24)
                }
                .padding(.horizontal, 16)
                // Nothing above the name card: the system's bar ends about 12
                // points under its Færdig capsule, the web's header's mb-3. The
                // capsule is taller than the web's plain Færdig, so the card
                // stands about 11 points lower than the web's (tucked up under
                // the bar to match, the capsule touched it, 18 Nov 2026).
                .padding(.top, 0)
                .padding(.bottom, 16)
            }
            .accessibilityIdentifier("profile.list")
            .task { await model.load() }
            .casySheetBar(CasyStrings.profileTitle, close: CasyStrings.done, action: onDone)
            .alert(CasyStrings.profileChangeName, isPresented: $renaming) {
                TextField(CasyStrings.profileChangeName, text: $newName)
                Button(CasyStrings.cancel, role: .cancel) {}
                Button(CasyStrings.save) {
                    let trimmed = newName.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !trimmed.isEmpty, trimmed != name {
                        model.rename(to: String(trimmed.prefix(Self.maxNameLength)))
                    }
                }
            }
            .navigationDestination(item: $opened) { start in
                if start == .newPassword {
                    SecurityScreen(email: model.email ?? "", name: name, signedOutEverywhere: onDone, newPassword: true)
                } else {
                    StartScreen(start: start, leave: leave)
                }
            }
            .onAppear {
                guard !startedOn else { return }
                startedOn = true
                opened = start
            }
        }
        // Every screen pushed inside keeps Færdig on the right (design rule 11).
        .environment(\.closeSheet, onDone)
        .nativeSheetLook(preferences)
    }

    /// A row that pushes `screen` inside the sheet.
    private func link<Screen: View, Row: View>(
        _ screen: Screen, @ViewBuilder row: () -> Row
    ) -> some View {
        NavigationLink {
            screen
        } label: {
            row()
        }
        .buttonStyle(.cardRow)
    }

    /// Who you are (the web's NameCard): rounded-2xl, 1 border, bg-card, p-4,
    /// gap-4. The picture (56, "lg") with the camera badge, tap it to pick
    /// another; the name (18 bold, leading-tight) over the email (14 muted),
    /// a 16 point pencil 12 points after them, tap them to rename; "Fjern
    /// billede" (13 medium, orange, mt-1) under them when there is a picture.
    private var nameCard: some View {
        HStack(spacing: 16) {
            PictureMenu(
                hasPicture: model.whoAmI?.avatarUrl != nil,
                addLabel: CasyStrings.picturesAdd,
                changeLabel: CasyStrings.picturesChange,
                onPicked: model.setPicture,
                onRemove: model.removePicture,
                onUnreadable: model.unreadable
            ) {
                Avatar(
                    name: name, index: 0, size: .large,
                    url: model.whoAmI?.avatarUrl.flatMap(URL.init(string:))
                )
                // PictureButton's badge: 24, -bottom-0.5 -right-0.5, a 2 point
                // ring in the card's colour, bg-secondary, a 14 point camera.
                .overlay(alignment: .bottomTrailing) {
                    ZStack {
                        Circle().fill(Theme.secondary.color)
                        Circle().strokeBorder(Theme.card.color, lineWidth: 2)
                        Group {
                            if model.pictureBusy {
                                ProgressView().controlSize(.mini)
                            } else {
                                LucideIcon("camera", size: 14)
                            }
                        }
                        .foregroundStyle(Theme.foreground.color)
                    }
                    .frame(width: 24, height: 24)
                    .offset(x: 2, y: 2)
                }
            }
            .buttonStyle(.plain)
            .disabled(model.pictureBusy)
            VStack(alignment: .leading, spacing: 0) {
                Button {
                    newName = name
                    renaming = true
                } label: {
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 0) {
                            Text(name)
                                .font(.system(size: 18, weight: .bold))
                                .foregroundStyle(Theme.foreground.color)
                                .lineLimit(1)
                            // When the email is already the name, it would only repeat it.
                            if let email = model.email, email != name {
                                Text(email)
                                    .font(.system(size: 14))
                                    .foregroundStyle(Theme.mutedForeground.color)
                                    .lineLimit(1)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        LucideIcon("pencil", size: 16)
                            .foregroundStyle(Theme.mutedForeground.color)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(model.saving)
                .accessibilityLabel(CasyStrings.profileChangeName)
                .accessibilityValue(name)
                if model.whoAmI?.avatarUrl != nil {
                    Button(CasyStrings.picturesRemove, action: model.removePicture)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Theme.primary.color)
                        .buttonStyle(.plain)
                        .disabled(model.pictureBusy)
                        .padding(.top, 4)
                }
                if let failure = model.failure {
                    Text(failure)
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.red600.color)
                        .padding(.top, 4)
                }
            }
        }
        // p-4 inside a 1 point border.
        .padding(17)
        .background(Theme.card.color, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(Theme.border.color, lineWidth: 1)
        }
    }

    /// A help page, pushed inside the sheet.
    private func page(_ label: String, _ icon: String, _ link: PageLink) -> some View {
        self.link(PageScreen(page: link, leave: leave)) {
            CardRow(label, icon: icon, chevron: true)
        }
    }

    /// An email with the build and device at the bottom, as the web's.
    private func sendFeedback() {
        let text =
            "\(CasyStrings.profileFeedbackPrompt)\n\n\n\n---\n\(CasyStrings.appName) \(release) · \(build) (app)\n\(userAgent)"
        // Mail apps read "+" as a plus sign, and "&" would end the field.
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-._~")
        func encoded(_ value: String) -> String {
            value.addingPercentEncoding(withAllowedCharacters: allowed) ?? ""
        }
        let subject = encoded(CasyStrings.profileFeedbackSubject)
        if let url = URL(
            string: "mailto:\(Self.feedbackEmail)?subject=\(subject)&body=\(encoded(text))")
        {
            openURL(url)
        }
    }
}
