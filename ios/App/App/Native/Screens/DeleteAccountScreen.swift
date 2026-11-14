import CasyAPI
import CasyUI
import SwiftUI

/// Slet konto (#198), pushed inside the Profil sheet, as the web's
/// DeleteAccountSection: what goes and what stays, then a typed word before
/// anything happens, since it can't be undone. Afterwards the page drops its
/// login and its sign-in page says the account is gone.
struct DeleteAccountScreen: View {
    let leave: (LeavingProfile) -> Void

    @Environment(\.closeSheet) private var closeSheet
    @State private var typed = ""
    @State private var deleting = false
    @State private var failure: String?

    private var confirmed: Bool {
        typed.trimmingCharacters(in: .whitespaces).uppercased() == CasyStrings.deleteAccountWord
    }

    var body: some View {
        List {
            Section {
                Text(CasyStrings.deleteAccountIntro)
                    .font(.subheadline)
                    .foregroundStyle(Theme.foreground.color)
            }
            Section {
                TextField(CasyStrings.deleteAccountWord, text: $typed)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .accessibilityLabel(CasyStrings.deleteAccountPrompt(CasyStrings.deleteAccountWord))
            } header: {
                Text(CasyStrings.deleteAccountPrompt(CasyStrings.deleteAccountWord))
            }
            // Deleting is a red row, last, and asked first: here by the word (design rules 8 and 11).
            Section {
                Button(action: delete) {
                    HStack {
                        ListRow(
                            deleting ? CasyStrings.deleteAccountDeleting : CasyStrings.deleteAccountConfirm,
                            systemImage: "trash", tone: .danger)
                        if deleting { ProgressView().controlSize(.small) }
                    }
                    .contentShape(Rectangle())
                }
                .disabled(!confirmed || deleting)
                if let failure { Notice(failure, tone: .error, bare: true) }
            }
        }
        .casyPushedBar(CasyStrings.profileDeleteAccount, close: CasyStrings.done, action: closeSheet)
        .disabled(deleting)
    }

    private func delete() {
        deleting = true
        failure = nil
        Task {
            do {
                guard let api = await Native.api() else { throw CancellationError() }
                try await api.deleteMyAccount(errorMessage: CasyStrings.deleteAccountFailed)
                leave(.accountDeleted)
            } catch {
                deleting = false
                failure = (error as? LocalizedError)?.errorDescription ?? CasyStrings.deleteAccountFailed
            }
        }
    }
}
