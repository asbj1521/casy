import CasyAPI
import CasyCore
import CasyUI
import SwiftUI

/// How the friend link's page was left.
enum FriendLinkOutcome {
    /// Friends now: on to Venner in the Profil sheet, as the web goes to its friends screen.
    case added
    /// Signed out, Bliv venner: an account first, then straight back in.
    case signUp
    /// Hjem, or Find en dag under a link that no longer works.
    case home
}

/// The page a friend link lands on (#226), the web's FriendLink on a phone:
/// laid out as an invite's (JoinScreen, InviteScreen.tsx), who is asking and
/// the one answer, tapping it being the yes. Shown before signing in: the link
/// is all that proves you were meant to see who made it.
struct FriendLinkScreen: View {
    let preferences: NativePreferences
    let token: String
    let signedIn: Bool
    /// Back from making the account, having said yes before: friends at once.
    let autoAdd: Bool
    let onChoose: (_ lang: String, _ theme: String) -> Void
    let finish: (FriendLinkOutcome) -> Void

    private enum Load {
        case loading
        case shown(FriendPreview.Person)
        case broken(String)
    }

    @State private var load: Load = .loading
    @State private var adding = false
    @State private var failure: String?
    @State private var about = false
    @ScaledMetric(relativeTo: .body) private var answerHeight: CGFloat = 56

    /// The web's InviteShell, as JoinScreen draws it.
    var body: some View {
        VStack(spacing: 0) {
            header
            GeometryReader { outer in
                ScrollView {
                    content
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                        .padding(.horizontal, 24)
                        .padding(.top, 16)
                        .padding(.bottom, max(0, 24 - outer.safeAreaInsets.bottom))
                        .frame(minHeight: outer.size.height)
                }
                .scrollBounceBehavior(.basedOnSize)
            }
        }
        .background(Theme.background.color.ignoresSafeArea())
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("friendLink.screen")
        .nativeSheetLook(preferences)
        .task { await open() }
    }

    /// Signed in, "‹ Hjem"; signed out, only the language (the web's TopNav).
    private var header: some View {
        HStack(spacing: 0) {
            if signedIn {
                Button { finish(.home) } label: {
                    HStack(spacing: 0) {
                        LucideIcon("chevron-left", size: 24)
                        Text(CasyStrings.joinHome).font(.system(size: 15))
                    }
                    .foregroundStyle(Theme.primary.color)
                    .padding(.vertical, 4)
                    .padding(.trailing, 8)
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("friendLink.home")
                Spacer()
            } else {
                Spacer()
                LanguageSwitch(lang: preferences.lang) { lang in
                    preferences.lang = lang
                    onChoose(lang, preferences.theme)
                }
            }
        }
        .padding(.horizontal, signedIn ? 8 : 16)
        .frame(height: 48)
    }

    @ViewBuilder private var content: some View {
        switch load {
        case .loading:
            HStack(spacing: 12) {
                ProgressView()
                Text(CasyStrings.joinOpening).cssLineHeight(24, size: 16)
            }
            .font(.system(size: 16))
            .foregroundStyle(Theme.mutedForeground.color)
        case .broken(let reason):
            broken(reason)
        case .shown(let friend):
            details(friend)
        }
    }

    /// The web's FriendLink: the picture (112, shadow-sm), who asks (20 under,
    /// 28 bold, leading-tight), what for (8 under, 13 muted) with the ? beside
    /// it; signed out what we are (16 under, 15); 32 under it the answer.
    private func details(_ friend: FriendPreview.Person) -> some View {
        VStack(spacing: 0) {
            Avatar(name: friend.name ?? "?", index: 0, size: .hero, url: friend.avatarUrl.flatMap(URL.init(string:)))
                .shadow(color: .black.opacity(0.05), radius: 1, y: 1)
            Text(friend.name.map(CasyStrings.friendLinkAsks) ?? CasyStrings.friendLinkAsksAnon)
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(Theme.foreground.color)
                .cssLineHeight(35, size: 28)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 20)
            HStack(spacing: 8) {
                Text(CasyStrings.friendLinkDetail)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.mutedForeground.color)
                aboutButton
            }
            .padding(.top, 8)
            if !signedIn {
                Text(CasyStrings.joinWhatIsCasy)
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.foreground.color)
                    .cssLineHeight(22.5, size: 15)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 16)
            }
            VStack(spacing: 8) {
                answer
                if let failure { Notice(failure, tone: .error, bare: true).padding(.top, 4) }
            }
            .padding(.top, 32)
        }
    }

    /// The web's InviteAction: the one solid orange answer, h-14, 17 bold white.
    private var answer: some View {
        Button {
            if signedIn { add() } else { finish(.signUp) }
        } label: {
            HStack(spacing: 8) {
                if adding { ProgressView().tint(.white) }
                Text(CasyStrings.friendLinkAccept)
            }
            .font(.system(size: 17, weight: .bold))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: answerHeight)
            .background(Theme.cta.color, in: Capsule())
            .contentShape(Capsule())
            .opacity(adding ? 0.6 : 1)
        }
        .buttonStyle(.plain)
        .disabled(adding)
        .accessibilityIdentifier("friendLink.answer")
    }

    /// What being friends means, behind the ? (the web's HelpButton).
    private var aboutButton: some View {
        Button {
            about = true
        } label: {
            LucideIcon("circle-question-mark", size: 20)
                .foregroundStyle(Theme.primary.color)
                .frame(width: 20, height: 20)
                .contentShape(Rectangle().inset(by: -12))
        }
        .accessibilityLabel(CasyStrings.friendLinkAbout)
        .popover(isPresented: $about) {
            Text(CasyStrings.friendLinkPromise)
                .font(.system(size: 15))
                .foregroundStyle(Theme.foreground.color)
                .fixedSize(horizontal: false, vertical: true)
                .multilineTextAlignment(.leading)
                .padding(20)
                .frame(idealWidth: 320)
                .presentationCompactAdaptation(.popover)
        }
    }

    /// The web's InviteBroken, as the invite's.
    private func broken(_ reason: String) -> some View {
        VStack(spacing: 0) {
            LucideIcon("circle-x", size: 48)
                .foregroundStyle(Theme.red600.color)
                .frame(width: 48, height: 48)
            Text(CasyStrings.joinBroken)
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(Theme.foreground.color)
                .cssLineHeight(25.5, size: 17)
                .padding(.top, 16)
            Text(CasyStrings.joinBrokenBody(reason))
                .font(.system(size: 15))
                .foregroundStyle(Theme.mutedForeground.color)
                .cssLineHeight(22.5, size: 15)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 8)
            Button { finish(.home) } label: {
                Text(CasyStrings.joinGoToCasy)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.primary.color)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)
                    .casyGlass(in: Capsule())
                    .contentShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("friendLink.home")
            .padding(.top, 24)
        }
    }

    private func open() async {
        guard let api = await Native.publicApi() else {
            load = .broken(CasyStrings.friendLinkFailed)
            return
        }
        do {
            load = .shown(try await api.previewFriend(token, errorMessage: CasyStrings.friendLinkFailed).friend)
            if autoAdd, signedIn { add() }
        } catch {
            load = .broken(error.localizedDescription)
        }
    }

    private func add() {
        adding = true
        failure = nil
        Task {
            defer { adding = false }
            do {
                guard let api = await Native.api() else { throw APIError.unreadable(CasyStrings.friendLinkFailed) }
                GroupsModel.shared.friendsAdded(try await api.addFriend(token, errorMessage: CasyStrings.friendLinkFailed))
                finish(.added)
            } catch {
                failure = error.localizedDescription
            }
        }
    }
}
