import CasyUI
import SwiftUI

/// "Your password is easier to guess than we now allow" (the web's
/// weakPassword.ts and WeakPasswordNotice, #147): set when someone signs in
/// with a password that fails today's rules or is in a known leak, cleared
/// once they save a new one, close the note, or sign out. Kept for this launch
/// only, as the web keeps it for the tab: nobody is locked out by it.
@MainActor @Observable
final class WeakPassword {
    static let shared = WeakPassword()

    private(set) var flagged = false

    func flag() { flagged = true }
    func clear() { flagged = false }
}

/// The note over the home page, as the web's on a phone: under the clock
/// (8 under the safe area, 12 from the sides), amber-50 with an amber-200
/// rim, rounded-2xl, shadow-lg; the triangle (16), the words (14, amber-900)
/// with "Vælg en ny" (semibold, underlined) leading to the new password's
/// form, and a round × (28) closing it.
struct WeakPasswordNote: View {
    /// Opens Sikkerhed with the new password's form.
    let choose: () -> Void

    private var words: AttributedString {
        var text = AttributedString(CasyStrings.weakPasswordMessage + " ")
        var action = AttributedString(CasyStrings.weakPasswordAction)
        action.link = URL(string: "casy-note:new-password")
        action.font = .system(size: 14, weight: .semibold)
        action.underlineStyle = .single
        text.append(action)
        return text
    }

    var body: some View {
        HStack(spacing: 8) {
            LucideIcon("triangle-alert", size: 16)
                .frame(width: 16, height: 16)
            Text(words)
                .font(.system(size: 14))
                .cssLineHeight(20, size: 14)
                .tint(Theme.amber900.color)
                .frame(maxWidth: .infinity, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
                .environment(\.openURL, OpenURLAction { _ in
                    choose()
                    return .handled
                })
                .accessibilityIdentifier("weakPassword.note")
            Button {
                WeakPassword.shared.clear()
            } label: {
                LucideIcon("x", size: 16)
                    .frame(width: 28, height: 28)
                    .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(CasyStrings.weakPasswordDismiss)
            .accessibilityIdentifier("weakPassword.dismiss")
        }
        .foregroundStyle(Theme.amber900.color)
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Theme.amber50.color, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.amber200.color, lineWidth: 1))
        // Tailwind's shadow-lg: 0 10 15 -3 and 0 4 6 -4, black at a tenth.
        .shadow(color: .black.opacity(0.1), radius: 7.5, y: 10)
        .shadow(color: .black.opacity(0.1), radius: 3, y: 4)
        .padding(.horizontal, 12)
        .padding(.top, 8)
    }
}
