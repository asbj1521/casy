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
    private(set) var invitations = 0
    private(set) var isAdmin = false
    fileprivate(set) var failure: String?
    private(set) var saving = false
    private(set) var pictureBusy = false

    /// Tells the web view that your name or picture changed, so its own
    /// copies (the groups and events lists) are fetched again.
    var onChange: (() -> Void)?

    func reset() {
        whoAmI = nil
        email = nil
        invitations = 0
        isAdmin = false
        failure = nil
    }

    func load() async {
        email = await SessionBox.shared.current()?.email
        guard let api = await Native.api() else { return }
        async let who = try? api.whoAmI()
        async let waiting = try? api.invitations()
        async let admin = try? api.isAdmin()
        let (answer, invited, adminAnswer) = await (who, waiting, admin)
        if let answer { whoAmI = answer }
        if let invited { invitations = invited.count }
        if let adminAnswer { isAdmin = adminAnswer }
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
                onChange?()
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
                onChange?()
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

    private let model = ProfileModel.shared
    private static let site = URL(string: "https://casy.app")!
    private static let feedbackEmail = "asbjornbay@gmail.com"
    private static let maxNameLength = 40

    @Environment(\.openURL) private var openURL
    @State private var renaming = false
    @State private var newName = ""

    private var name: String { model.whoAmI?.name ?? model.email ?? "" }
    private var release: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? ""
    }

    var body: some View {
        NavigationStack {
            List {
                nameCard
                Section {
                    NavigationLink {
                        SettingsList(
                            preferences: preferences, onChoose: onChoose, onDone: onDone,
                            enablePush: enablePush)
                    } label: {
                        ListRow(
                            CasyStrings.settingsTitle, systemImage: "gearshape",
                            value: preferences.lang == "da" ? "Dansk" : "English")
                    }
                    handOver(
                        CasyStrings.profileGroups, "person.2", "groups",
                        badge: model.invitations)
                    handOver(CasyStrings.profileFriends, "person.crop.square", "friends")
                }
                Section {
                    handOver(CasyStrings.profileSecurity, "key", "password")
                    if model.isAdmin {
                        handOver(CasyStrings.profileAdmin, "checkmark.shield", "admin")
                    }
                }
                Section {
                    Button(action: sendFeedback) {
                        ListRow(CasyStrings.profileFeedback, systemImage: "bubble.left")
                    }
                    ShareLink(
                        item: Self.site, subject: Text("Casy"),
                        message: Text(CasyStrings.profileShareText)
                    ) {
                        ListRow(CasyStrings.profileShare, systemImage: "square.and.arrow.up")
                    }
                }
                Section {
                    handOver(CasyStrings.profileMyData, "cylinder", "data")
                    handOver(CasyStrings.profileSupport, "lifepreserver", to: "/support")
                    handOver(CasyStrings.profileHowItWorks, "questionmark.circle", to: "/how-it-works")
                    handOver(CasyStrings.profileTerms, "doc.text", to: "/terms")
                    handOver(CasyStrings.profilePrivacy, "lock", to: "/privacy")
                }
                Section {
                    Button {
                        leave(.signOut)
                    } label: {
                        ListRow(
                            CasyStrings.profileSignOut,
                            systemImage: "rectangle.portrait.and.arrow.right")
                    }
                    handOver(
                        CasyStrings.profileDeleteAccount, "trash", "account", tone: .danger)
                } footer: {
                    Text("Casy \(release) · \(build)")
                        .font(.caption)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 12)
                }
            }
            .task { await model.load() }
            .navigationTitle(CasyStrings.profileTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(CasyStrings.done, action: onDone)
                }
            }
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
        }
        .nativeSheetLook(preferences)
    }

    /// Who you are: tap the picture to pick another, the name to change the
    /// name your groups see. Two buttons in one row, so each borderless.
    private var nameCard: some View {
        Section {
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
                    .overlay(alignment: .bottomTrailing) {
                        ZStack {
                            Circle().fill(Theme.background.color)
                            if model.pictureBusy {
                                ProgressView().controlSize(.mini)
                            } else {
                                Image(systemName: "camera.fill")
                                    .font(.system(size: 11))
                                    .foregroundStyle(Theme.primary.color)
                            }
                        }
                        .frame(width: 24, height: 24)
                        .offset(x: 2, y: 2)
                    }
                }
                .buttonStyle(.borderless)
                .disabled(model.pictureBusy)
                Button {
                    newName = name
                    renaming = true
                } label: {
                    HStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(name)
                            .font(.title3.bold())
                            .foregroundStyle(Theme.foreground.color)
                            .lineLimit(1)
                        // When the email is already the name, it would only repeat it.
                        if let email = model.email, email != name {
                            Text(email)
                                .font(.subheadline)
                                .foregroundStyle(Theme.mutedForeground.color)
                                .lineLimit(1)
                        }
                    }
                    Spacer(minLength: 8)
                    Image(systemName: "pencil")
                        .foregroundStyle(Theme.mutedForeground.color)
                        .accessibilityHidden(true)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.borderless)
                .disabled(model.saving)
                .accessibilityLabel(CasyStrings.profileChangeName)
                .accessibilityValue(name)
            }
            if let failure = model.failure { Notice(failure, tone: .error, bare: true) }
        }
    }

    /// A row whose screen is one of the Profil sheet's, still the page's.
    private func handOver(
        _ label: String, _ icon: String, _ screen: String, badge: Int = 0,
        tone: RowTone = .standard
    ) -> some View {
        handOver(label, icon, to: "/?profile=\(screen)", badge: badge, tone: tone)
    }

    /// A row whose screen is still the page's, inside the app: the app never
    /// leaves for Safari.
    private func handOver(
        _ label: String, _ icon: String, to address: String, badge: Int = 0,
        tone: RowTone = .standard
    ) -> some View {
        Button {
            leave(.webScreen(address))
        } label: {
            HStack(spacing: 8) {
                ListRow(label, systemImage: icon, tone: tone)
                if badge > 0 {
                    Text("\(badge)")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(Theme.primary.color))
                }
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.mutedForeground.color.opacity(0.6))
                    .accessibilityHidden(true)
            }
            .contentShape(Rectangle())
        }
    }

    /// An email with the build and device at the bottom, as the web's.
    private func sendFeedback() {
        let text =
            "\(CasyStrings.profileFeedbackPrompt)\n\n\n\n---\nCasy \(release) · \(build) (app)\n\(userAgent)"
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
