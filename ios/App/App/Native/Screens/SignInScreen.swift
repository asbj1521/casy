import CasyCore
import CasyUI
import SwiftUI
import UIKit

// MARK: - The page's part

/// How a sign-in step went, as the page answers it (nativeAuth.ts's NativeAuthAnswer).
struct AuthAnswer: Sendable {
    /// "in", "sent", "confirm", "new-account", "cancelled", "done" or "failed".
    var outcome: String
    var error: String?
    var unconfirmed = false
    /// How often a password is in known leaks; nil when that can't be said.
    var count: Int?

    static func failed(_ error: String) -> AuthAnswer { AuthAnswer(outcome: "failed", error: error) }
}

/// Signing in through the page (#282): the session still lives there until
/// Phase 6, so each step (a password, a new account, an email link, Apple) is
/// sent to it as `authAsk`, done by the same Supabase calls its own sign-in
/// makes, and answered (`authAnswered`) with the outcome and its own words.
@MainActor
final class PageAuth {
    static let shared = PageAuth()

    /// Sends an ask to the page; set by the bridge.
    var send: (([String: Any]) -> Void)?
    private var waiting: [Int: CheckedContinuation<AuthAnswer, Never>] = [:]
    private var asked = 0
    /// Apple's own sheet is in it, so a person may take a while.
    private static let patience: Duration = .seconds(180)

    func ask(
        _ action: String, email: String = "", password: String = "", name: String = "", code: String = ""
    ) async -> AuthAnswer {
        #if DEBUG
            if TestLaunch.isActive && !TestLaunch.pageAuth {
                return TestLaunch.authAnswer(action, email: email, password: password, code: code)
            }
        #endif
        // Without its page the app signs in itself (#202).
        if PageFree.on {
            return await AppAuth.shared.answer(action, email: email, password: password, name: name, code: code)
        }
        guard let send else { return .failed(CasyStrings.signIn("appleFailed")) }
        asked += 1
        let id = asked
        return await withCheckedContinuation { continuation in
            waiting[id] = continuation
            send(["id": id, "action": action, "email": email, "password": password, "name": name, "code": code])
            Task { @MainActor [weak self] in
                try? await Task.sleep(for: Self.patience)
                self?.answered(id, AuthAnswer.failed(CasyStrings.groupsLoadFailed))
            }
        }
    }

    func answered(_ id: Int, _ answer: AuthAnswer) {
        waiting.removeValue(forKey: id)?.resume(returning: answer)
    }
}

// MARK: - The screen

/// Log ind (#282), the web's SignIn in the app: its card over the welcome
/// screen's colour, Tilbage above it on the left and the language on the
/// right. In the card Sign in with Apple first, then Log ind or Opret konto
/// with an email and a password (or an email link instead), the password's
/// rules ticked off as they are met, "Glemt adgangskode?" and the switch to
/// a link beside each other, and the terms under it all. Signed in, the
/// screen closes and the page goes on (`signedIn`).
struct SignInScreen: View {
    let preferences: NativePreferences
    /// Opened on making an account ("Find en dag") rather than on logging in.
    let signup: Bool
    let onClose: () -> Void
    let signedIn: () -> Void
    let onChoose: (_ lang: String, _ theme: String) -> Void
    let leave: (LeavingProfile) -> Void
    /// Its own colour behind it; off over the welcome, whose colour spreads out behind it.
    var colour = true

    private enum Mode { case password, link }
    private enum Tab { case signIn, signUp }

    @State private var mode = Mode.password
    @State private var tab = Tab.signIn
    @State private var email = ""
    @State private var password = ""
    @State private var name = ""
    @State private var shown = false
    @State private var busy: String?
    @State private var error: String?
    @State private var unconfirmed: String?
    @State private var sentTo: String?
    @State private var resetSentTo: String?
    @State private var confirmSentTo: String?
    @State private var resent = false
    @State private var askEmail = false
    @State private var appleAsk = false
    @State private var told = false
    @Environment(\.colorScheme) private var scheme

