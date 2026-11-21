import CasyCore
import CasyUI
import SwiftUI

/// The iPhone app's way in, signed out (#151, #228, #282), the web's
/// AppWelcome: the intro (#275), then the animation on its stage, and under
/// it, never moving, one line and the two ways on, to make an account or to
/// log in, and for a friend who came by an invite the way back to it. Either
/// way on spreads the colour out over the screen and brings the sign-in card
/// up over it (the web's morph); Tilbage runs it back. Signed in, it closes.
struct WelcomeScreen: View {
    let preferences: NativePreferences
    /// Opened straight on sign-in (an invite's way in): "signin" or "signup".
    let startOn: String?
    let signedIn: () -> Void
    /// An invite found by "Indsæt link" (#237): its in-app path, for the page to open.
    let openInvite: (String) -> Void
    let onChoose: (_ lang: String, _ theme: String) -> Void
    let leave: (LeavingProfile) -> Void

    @Environment(\.accessibilityReduceMotion) private var still
    @State private var intro: Bool
    @State private var introIcon: CGRect?
    /// Sign-in open: the colour spread out, the card over it.
    @State private var signIn: String?
    @State private var cardShown: Bool
    /// "Indsæt link" open (#282): the app's own sheet over the welcome, as the web's.
    @State private var pasting = false
    @State private var pasteHeight: CGFloat = 240

    init(
        preferences: NativePreferences, startOn: String?, signedIn: @escaping () -> Void,
        openInvite: @escaping (String) -> Void,
        onChoose: @escaping (_ lang: String, _ theme: String) -> Void, leave: @escaping (LeavingProfile) -> Void
    ) {
        self.preferences = preferences
        self.startOn = startOn
        self.signedIn = signedIn
        self.openInvite = openInvite
        self.onChoose = onChoose
        self.leave = leave
        #if DEBUG
            _intro = State(initialValue: startOn == nil && !TestLaunch.skipIntro)
        #else
            _intro = State(initialValue: startOn == nil)
        #endif
        _signIn = State(initialValue: startOn)
        _cardShown = State(initialValue: startOn != nil)
    }

    var body: some View {
        ZStack {
            Theme.background.color.ignoresSafeArea()
            if !intro {
                VStack(spacing: 0) {
                    WelcomeStage(leaving: signIn != nil, fromIntro: introIcon)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    bottom
                        .opacity(signIn != nil ? 0 : 1)
                        .animation(signIn != nil ? .easeOut(duration: 0.18) : .easeIn(duration: 0.25).delay(0.3), value: signIn)
                }
            }
            if cardShown, let signIn {
                SignInScreen(
                    preferences: preferences, signup: signIn == "signup", onClose: back, signedIn: signedIn,
                    onChoose: onChoose, leave: leave, colour: false
                )
                .id(signIn)
                .transition(.opacity.animation(.easeInOut(duration: 0.25)))
            }
            if intro {
                WelcomeIntro { icon in
                    introIcon = icon
                    withAnimation(.easeOut(duration: 0.6)) { intro = false }
                }
                .transition(.opacity)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("welcome.screen")
        .nativeSheetLook(preferences)
        // The web's paste sheet over the welcome: as tall as what is in it, in iOS's glass.
        .sheet(isPresented: $pasting) {
            InvitePasteSheet(
                preferences: preferences, found: false,
                open: { path in
                    pasting = false
                    openInvite(path)
                },
                onCancel: { pasting = false }
            )
            .environment(\.fitSheet) { height in pasteHeight = height }
            .presentationDetents([.height(pasteHeight)])
        }
    }

    /// One line, "Find en dag", and the two smaller ways on.
    private var bottom: some View {
        VStack(spacing: 0) {
            Text(CasyStrings.welcome("headline"))
                .font(.system(size: 28, weight: .bold))
                .tracking(-0.7)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .foregroundStyle(Theme.foreground.color)
            Button { open("signup") } label: {
                Text(CasyStrings.welcome("start"))
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 56)
                    .background(Theme.cta.color, in: Capsule())
                    .contentShape(Capsule())
            }
            .buttonStyle(.plain)
            .padding(.top, 20)
            .accessibilityIdentifier("welcome.start")
            HStack(spacing: 4) {
                Text(CasyStrings.welcome("haveAccount")).foregroundStyle(Theme.mutedForeground.color)
                Button { open("signin") } label: {
                    Text(CasyStrings.signIn("title")).fontWeight(.semibold).foregroundStyle(Theme.foreground.color)
                        .frame(minHeight: 32).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("welcome.signIn")
            }
            .font(.system(size: 15))
            .padding(.top, 10)
            HStack(spacing: 4) {
                Text(CasyStrings.invitePasteAsk).foregroundStyle(Theme.mutedForeground.color)
                Button { pasting = true } label: {
                    Text(CasyStrings.invitePastePaste).fontWeight(.semibold).foregroundStyle(Theme.foreground.color)
                        .frame(minHeight: 32).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("welcome.paste")
            }
            .font(.system(size: 15))
            // The touch area stays 32 tall; the lines sit as close as the web's (mt-1).
            .padding(.top, -5)
        }
        .multilineTextAlignment(.center)
        .padding(.horizontal, 24)
        .padding(.top, 16)
        // On the home indicator's line, as the web's max(1rem, safe area); the
        // link's own touch area is the rest.
        .padding(.bottom, -6)
    }

    private func open(_ which: String) {
        withAnimation { signIn = which }
        Task {
            try? await Task.sleep(for: .milliseconds(still ? 0 : 480))
            withAnimation(.easeInOut(duration: 0.25)) { cardShown = true }
        }
    }

    private func back() {
        withAnimation(.easeInOut(duration: 0.18)) { cardShown = false }
        withAnimation { signIn = nil }
    }
}
