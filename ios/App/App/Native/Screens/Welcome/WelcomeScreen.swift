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
    /// The icon growing into the phone (the web's link morph), over everything.
    @State private var growing: (from: CGRect, to: CGRect)?
    @State private var grow = 0.0
    @State private var growFade = 1.0
    /// The line and the ways in, after the intro (the web's delay 0.3, 0.25 s).
    @State private var bottomShown: Bool
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
            let intro = startOn == nil && !TestLaunch.skipIntro
        #else
            let intro = startOn == nil
        #endif
        _intro = State(initialValue: intro)
        _signIn = State(initialValue: startOn)
        // Without the intro they are simply there.
        _bottomShown = State(initialValue: !intro)
        _cardShown = State(initialValue: startOn != nil)
    }

    var body: some View {
        ZStack {
            Theme.background.color.ignoresSafeArea()
            if !intro {
                VStack(spacing: 0) {
                    WelcomeStage(leaving: signIn != nil, fromIntro: introIcon) { phone in
                        guard let icon = introIcon, growing == nil, !still else { return }
                        growUp(from: icon, to: phone)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    bottom
                        .opacity(signIn != nil || !bottomShown ? 0 : 1)
                        .animation(signIn != nil ? .easeOut(duration: 0.18) : .easeIn(duration: 0.25).delay(0.3), value: signIn)
                }
                // Simply there under the intro as it fades, as the web's: fading in
                // too, both half-seen let the page's background through.
                .transition(.identity)
                .zIndex(0)
            }
            if cardShown, let signIn {
                SignInScreen(
                    preferences: preferences, signup: signIn == "signup", onClose: back, signedIn: signedIn,
                    onChoose: onChoose, leave: leave, colour: false
                )
                .id(signIn)
                .transition(.opacity.animation(.easeInOut(duration: 0.25)))
                .zIndex(1)
            }
            if intro {
                WelcomeIntro { icon in
                    introIcon = icon
                    withAnimation(.easeOut(duration: 0.6)) { intro = false }
                    withAnimation(.easeIn(duration: 0.25).delay(0.3)) { bottomShown = true }
                }
                // Over the welcome while it fades: without a zIndex a ZStack puts a
                // view on its way out behind the one coming in, and it was simply gone.
                .transition(.opacity)
                .zIndex(2)
            }
            if let growing {
                IconIntoPhone(from: growing.from, to: growing.to, progress: grow)
                    .opacity(growFade)
                    .allowsHitTesting(false)
                    .ignoresSafeArea()
                    .zIndex(3)
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

    /// The web's link morph (#275): the icon grows into the phone's shape over
    /// 0.75 s, held until 62 % of 0.95 s, then fades onto the real phone below.
    private func growUp(from icon: CGRect, to phone: CGRect) {
        growing = (icon, phone)
        Task {
            try? await Task.sleep(for: .milliseconds(16))
            withAnimation(.timingCurve(0.32, 0.72, 0, 1, duration: 0.75)) { grow = 1 }
            try? await Task.sleep(for: .milliseconds(590))
            withAnimation(.easeOut(duration: 0.36)) { growFade = 0 }
            try? await Task.sleep(for: .milliseconds(380))
            growing = nil
        }
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

/// The intro's icon opening into the phone like an app launching (#275, the
/// web's link morph): from the icon's square to the phone's shape, its white
/// rim turning into the phone's silver band and the black bezel coming in
/// inside it, the logo staying in the middle as it grows. In screen points.
private struct IconIntoPhone: View, Animatable {
    let from: CGRect
    let to: CGRect
    var progress: Double

    nonisolated var animatableData: Double {
        get { progress }
        set { progress = newValue }
    }

    var body: some View {
        let p = CGFloat(progress)
        func mix(_ a: CGFloat, _ b: CGFloat) -> CGFloat { a + (b - a) * p }
        let k = to.width / WelcomeDemo.device.width
        let rect = CGRect(
            x: mix(from.minX, to.minX), y: mix(from.minY, to.minY),
            width: mix(from.width, to.width), height: mix(from.height, to.height))
        let radius = mix(from.width * 0.22, WelcomeDemo.deviceRadius * k)
        let rim = mix(3, WelcomeDemo.band * k)
        let bezel = (WelcomeDemo.edge - WelcomeDemo.band) * k * p
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        return shape
            .fill(WelcomeIntro.orange)
            .overlay { WelcomeLogo().foregroundStyle(.white).frame(height: rect.width * 0.68) }
            .overlay {
                RoundedRectangle(cornerRadius: max(0, radius - rim), style: .continuous)
                    .strokeBorder(.black, lineWidth: bezel)
                    .padding(rim)
            }
            .overlay { shape.strokeBorder(.white.opacity(1 - p), lineWidth: rim) }
            .overlay { shape.strokeBorder(Color(hex: 0xC4C6C9).opacity(p), lineWidth: rim) }
            .frame(width: rect.width, height: rect.height)
            .shadow(color: .black.opacity(0.25), radius: 25, y: 20)
            .position(x: rect.midX, y: rect.midY)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}