    init(
        preferences: NativePreferences, signup: Bool, onClose: @escaping () -> Void, signedIn: @escaping () -> Void,
        onChoose: @escaping (_ lang: String, _ theme: String) -> Void, leave: @escaping (LeavingProfile) -> Void,
        colour: Bool = true
    ) {
        self.colour = colour
        self.preferences = preferences
        self.signup = signup
        self.onClose = onClose
        self.signedIn = signedIn
        self.onChoose = onChoose
        self.leave = leave
        _tab = State(initialValue: signup ? .signUp : .signIn)
    }

    var body: some View {
        ZStack(alignment: .top) {
            if colour { WelcomeColour().ignoresSafeArea() }
            ScrollView {
                VStack(spacing: 0) {
                    if told { Notice(CasyStrings.signIn("useOldWay"), tone: .info).padding(.bottom, 16) }
                    card
                }
                .frame(maxWidth: 384)
                .padding(.horizontal, 20)
                .padding(.top, 72 + 24)
                .padding(.bottom, 64)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)
            topBar
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("signin.screen")
        .disabled(busy != nil)
        .sheet(isPresented: $appleAsk) { appleQuestion.nativeSheetLook(preferences) }
        .environment(\.locale, Locale(identifier: preferences.lang == "en" ? "en_GB" : "da_DK"))
        .id(preferences.lang)
    }

    // MARK: Above the card

    private var topBar: some View {
        HStack {
            Button(action: onClose) {
                HStack(spacing: 6) {
                    LucideIcon("chevron-left", size: 16)
                    Text(CasyStrings.welcomeBack).font(.subheadline.weight(.semibold))
                }
                .foregroundStyle(Theme.primary.color)
                .padding(.horizontal, 14)
                .frame(height: 36)
                .background(Theme.card.color, in: Capsule())
                .shadow(color: .black.opacity(0.08), radius: 4, y: 2)
                .frame(minHeight: 44)
                .contentShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("signin.back")
            Spacer()
            LanguageSwitch(lang: preferences.lang) { lang in
                preferences.lang = lang
                onChoose(lang, preferences.theme)
            }
        }
        .padding(.horizontal, 16)
        .frame(height: 48)
    }

    // MARK: The card

    private var card: some View {
        VStack(alignment: .leading, spacing: 0) {
            appleButton
            HStack(spacing: 12) {
                Rectangle().fill(Theme.border.color).frame(height: 1)
                Text(CasyStrings.signIn("or")).font(.system(size: 12)).foregroundStyle(Theme.mutedForeground.color)
                Rectangle().fill(Theme.border.color).frame(height: 1)
            }
            .padding(.vertical, 20)
            if mode == .link { linkForm } else { passwordForms }
            smallLinks.padding(.top, 16)
            if let error {
                VStack(alignment: .leading, spacing: 4) {
                    Notice(error, tone: .error)
                    if let unconfirmed { resendButton(unconfirmed) }
                }
                .padding(.top, 16)
                .accessibilityIdentifier("signin.error")
            }
            terms.padding(.top, 16)
        }
        .padding(20)
        .background(Theme.card.color, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay { RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.border.color, lineWidth: 1) }
        .shadow(color: .black.opacity(0.05), radius: 1, y: 1)
    }

    /// Drawn as Apple asks: black (white in dark mode), its logo and wording.
    private var appleButton: some View {
        Button {
            Task { await apple() }
        } label: {
            HStack(spacing: 8) {
                if busy == "apple" {
                    ProgressView().tint(scheme == .dark ? .black : .white)
                } else {
                    Image(systemName: "apple.logo").font(.system(size: 18))
                }
                Text(CasyStrings.signIn("apple")).font(.system(size: 17, weight: .semibold))
            }
            .foregroundStyle(scheme == .dark ? .black : .white)
            .frame(maxWidth: .infinity, minHeight: 48)
            .background(scheme == .dark ? .white : .black, in: Capsule())
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("signin.apple")
    }

    @ViewBuilder private var linkForm: some View {
        if let sentTo {
            sentNotice(CasyStrings.signInLinkSent(sentTo), action: CasyStrings.signIn("otherEmail")) { self.sentTo = nil }
        } else {
            VStack(spacing: 12) {
                emailField
                FlowButton(busy: busy == "link", action: { Task { await sendLink() } }) {
                    Text(CasyStrings.signIn(busy == "link" ? "sendingLink" : "sendLink"))
                }
                .accessibilityIdentifier("signin.sendLink")
            }
        }
    }

    @ViewBuilder private var passwordForms: some View {
        tabs.padding(.bottom, 16)
        if tab == .signIn {
            if let resetSentTo {
                sentNotice(CasyStrings.signInResetSent(resetSentTo), action: CasyStrings.signIn("tryAgain")) {
                    self.resetSentTo = nil
                }
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        emailField
                        if askEmail && email.trimmingCharacters(in: .whitespaces).isEmpty {
                            Text(CasyStrings.signIn("enterEmailFirst"))
                                .font(.system(size: 12))
                                .foregroundStyle(Theme.mutedForeground.color)
                                .padding(.horizontal, 4)
                        }
                    }
                    CasyField(CasyStrings.signIn("password"), text: $password, secure: true)
                        .textContentType(.password)
                        .accessibilityIdentifier("signin.password")
                        .onSubmit { Task { await signInWithPassword() } }
                    FlowButton(busy: busy == "password", action: { Task { await signInWithPassword() } }) {
                        Text(CasyStrings.signIn(busy == "password" ? "signingIn" : "signInButton"))
                    }
                    .accessibilityIdentifier("signin.submit")
                }
            }
        } else if let confirmSentTo {
            VStack(alignment: .leading, spacing: 6) {
                Notice(CasyStrings.signInConfirmSent(confirmSentTo), tone: .success)
                HStack(spacing: 12) {
                    resendButton(confirmSentTo)
                    textButton(CasyStrings.signIn("otherEmail")) { self.confirmSentTo = nil }
                }
                .padding(.leading, 4)
            }
            .accessibilityIdentifier("signin.confirmSent")
        } else {
            VStack(alignment: .leading, spacing: 12) {
                CasyField(CasyStrings.signIn("name"), text: $name)
                    .textContentType(.name)
                    .accessibilityIdentifier("signin.name")
                emailField
                newPassword
                FlowButton(busy: busy == "signUp", action: { Task { await signUp() } }) {
                    Text(
                        busy == "signUp"
                            ? (checking ? CasyStrings.passwordChecking : CasyStrings.signIn("creatingAccount"))
                            : CasyStrings.signIn("createAccount"))
                }
                .accessibilityIdentifier("signin.create")
            }
        }
    }

    @State private var checking = false
    /// Vilkår or Privatliv, opened from the terms line.
    @State private var legal: PageLink?

    private var emailField: some View {
        CasyField(CasyStrings.signIn("email"), text: $email, placeholder: CasyStrings.signIn("emailPlaceholder"))
            .keyboardType(.emailAddress)
            .textContentType(.emailAddress)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .accessibilityIdentifier("signin.email")
    }

    /// The web's PasswordForm `single`: one field with a button to see what
    /// was typed, and the rules under it, ticked off as they are met.
    private var newPassword: some View {
        let checks = checkPassword(password, personalWords([email, name]))
        let rules: [(Bool, String)] = [
            (checks.length, CasyStrings.passwordRuleLength(minPasswordLength)),
            (checks.lettersAndDigits, CasyStrings.passwordRuleLettersDigits),
            (checks.notPersonal, CasyStrings.passwordRuleNotPersonal),
        ]
        return VStack(alignment: .leading, spacing: 8) {
            ZStack(alignment: .bottomTrailing) {
                CasyField(CasyStrings.signIn("password"), text: $password, secure: !shown)
                    .textContentType(.newPassword)
                    .accessibilityIdentifier("signin.newPassword")
                Button {
                    shown.toggle()
                } label: {
                    Image(systemName: shown ? "eye.slash" : "eye")
                        .font(.system(size: 17))
                        .foregroundStyle(Theme.mutedForeground.color)
                        .frame(width: 44, height: 48)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(shown ? CasyStrings.passwordHide : CasyStrings.passwordShow)
            }
            VStack(alignment: .leading, spacing: 4) {
                ForEach(rules, id: \.1) { met, label in
                    let lit = met && !password.isEmpty
                    HStack(spacing: 6) {
                        if lit {
                            LucideIcon("check", size: 14)
                        } else {
                            Circle().strokeBorder(lineWidth: 1.5).frame(width: 12, height: 12).frame(width: 14)
                        }
                        Text(label).font(.system(size: 12))
                    }
                    .foregroundStyle(lit ? Theme.emerald700.color : Theme.mutedForeground.color)
                }
            }
            .padding(.horizontal, 4)
        }
    }

    private var tabs: some View {
        HStack(spacing: 4) {
            tabButton(.signIn, CasyStrings.signIn("tabSignIn"))
            tabButton(.signUp, CasyStrings.signIn("tabSignUp"))
        }
        .background { TabGlide(at: tab == .signUp ? 1 : 0, gap: 4, glass: false) }
        .overlay { TabGlide(at: tab == .signUp ? 1 : 0, gap: 4, glass: true) }
        .padding(4)
        .background(Theme.secondary.color, in: Capsule())
    }

    private func tabButton(_ value: Tab, _ label: String) -> some View {
        Button {
            withAnimation(.snappy(duration: 0.2)) { switchTab(value) }
        } label: {
            Text(label)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(tab == value ? Theme.foreground.color : Theme.mutedForeground.color)
                .frame(maxWidth: .infinity, minHeight: 32)
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(tab == value ? .isSelected : [])
        .accessibilityIdentifier(value == .signIn ? "signin.tab.signIn" : "signin.tab.signUp")
    }

    /// "Glemt adgangskode?" and the switch between a password and a link, on one row.
    private var smallLinks: some View {
        HStack(alignment: .top, spacing: 16) {
            if mode == .password && tab == .signIn && resetSentTo == nil {
                textButton(CasyStrings.signIn(busy == "reset" ? "sendingReset" : "forgot")) { Task { await forgot() } }
                    .accessibilityIdentifier("signin.forgot")
            }
            Spacer(minLength: 0)
            textButton(CasyStrings.signIn(mode == .link ? "usePassword" : "useLink")) {
                switchMode(mode == .link ? .password : .link)
            }
            .multilineTextAlignment(.trailing)
            .accessibilityIdentifier("signin.switchMode")
        }
    }

    private func textButton(_ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 12))
                .underline()
                .foregroundStyle(Theme.mutedForeground.color)
                .frame(minHeight: 20)
                .contentShape(Rectangle().inset(by: -12))
        }
        .buttonStyle(.plain)
    }

