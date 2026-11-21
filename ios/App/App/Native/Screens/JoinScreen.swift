import CasyAPI
import CasyCore
import CasyUI
import SwiftUI

/// What the invite page hands back to the page when it leaves (#282).
enum JoinOutcome {
    /// Joined: the page goes home, and it is the moment to offer notifications.
    case joined
    /// Already a member: into the group itself, in the Profil sheet.
    case group(String)
    /// Signed out, Bliv medlem: an account first, then straight back in.
    case signUp
    /// Hjem, or Find en dag under a link that no longer works.
    case home
}

/// The page an invite link lands on, as the web's JoinGroup on a phone
/// (`PhoneJoin`, InviteScreen.tsx, #224): what you are joining and who else
/// is in it, shown before signing in (the link is all that proves you were
/// meant to see it), then the one answer. Signed out it says in one line what
/// we are, and Bliv medlem makes the account first and comes back joining
/// (`autoJoin`, the web's `?join=1`).
struct JoinScreen: View {
    let preferences: NativePreferences
    let token: String
    let signedIn: Bool
    /// Back from making the account, having said yes before: joined at once.
    let autoJoin: Bool
    let onChoose: (_ lang: String, _ theme: String) -> Void
    let finish: (JoinOutcome) -> Void

    private enum Load {
        case loading
        case shown(InvitePreview.InvitedGroup, alreadyIn: Bool)
        case broken(String)
    }

    @State private var load: Load = .loading
    @State private var joining = false
    @State private var failure: String?
    @State private var about = false
    @ScaledMetric(relativeTo: .body) private var answerHeight: CGFloat = 56

