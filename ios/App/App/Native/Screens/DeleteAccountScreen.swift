import CasyAPI
import CasyUI
import SwiftUI

/// Slet konto (#198), pushed inside the Profil sheet, as the web's
/// DeleteAccountSection on a phone (#281): one card with what goes and what
/// stays, and Slet min konto, which opens "Er du sikker?" (the web's
/// ConfirmPanel, a small sheet on a phone) where a typed word comes before
/// anything happens, since it can't be undone. Afterwards the page drops its
/// login and its sign-in page says the account is gone.
///
/// The web's values: the card mt-4 (16), p-5 (20), rounded-2xl, 1 border,
/// bg-card, a small shadow; the intro 14 muted; the button mt-4, a capsule
/// px-4 py-2 with a red-200 border on bg-background, 16 point trash, 14
/// semibold red-700.
struct DeleteAccountScreen: View {
    let leave: (LeavingProfile) -> Void

    @Environment(\.closeSheet) private var closeSheet
    @State private var asking = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(CasyStrings.deleteAccountIntro)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.mutedForeground.color)
                    .cssLineHeight(20, size: 14)
                    .fixedSize(horizontal: false, vertical: true)
                Button {
                    asking = true
                } label: {
                    HStack(spacing: 8) {
                        LucideIcon("trash", size: 16)
                        Text(CasyStrings.deleteAccountButton)
                            .font(.system(size: 14, weight: .semibold))
                            .cssLineHeight(20, size: 14)
                    }
                    .foregroundStyle(Theme.red700.color)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Theme.background.color, in: Capsule())
                    .overlay(Capsule().strokeBorder(Theme.red200.color, lineWidth: 1))
                    .contentShape(Capsule())
                }
                .buttonStyle(.plain)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
            .background(Theme.card.color, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(Theme.border.color, lineWidth: 1)
            }
            .shadow(color: .black.opacity(0.05), radius: 1, y: 1)
            .padding(.top, 16)
            .padding(.horizontal, 16)
            .padding(.bottom, 16)
        }
        .accessibilityIdentifier("account.screen")
        .casyPushedBar(CasyStrings.profileDeleteAccount, close: CasyStrings.done, action: closeSheet)
        .sheet(isPresented: $asking) {
            DeleteAccountAsk(leave: leave)
                .nativeSheetLook(NativePreferences.shared)
        }
    }
}

/// "Er du sikker?": the word to type (15 medium), a 160 wide field with a
/// red-200 border, and Slet kontoen for altid as the red capsule along the
/// bottom, held until the word is typed. Annuller closes it, never while
/// the deleting runs.
private struct DeleteAccountAsk: View {
    let leave: (LeavingProfile) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var typed = ""
    @State private var deleting = false
    @State private var failure: String?

    private var confirmed: Bool {
        typed.trimmingCharacters(in: .whitespaces).uppercased() == CasyStrings.deleteAccountWord
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 0) {
                Text(CasyStrings.deleteAccountPrompt(CasyStrings.deleteAccountWord))
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Theme.foreground.color)
                    .cssLineHeight(22.5, size: 15)
                TextField("", text: $typed)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.foreground.color)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .frame(width: 160)
                    .background(Theme.background.color, in: RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(Theme.red200.color, lineWidth: 1))
                    .padding(.top, 8)
                    .accessibilityLabel(CasyStrings.deleteAccountPrompt(CasyStrings.deleteAccountWord))
                if let failure {
                    Notice(failure, tone: .error, bare: true).padding(.top, 12)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 20)
            .frame(maxHeight: .infinity, alignment: .top)
            .safeAreaInset(edge: .bottom) {
                FlowButton(kind: .danger, busy: deleting) {
                    delete()
                } label: {
                    HStack(spacing: 6) {
                        if !deleting { LucideIcon("trash", size: 14) }
                        Text(deleting ? CasyStrings.deleteAccountDeleting : CasyStrings.deleteAccountConfirm)
                    }
                }
                .disabled(!confirmed || deleting)
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
            }
            .casySheetBar(CasyStrings.areYouSure, close: CasyStrings.cancel, disabled: deleting) { dismiss() }
        }
        .presentationDetents([.height(220)])
        .interactiveDismissDisabled(deleting)
    }

    private func delete() {
        deleting = true
        failure = nil
        Task {
            do {
                guard let api = await Native.api() else { throw CancellationError() }
                try await api.deleteMyAccount(errorMessage: CasyStrings.deleteAccountFailed)
                dismiss()
                leave(.accountDeleted)
            } catch {
                deleting = false
                failure = (error as? LocalizedError)?.errorDescription ?? CasyStrings.deleteAccountFailed
            }
        }
    }
}