    private func sentNotice(_ text: String, action: String, _ again: @escaping () -> Void) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Notice(text, tone: .success)
            textButton(action, action: again).padding(.leading, 4)
        }
        .accessibilityIdentifier("signin.sent")
    }

    @ViewBuilder private func resendButton(_ address: String) -> some View {
        if resent {
            Text(CasyStrings.signIn("confirmResent")).font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.foreground.color)
        } else {
            textButton(CasyStrings.signIn(busy == "resend" ? "confirmResending" : "confirmResend")) {
                Task { await resend(address) }
            }
        }
    }

    /// Signing in is accepting the terms, its two links the app's own pages.
    private var terms: some View {
        let termsWord = CasyStrings.signIn("termsLink")
        let privacyWord = CasyStrings.signIn("privacyLink")
        var line = AttributedString(CasyStrings.signInAcceptTerms(termsWord, privacyWord))
        for (word, path) in [(termsWord, "terms"), (privacyWord, "privacy")] {
            if let range = line.range(of: word) {
                line[range].underlineStyle = .single
                line[range].link = URL(string: "casy-signin:\(path)")
            }
        }
        return Text(line)
            .font(.system(size: 12))
            .foregroundStyle(Theme.mutedForeground.color)
            .tint(Theme.mutedForeground.color)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .environment(
                \.openURL,
                OpenURLAction { url in
                    // The app's own pages (#202), in a sheet over the sign-in.
                    legal = url.absoluteString.hasSuffix("privacy") ? .privacy(section: nil) : .terms
                    return .handled
                })
            .sheet(isPresented: Binding(get: { legal != nil }, set: { if !$0 { legal = nil } })) {
                if let legal {
                    NavigationStack {
                        PageScreen(page: legal, leave: { _ in self.legal = nil })
                    }
                    .environment(\.closeSheet) { self.legal = nil }
                    .nativeSheetLook(NativePreferences.shared)
                }
            }
    }

    // MARK: The new Apple account's question (#245)

    private var appleQuestion: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 0) {
                Text(CasyStrings.signIn("haveAccountBody"))
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.foreground.color)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, 16)
                Spacer(minLength: 16)
                VStack(spacing: 8) {
                    FlowButton(action: { Task { await appleIsNew() } }) { Text(CasyStrings.signIn("imNew")) }
                        .accessibilityIdentifier("signin.imNew")
                    FlowButton(kind: .quiet, busy: busy == "appleLeave", action: { Task { await appleHadOne() } }) {
                        Text(CasyStrings.signIn("haveAccount"))
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
            }
            .padding(.top, 8)
            .casySheetBar(CasyStrings.signIn("haveAccountTitle"), close: CasyStrings.cancel) {
                Task { await appleIsNew() }
            }
        }
        .presentationDetents([.medium])
        .interactiveDismissDisabled()
    }

    // MARK: Doing it

    private var address: String { email.trimmingCharacters(in: .whitespaces) }

    private func switchTab(_ value: Tab) {
        tab = value
        clear()
    }

    private func switchMode(_ value: Mode) {
        mode = value
        tab = .signIn
        sentTo = nil
        clear()
    }

    private func clear() {
        error = nil
        unconfirmed = nil
        resetSentTo = nil
        askEmail = false
        confirmSentTo = nil
    }

    private func run(_ what: String, _ work: () async -> Void) async {
        busy = what
        await work()
        busy = nil
    }

    private func apple() async {
        error = nil
        await run("apple") {
            let answer = await PageAuth.shared.ask("apple")
            switch answer.outcome {
            case "in": signedIn()
            case "new-account": appleAsk = true
            case "cancelled": break
            default: error = answer.error ?? CasyStrings.signIn("appleFailed")
            }
        }
    }

    private func appleIsNew() async {
        _ = await PageAuth.shared.ask("appleNew")
        appleAsk = false
        signedIn()
    }

    private func appleHadOne() async {
        await run("appleLeave") { _ = await PageAuth.shared.ask("appleLeave") }
        appleAsk = false
        told = true
    }

    private func signInWithPassword() async {
        guard !address.isEmpty, !password.isEmpty else { return }
        error = nil
        unconfirmed = nil
        await run("password") {
            let answer = await PageAuth.shared.ask("password", email: address, password: password)
            if answer.outcome == "in" {
                signedIn()
            } else {
                error = answer.error
                if answer.unconfirmed {
                    unconfirmed = address
                    resent = false
                }
            }
        }
    }

    private func signUp() async {
        error = nil
        guard !name.trimmingCharacters(in: .whitespaces).isEmpty else {
            error = CasyStrings.signIn("nameNeeded")
            return
        }
        guard !address.isEmpty else { return }
        guard checkPassword(password, personalWords([email, name])).pass else {
            error = CasyStrings.passwordRulesNotMet
            return
        }
        await run("signUp") {
            checking = true
            let leak = await PageAuth.shared.ask("leaked", password: password)
            checking = false
            if let count = leak.count, count > 0 {
                error = CasyStrings.passwordLeaked(count.formatted(.number.locale(Locale(identifier: "da_DK"))))
                return
            }
            let answer = await PageAuth.shared.ask("signUp", email: address, password: password, name: name)
            switch answer.outcome {
            case "in": signedIn()
            case "confirm":
                confirmSentTo = address
                resent = false
            default: error = answer.error
            }
        }
    }

    private func sendLink() async {
        guard !address.isEmpty else { return }
        error = nil
        await run("link") {
            let answer = await PageAuth.shared.ask("link", email: address)
            if answer.outcome == "sent" { sentTo = address } else { error = answer.error }
        }
    }

    private func forgot() async {
        guard !address.isEmpty else {
            askEmail = true
            return
        }
        askEmail = false
        error = nil
        await run("reset") {
            let answer = await PageAuth.shared.ask("reset", email: address)
            if answer.outcome == "sent" { resetSentTo = address } else { error = answer.error }
        }
    }

    private func resend(_ address: String) async {
        await run("resend") {
            let answer = await PageAuth.shared.ask("resend", email: address)
            if answer.outcome == "sent" { resent = true } else { error = answer.error }
        }
    }
}

