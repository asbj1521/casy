import CasyCore
import CasyUI
import SwiftUI

/// Log ind og sikkerhed (#202), pushed inside Profil: the web's PasswordContent.
/// One card with a password to set or change (Supabase first emails a code to
/// someone signed in over a day ago) and Log ud på alle enheder; under it Log
/// ind med Apple, to add as a second way in. The login still lives in the page
/// until Phase 6, so each step is asked of it (PageAuth, nativeAuth.ts).
struct SecurityScreen: View {
    /// The person's email and name: what a password mustn't be built from.
    let email: String
    let name: String
    /// Signed out on every device: the sheet goes, the page shows the welcome.
    let signedOutEverywhere: () -> Void

    @Environment(\.closeSheet) private var closeSheet
    @Environment(\.colorScheme) private var scheme

    @State private var formOpen = false
    @State private var password = ""
    @State private var confirm = ""
    /// A new password waiting for the emailed code.
    @State private var codeFor: String?
    @State private var code = ""
    @State private var codeResent = false
    @State private var saving = false
    @State private var checking = false
    @State private var saved = false
    @State private var error: String?
    @State private var signingOut = false
    @State private var signOutFailed = false
    @State private var appleLinked: Bool?
    @State private var appleBusy = false
    @State private var appleError: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                passwordCard
                appleRow
                    .padding(.top, 24)
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 24)
        }
        .background(Theme.background.color)
        .casyPushedBar(CasyStrings.profileSecurity, close: CasyStrings.done, action: closeSheet)
        .accessibilityIdentifier("security.screen")
        .task {
            let answer = await PageAuth.shared.ask("appleLinked")
            if answer.outcome == "done" { appleLinked = answer.count == 1 }
        }
    }

    // MARK: The password and signing out (PasswordSection)

    private var passwordCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            if saved && !formOpen {
                Notice(CasyStrings.securityPasswordSaved, tone: .success, bare: true)
                    .padding(.bottom, 12)
            }
            if formOpen, let codeFor {
                codeStep(codeFor)
            } else if formOpen {
                passwordForm
            } else {
                capsule(CasyStrings.securitySetPassword, icon: nil, busy: false) {
                    saved = false
                    error = nil
                    formOpen = true
                }
                .accessibilityIdentifier("security.setPassword")
            }
            Rectangle().fill(Theme.border.color).frame(height: 1)
                .padding(.top, 20)
                .padding(.bottom, 16)
            capsule(
                signingOut ? CasyStrings.securitySigningOutEverywhere : CasyStrings.securitySignOutEverywhere,
                icon: "log-out", busy: signingOut, action: signOutEverywhere
            )
            .accessibilityIdentifier("security.signOutEverywhere")
            Text(CasyStrings.securitySignOutEverywhereHelp)
                .font(.system(size: 12))
                .foregroundStyle(Theme.mutedForeground.color)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 8)
            if signOutFailed {
                Notice(CasyStrings.securityCouldntSignOutEverywhere, tone: .error, bare: true)
                    .padding(.top, 8)
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card.color, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.border.color))
    }

    /// The web's PasswordForm, its pair: a new password with its rules ticked off, and again.
    private var passwordForm: some View {
        let checks = checkPassword(password, personalWords([email, name]))
        let rules: [(Bool, String)] = [
            (checks.length, CasyStrings.passwordRuleLength(minPasswordLength)),
            (checks.lettersAndDigits, CasyStrings.passwordRuleLettersDigits),
            (checks.notPersonal, CasyStrings.passwordRuleNotPersonal),
        ]
        return VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 8) {
                CasyField(CasyStrings.passwordNew, text: $password, secure: true, autofocus: true)
                    .textContentType(.newPassword)
                    .onChange(of: password) { error = nil }
                    .accessibilityIdentifier("security.newPassword")
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
            CasyField(CasyStrings.passwordConfirm, text: $confirm, secure: true)
                .textContentType(.newPassword)
                .onChange(of: confirm) { error = nil }
                .accessibilityIdentifier("security.confirm")
            if let error { Notice(error, tone: .error) }
            VStack(spacing: 12) {
                FlowButton(busy: saving || checking, action: { Task { await submit() } }) {
                    Text(
                        checking
                            ? CasyStrings.passwordChecking : saving ? CasyStrings.securitySaving : CasyStrings.securitySavePassword)
                }
                .accessibilityIdentifier("security.save")
                cancel
            }
        }
    }

    /// The web's PasswordCodeStep: the code Supabase emailed, typed in to save.
    private func codeStep(_ newPassword: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(CasyStrings.securityCodeSent(email))
                .font(.system(size: 14))
                .foregroundStyle(Theme.foreground.color)
                .fixedSize(horizontal: false, vertical: true)
            CasyField(CasyStrings.securityCodeLabel, text: $code, autofocus: true)
                .keyboardType(.numberPad)
                .textContentType(.oneTimeCode)
                .accessibilityIdentifier("security.code")
            if let error { Notice(error, tone: .error) }
            VStack(spacing: 12) {
                FlowButton(busy: saving, action: { Task { await save(newPassword, code: code) } }) {
                    Text(saving ? CasyStrings.securitySaving : CasyStrings.securitySavePassword)
                }
                .disabled(code.filter { !$0.isWhitespace }.isEmpty)
                Button(codeResent ? CasyStrings.securityCodeResent : CasyStrings.securityCodeResend) {
                    Task { await resend() }
                }
                .font(.system(size: 14))
                .foregroundStyle(Theme.mutedForeground.color)
                .disabled(saving)
                cancel
            }
        }
    }

    private var cancel: some View {
        Button(CasyStrings.cancel) {
            codeFor = nil
            code = ""
            password = ""
            confirm = ""
            error = nil
            formOpen = false
        }
        .font(.system(size: 14))
        .foregroundStyle(Theme.mutedForeground.color)
        .disabled(saving || checking)
    }

    /// A bordered capsule, as the web's buttons on this card.
    private func capsule(_ title: String, icon: String?, busy: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if busy {
                    ProgressView().controlSize(.small)
                } else if let icon {
                    LucideIcon(icon, size: 16)
                }
                Text(title).font(.system(size: 14, weight: .semibold))
            }
            .foregroundStyle(Theme.foreground.color)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(Theme.background.color, in: Capsule())
            .overlay(Capsule().strokeBorder(Theme.border.color))
        }
        .buttonStyle(.plain)
        .disabled(busy)
    }

    private func submit() async {
        guard password == confirm else {
            error = CasyStrings.passwordMismatch
            return
        }
        guard checkPassword(password, personalWords([email, name])).pass else {
            error = CasyStrings.passwordRulesNotMet
            return
        }
        checking = true
        let leak = await PageAuth.shared.ask("leaked", password: password)
        checking = false
        if let count = leak.count, count > 0 {
            error = CasyStrings.passwordLeaked(count.formatted(.number.locale(Locale(identifier: "da_DK"))))
            return
        }
        await save(password, code: nil)
    }

    private func save(_ newPassword: String, code: String?) async {
        saving = true
        error = nil
        let answer = await PageAuth.shared.ask(
            "setPassword", password: newPassword, code: code?.filter { !$0.isWhitespace } ?? "")
        saving = false
        switch answer.outcome {
        case "done":
            codeFor = nil
            self.code = ""
            password = ""
            confirm = ""
            formOpen = false
            saved = true
        case "code":
            codeResent = false
            codeFor = newPassword
        default:
            error = answer.error
        }
    }

    private func resend() async {
        error = nil
        let answer = await PageAuth.shared.ask("resendCode")
        if answer.outcome == "sent" { codeResent = true } else { error = answer.error }
    }

    private func signOutEverywhere() {
        signingOut = true
        signOutFailed = false
        Task {
            let answer = await PageAuth.shared.ask("signOutEverywhere")
            if answer.outcome == "done" {
                signedOutEverywhere()
            } else {
                signingOut = false
                signOutFailed = true
            }
        }
    }

    // MARK: Log ind med Apple (AppleSignInRow)

    private var appleRow: some View {
        VStack(alignment: .leading, spacing: 8) {
            CardList {
                Button {
                    Task { await addApple() }
                } label: {
                    CardRow(CasyStrings.appleLinkLabel) {
                        LucideIcon(brand: "apple", size: 20).foregroundStyle(Theme.foreground.color)
                    } trailing: {
                        if appleLinked == true {
                            Text(CasyStrings.appleLinkAdded)
                                .font(.system(size: 14))
                                .foregroundStyle(Theme.mutedForeground.color)
                        } else if appleBusy {
                            ProgressView().controlSize(.small).tint(Theme.primary.color)
                        } else if appleLinked == false {
                            Text(CasyStrings.appleLinkAdd)
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Theme.primary.color)
                        }
                    }
                }
                .buttonStyle(.cardRow)
                .disabled(appleLinked != false || appleBusy)
                .accessibilityIdentifier("security.apple")
            }
            if appleLinked == false {
                Text(CasyStrings.appleLinkFootnote)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.mutedForeground.color)
                    .padding(.horizontal, 4)
            }
            if let appleError { Notice(appleError, tone: .error) }
        }
    }

    private func addApple() async {
        appleBusy = true
        appleError = nil
        let answer = await PageAuth.shared.ask("linkApple")
        appleBusy = false
        switch answer.outcome {
        case "done": appleLinked = true
        case "cancelled": break
        default: appleError = answer.error
        }
    }
}
