import CasyAPI
import CasyUI
import SafariServices
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
    private(set) var failure: String?
    private(set) var saving = false

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

/// A page of casy.app, in the browser's sheet.
private struct WebPage: Identifiable {
    let url: URL
    var id: URL { url }
}

private struct SafariView: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        SFSafariViewController(url: url)
    }

    func updateUIViewController(_ controller: SFSafariViewController, context: Context) {}
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
    @State private var page: WebPage?
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
                    site(CasyStrings.profileSupport, "lifepreserver", "support")
                    site(CasyStrings.profileHowItWorks, "questionmark.circle", "how-it-works")
                    site(CasyStrings.profileTerms, "doc.text", "terms")
                    site(CasyStrings.profilePrivacy, "lock", "privacy")
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
            .buttonStyle(.plain)
            .task { await model.load() }
            .navigationTitle(CasyStrings.profileTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(CasyStrings.done, action: onDone)
                }
            }
            .sheet(item: $page) { SafariView(url: $0.url).ignoresSafeArea() }
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

    /// Who you are; tap to change the name your groups see.
    private var nameCard: some View {
        Section {
            Button {
                newName = name
                renaming = true
            } label: {
                HStack(spacing: 16) {
                    Avatar(
                        name: name, index: 0, size: .large,
                        url: model.whoAmI?.avatarUrl.flatMap(URL.init(string:)))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(name)
                            .font(.title3.bold())
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
            .disabled(model.saving)
            .accessibilityLabel(CasyStrings.profileChangeName)
            .accessibilityValue(name)
            if let failure = model.failure { Notice(failure, tone: .error, bare: true) }
        }
    }

    /// A row whose screen is still the page's: `?profile=<screen>`.
    private func handOver(
        _ label: String, _ icon: String, _ screen: String, badge: Int = 0,
        tone: RowTone = .standard
    ) -> some View {
        Button {
            leave(.webScreen("/?profile=\(screen)"))
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

    /// A page of casy.app, in Casy's language.
    private func site(_ label: String, _ icon: String, _ path: String) -> some View {
        Button {
            var address = Self.site.appendingPathComponent(path).absoluteString
            if preferences.lang == "en" { address += "?lang=en" }
            page = URL(string: address).map(WebPage.init(url:))
        } label: {
            ListRow(label, systemImage: icon)
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