/// The DA | EN switch of the page's header, for someone signed out (LanguageToggle).
/// The chosen tab's capsule, as the week strip's day (#282, Liquid Glass):
/// solid at rest; on a change it turns to Apple's clear glass where it
/// stands, swells, glides over to the other tab on an even curve and turns
/// back into the solid capsule there. Drawn twice, the solid one under the
/// words (`glass: false`) and the glass over them, so they show through it
/// bent, and laid over the tab row as wide as one tab.
private struct TabGlide: View {
    /// 0 for the first tab, 1 for the second.
    let at: CGFloat
    let gap: CGFloat
    let glass: Bool

    @State private var place: CGFloat
    @State private var moving = false
    @State private var swollen = false
    @State private var run = 0

    init(at: CGFloat, gap: CGFloat, glass: Bool) {
        self.at = at
        self.gap = gap
        self.glass = glass
        _place = State(initialValue: at)
    }

    var body: some View {
        GeometryReader { box in
            let width = (box.size.width - gap) / 2
            Group {
                if glass {
                    Color.clear
                        .casyGlass(in: Capsule(), clear: true)
                        .opacity(moving ? 1 : 0)
                } else {
                    Capsule()
                        .fill(Theme.background.color)
                        .shadow(color: .black.opacity(0.08), radius: 1, y: 1)
                        .opacity(moving ? 0 : 1)
                }
            }
            .frame(width: width, height: box.size.height)
            .scaleEffect(swollen ? 1.18 : 1)
            .offset(x: place * (width + gap))
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .onChange(of: at) { _, new in glide(to: new) }
    }

    private func glide(to new: CGFloat) {
        run += 1
        let mine = run
        withAnimation(.easeOut(duration: 0.12)) { moving = true }
        withAnimation(.spring(duration: 0.16, bounce: 0.3)) { swollen = true }
        withAnimation(.timingCurve(0.35, 0, 0.25, 1, duration: 0.34)) {
            place = new
        } completion: {
            guard mine == run else { return }
            withAnimation(.easeOut(duration: 0.2)) {
                swollen = false
                moving = false
            }
        }
    }
}

struct LanguageSwitch: View {
    let lang: String
    let choose: (String) -> Void

