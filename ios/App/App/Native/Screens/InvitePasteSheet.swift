import CasyCore
import CasyUI
import SwiftUI
import UIKit

/// The web's InvitePasteSheet (#237, #282): an invite handed to the app by its
/// link. iOS carries nothing through the App Store, so a friend who installed
/// the app from an invite opens it with the invite gone; the invite page copied
/// its link on the way, so the one button reads it back (iOS asks the person
/// first, and only then). Nothing but an invite link is ever taken from what is
/// copied (`inviteInText`), and nothing copied is shown or kept. Where none is
/// found, the link is pasted or typed into the field. The page then opens the
/// invite as if its link had been tapped (`open(path)`).
///
/// `found`: opened by itself for a link copied on the way through the App Store
/// (the web's CopiedInvite, #277): no field, one button, and the group joined at once.
struct InvitePasteSheet: View {
    let preferences: NativePreferences
    let found: Bool
    let open: (String) -> Void
    let onCancel: () -> Void

    @State private var text = ""
    /// The button found no invite among what was copied.
    @State private var missed = false
    @FocusState private var fieldFocused: Bool

    @Environment(\.fitSheet) private var fitSheet
    @State private var bar: CGFloat = 0
    @State private var content: CGFloat = 0

    private var written: String? { inviteInText(text) }

    /// The web's Sheet with this inside: the field (FIELD_LABEL over FIELD), the
    /// note under it (mt-2 px-1, 12 muted), or in `found` the one sentence (px-1,
    /// 15 muted); 20 under it the FlowButton, its word as the web's.
    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 0) {
                if found {
                    Text(missed ? CasyStrings.invitePasteGone : CasyStrings.invitePasteWaiting)
                        .font(.system(size: 15))
                        .foregroundStyle(Theme.mutedForeground.color)
                        .cssLineHeight(22.5, size: 15)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, 4)
                        .accessibilityIdentifier("invitePaste.note")
                } else {
                    CasyField(
                        CasyStrings.invitePasteLabel, text: $text, placeholder: "https://casy.app/join/…"
                    )
                    .keyboardType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($fieldFocused)
                    .onChange(of: text) { _, _ in missed = false }
                    .onSubmit(go)
                    .accessibilityIdentifier("invitePaste.field")
                    if missed || (!text.trimmingCharacters(in: .whitespaces).isEmpty && written == nil) {
                        Text(CasyStrings.invitePasteNone)
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.mutedForeground.color)
                            .cssLineHeight(16, size: 12)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.horizontal, 4)
                            .padding(.top, 8)
                            .accessibilityIdentifier("invitePaste.note")
                    }
                }
                FlowButton(action: go) {
                    Text(
                        found
                            ? CasyStrings.invitePasteToGroup
                            : written != nil ? CasyStrings.invitePasteOpen : CasyStrings.invitePastePaste)
                }
                .accessibilityIdentifier("invitePaste.go")
                .padding(.top, 20)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.bottom, 16)
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { content = $0 }
            .frame(maxHeight: .infinity, alignment: .top)
            .onGeometryChange(for: CGFloat.self) { $0.safeAreaInsets.top } action: { bar = $0 }
            .onChange(of: bar + content, initial: true) { _, height in
                if bar > 0, content > 0 { fitSheet(height) }
            }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("invitePaste.screen")
            .casySheetBar(
                found ? CasyStrings.invitePasteAsk : CasyStrings.invitePasteTitle,
                close: CasyStrings.cancel, action: onCancel)
        }
        .nativeSheetLook(preferences)
    }

    /// A link typed or pasted in is opened; otherwise what is copied is read.
    private func go() {
        if !found, let written { return open(written) }
        // Reading the pasteboard is what makes iOS ask; a test reads its own (TestLaunch).
        if let invite = Self.copied().flatMap(inviteInText) { return open(invite) }
        missed = true
        if !found { fieldFocused = true }
    }

    private static func copied() -> String? {
        #if DEBUG
            if TestLaunch.isActive, let copied = TestLaunch.copied { return copied }
        #endif
        return UIPasteboard.general.string
    }
}