    /// The web's InviteShell: the page's background, its header, and under it
    /// the invite centred (px-6, pt-4, the safe area or 24 under it).
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
                        // The web's pb-[max(env(safe-area-inset-bottom),1.5rem)]: the
                        // safe area already lies under this, so only what 24 exceeds it by.
                        .padding(.bottom, max(0, 24 - outer.safeAreaInsets.bottom))
                        // Centred, as the web's justify-center.
                        .frame(minHeight: outer.size.height)
                }
                .scrollBounceBehavior(.basedOnSize)
            }
        }
        .background(Theme.background.color.ignoresSafeArea())
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("join.screen")
        .nativeSheetLook(preferences)
        .task { await open() }
    }

    /// Signed in, the web's PhoneSubHeader: "‹ Hjem" (h-12, px-2; chevron 24,
    /// 15 orange). Signed out, its TopNav: only the language, on the right.
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
                .accessibilityIdentifier("join.home")
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
            // The web's InviteLoading: a spinner and the words, muted.
            HStack(spacing: 12) {
                ProgressView()
                Text(CasyStrings.joinOpening).cssLineHeight(24, size: 16)
            }
            .font(.system(size: 16))
            .foregroundStyle(Theme.mutedForeground.color)
        case .broken(let reason):
            broken(reason)
        case .shown(let group, let alreadyIn):
            details(group, alreadyIn: alreadyIn)
        }
    }

    /// The web's InviteDetails, value for value as the invitation screen's
    /// (InvitationScreen): the picture (112, shadow-sm), who invited you (20
    /// under, 15 medium muted), the name (28 bold), what it is for (15), the
    /// members so far (13 muted) with the ? beside it; a note (16 under, 15);
    /// 32 under it the answer.
    private func details(_ group: InvitePreview.InvitedGroup, alreadyIn: Bool) -> some View {
        VStack(spacing: 0) {
            Avatar(name: group.name, index: 0, size: .hero, url: group.pictureUrl.flatMap(URL.init(string:)))
                .shadow(color: .black.opacity(0.05), radius: 1, y: 1)
            Text(group.invitedBy.map(CasyStrings.invitationsInvitedBy) ?? CasyStrings.invitationsInvitedTo)
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(Theme.mutedForeground.color)
                .cssLineHeight(22.5, size: 15)
                .padding(.top, 20)
            Text(group.name)
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(Theme.foreground.color)
                .cssLineHeight(35, size: 28)
                .padding(.top, 2)
            if let description = group.description, !description.isEmpty {
                Text(description)
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.foreground.color)
                    .cssLineHeight(22.5, size: 15)
                    .padding(.top, 8)
            }
            HStack(spacing: 8) {
                Text(CasyStrings.invitationsMembersSoFar(group.memberCount))
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.mutedForeground.color)
                aboutButton
            }
            .padding(.top, 8)
            if let note = alreadyIn ? CasyStrings.joinAlreadyIn : signedIn ? nil : CasyStrings.joinWhatIsCasy {
                Text(note)
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.foreground.color)
                    .cssLineHeight(22.5, size: 15)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 16)
            }
            VStack(spacing: 8) {
                answer(alreadyIn ? CasyStrings.joinToGroup : CasyStrings.invitationsJoin) {
                    if alreadyIn { finish(.group(group.id)) } else if signedIn { join() } else { finish(.signUp) }
                }
                if let failure { Notice(failure, tone: .error, bare: true).padding(.top, 4) }
            }
            .padding(.top, 32)
        }
    }

    /// The web's InviteAction: the one solid orange answer, h-14, 17 bold white.
    private func answer(_ words: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if joining { ProgressView().tint(.white) }
                Text(words)
            }
            .font(.system(size: 17, weight: .bold))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: answerHeight)
            .background(Theme.cta.color, in: Capsule())
            .contentShape(Capsule())
            .opacity(joining ? 0.6 : 1)
        }
        .buttonStyle(.plain)
        .disabled(joining)
        .accessibilityIdentifier("join.answer")
    }

    /// What joining shares, behind the ? (the web's HelpButton, `aboutTitle`).
    private var aboutButton: some View {
        Button {
            about = true
        } label: {
            LucideIcon("circle-question-mark", size: 20)
                .foregroundStyle(Theme.primary.color)
                .frame(width: 20, height: 20)
                .contentShape(Rectangle().inset(by: -12))
        }
        .accessibilityLabel(CasyStrings.invitationsAbout)
        .popover(isPresented: $about) {
            Text(CasyStrings.invitationsPrivacy)
                .font(.system(size: 15))
                .foregroundStyle(Theme.foreground.color)
                .fixedSize(horizontal: false, vertical: true)
                .multilineTextAlignment(.leading)
                .padding(20)
                .frame(idealWidth: 320)
                .presentationCompactAdaptation(.popover)
        }
    }

    /// The web's InviteBroken: circle-x (48, red-600), the title (16 under, 17
    /// bold), why (8 under, 15 muted), and a glass capsule home (24 under).
    private func broken(_ reason: String) -> some View {
        VStack(spacing: 0) {
            LucideIcon("circle-x", size: 48)
                .foregroundStyle(Theme.red600.color)
                .frame(width: 48, height: 48)
            Text(CasyStrings.joinBroken)
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(Theme.foreground.color)
                // The body's 1.5, inherited: no line height of its own on the web.
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
            .accessibilityIdentifier("join.home")
            .padding(.top, 24)
        }
    }

    /// The invite, and whether you are in it already (signed in: your groups,
    /// so a member is never offered Bliv medlem, #244). Back from making an
    /// account, the yes said before is carried out at once.
    private func open() async {
        guard let api = await Native.publicApi() else {
            load = .broken(CasyStrings.joinPreviewFailed)
            return
        }
        do {
            let group = try await api.previewInvite(token, errorMessage: CasyStrings.joinPreviewFailed).group
            var alreadyIn = false
            if signedIn {
                let mine = try await api.groups(errorMessage: CasyStrings.groupsLoadFailed)
                alreadyIn = mine.contains { $0.id == group.id }
            }
            load = .shown(group, alreadyIn: alreadyIn)
            if autoJoin, signedIn, !alreadyIn { join() }
        } catch {
            load = .broken(error.localizedDescription)
        }
    }

    private func join() {
        joining = true
        failure = nil
        Task {
            defer { joining = false }
            do {
                guard let api = await Native.api() else { throw APIError.unreadable(CasyStrings.joinJoinFailed) }
                _ = try await api.joinByLink(token, errorMessage: CasyStrings.joinJoinFailed)
                finish(.joined)
            } catch {
                failure = error.localizedDescription
            }
        }
    }
}