    var body: some View {
        HStack(spacing: 0) {
            ForEach([("da", "DA", "Dansk"), ("en", "EN", "English")], id: \.0) { code, label, name in
                Button {
                    choose(code)
                } label: {
                    Text(label)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(lang == code ? Theme.background.color : Theme.mutedForeground.color)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background {
                            if lang == code { Capsule().fill(Theme.foreground.color) }
                        }
                        .frame(minHeight: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(name)
                .accessibilityAddTraits(lang == code ? .isSelected : [])
            }
        }
        .padding(2)
        .background {
            Capsule().fill(Theme.secondary.color.opacity(0.6)).frame(height: 20)
                .overlay { Capsule().strokeBorder(Theme.border.color, lineWidth: 1).frame(height: 20) }
        }
    }
}

/// The welcome screen's colour, spread out behind the sign-in card, as the
/// web lays it (WelcomeStage, `leaving`): SHAPE_COLORS over the whole screen,
/// and the colour shape (a box 160 % of the screen wide, rounded 46 %, the
/// same colours inside it, with a second, oval blob of orange into pink
/// across its lower half) moved by SHAPE_FILL: 15 % left, 6 % up, turned
/// 8 degrees back and grown 1.7 times. The two sets of the same colours
/// meeting at the shape's edge make the soft curve across the screen.
struct WelcomeColour: View {
    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            // The shape's box: inset-x -30 %, as wide as 1.6 screens, 1 / 0.9.
            let boxW = w * 1.6
            let boxH = boxW * 0.9
            ZStack(alignment: .topLeading) {
                WelcomeShapeColours()
                WelcomeShapeBox(width: boxW, height: boxH)
                .scaleEffect(1.7)
                .rotationEffect(.degrees(-8))
                // Its middle where SHAPE_FILL's x -15 % and y -6 % leave it.
                .position(x: -w * 0.3 + boxW / 2 - boxW * 0.15, y: boxH / 2 - boxH * 0.06)
            }
            .frame(width: w, height: h)
            .clipped()
        }
    }
}

/// The colour shape (the web's shape div): a box rounded 46 %, SHAPE_COLORS
/// inside it, and a second, oval blob of orange into pink across its lower half.
struct WelcomeShapeBox: View {
    let width: CGFloat
    let height: CGFloat

    var body: some View {
        ZStack(alignment: .topLeading) {
            WelcomeShapeColours()
                .clipShape(RoundedRectangle(cornerRadius: min(width, height) * 0.46, style: .circular))
            // inset-x -6 %, top 52 %, 70 % tall, rounded 50 %.
            CSSGradients(
                radials: [(Color(hex: 0xFBBF24), UnitPoint(x: 0.2, y: 0.2), 0.6)],
                linear: (Color(hex: 0xF97316), Color(hex: 0xEC4899), 120)
            )
            .clipShape(Ellipse())
            .frame(width: width * 1.12, height: height * 0.7)
            .offset(x: -width * 0.06, y: height * 0.52)
        }
        .frame(width: width, height: height, alignment: .topLeading)
    }
}

/// SHAPE_COLORS: a yellow glow up on the right and a pink one low down, over
/// orange into rose at 135 degrees.
struct WelcomeShapeColours: View {
    var body: some View {
        CSSGradients(
            radials: [
                (Color(hex: 0xFFD60A), UnitPoint(x: 0.74, y: 0.26), 0.44),
                (Color(hex: 0xFF2D78), UnitPoint(x: 0.82, y: 0.78), 0.5),
            ],
            linear: (Color(hex: 0xFB923C), Color(hex: 0xF43F5E), 135))
    }
}

/// CSS's gradients in a box of any shape: `radial-gradient(circle at x y,
/// colour 0, transparent stop)`, whose stop is a share of the distance to the
/// farthest corner, over `linear-gradient(angle, a, b)`, whose line runs
/// through the middle at that angle and is as long as the box needs.
private struct CSSGradients: View {
    let radials: [(Color, UnitPoint, CGFloat)]
    let linear: (Color, Color, Double)

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let a = linear.2 * .pi / 180
            let half = (abs(w * sin(a)) + abs(h * cos(a))) / 2
            let dx = sin(a) * half / max(w, 1)
            let dy = -cos(a) * half / max(h, 1)
            ZStack {
                LinearGradient(
                    colors: [linear.0, linear.1], startPoint: UnitPoint(x: 0.5 - dx, y: 0.5 - dy),
                    endPoint: UnitPoint(x: 0.5 + dx, y: 0.5 + dy))
                ForEach(Array(radials.enumerated()), id: \.offset) { _, r in
                    let (color, at, stop) = r
                    let far = hypot(max(at.x, 1 - at.x) * w, max(at.y, 1 - at.y) * h)
                    RadialGradient(
                        colors: [color, color.opacity(0)], center: at, startRadius: 0, endRadius: far * stop)
                }
            }
        }
    }
}

extension Color {
    /// A colour from its 0xRRGGBB value.
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255)
    }
}
