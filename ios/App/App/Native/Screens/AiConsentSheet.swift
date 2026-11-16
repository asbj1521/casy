import CasyAPI
import CasyCore
import CasyUI
import SwiftUI

/// Whether the AI may work for this person (`useAiContent`): they said yes, or
/// are an admin or AI tester. The server asks the same before every call.
@MainActor
func aiContentAllowed() async -> Bool {
    let profile = ProfileModel.shared
    if profile.whoAmI == nil { await profile.load() }
    guard let who = profile.whoAmI else { return false }
    return (who.aiTester ?? who.eventLabels) == true || who.aiConsent == true
}

extension View {
    /// Asks before an AI button does anything (#147, `useAiConsentGate`): set
    /// `asking` to what was pressed, and it runs at once for someone who has
    /// said yes, or on their yes; Ikke nu leaves everything as it was.
    func aiConsentGate(_ asking: Binding<(() -> Void)?>, leave: @escaping (LeavingProfile) -> Void) -> some View {
        modifier(AiConsentGate(asking: asking, leave: leave))
    }
}

private struct AiConsentGate: ViewModifier {
    @Binding var asking: (() -> Void)?
    let leave: (LeavingProfile) -> Void
    @State private var showing = false
    @State private var waiting: (() -> Void)?

    func body(content: Content) -> some View {
        content
            .onChange(of: asking != nil) { _, now in
                guard now, let run = asking else { return }
                asking = nil
                Task {
                    if await aiContentAllowed() {
                        run()
                    } else {
                        waiting = run
                        showing = true
                    }
                }
            }
            .sheet(isPresented: $showing) {
                AiConsentSheet(leave: leave) {
                    showing = false
                    waiting?()
                    waiting = nil
                }
                .nativeSheetLook(NativePreferences.shared)
            }
    }
}

/// The one question before Casy's AI does anything (#120, #147): four short
/// pages, nothing decided beforehand, Ikke nu as easy as Tillad.
struct AiConsentSheet: View {
    let leave: (LeavingProfile) -> Void
    let yes: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var page = 0
    @State private var saving = false
    @State private var failure: String?

    private var pages: [[String]] {
        [
            [CasyStrings.aiConsentIntro],
            [CasyStrings.aiConsentSent],
            [CasyStrings.aiConsentShared, CasyStrings.aiConsentCorrections],
            [
                CasyStrings.aiConsentSafe,
                "\(CasyStrings.aiConsentPrivateNote) \(CasyStrings.aiConsentReadMore) [\(CasyStrings.aiConsentPrivacyLink)](/privacy#ai).",
            ],
        ]
    }

    var body: some View {
        let titles = CasyStrings.aiConsentPages
        let last = page == pages.count - 1
        NavigationStack {
            VStack(spacing: 16) {
                TabView(selection: $page) {
                    ForEach(pages.indices, id: \.self) { i in
                        ScrollView {
                            VStack(alignment: .leading, spacing: 12) {
                                Text(titles[i])
                                    .font(.headline)
                                    .foregroundStyle(Theme.foreground.color)
                                ForEach(pages[i], id: \.self) { paragraph in
                                    Text(HelpPages.text(paragraph))
                                        .font(.subheadline)
                                        .foregroundStyle(Theme.mutedForeground.color)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 20)
                        }
                        .tag(i)
                        .accessibilityLabel(CasyStrings.aiConsentPageDot(i + 1, of: pages.count))
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                HStack(spacing: 8) {
                    ForEach(pages.indices, id: \.self) { i in
                        Button {
                            withAnimation { page = i }
                        } label: {
                            Capsule()
                                .fill(i == page ? Theme.primary.color : Theme.mutedForeground.color.opacity(0.3))
                                .frame(width: i == page ? 20 : 8, height: 8)
                                .padding(6)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(CasyStrings.aiConsentPageDot(i + 1, of: pages.count))
                        .accessibilityAddTraits(i == page ? .isSelected : [])
                    }
                }
                if let failure {
                    Notice(failure, tone: .error).padding(.horizontal, 16)
                }
            }
            .padding(.top, 8)
            .casySheetBar(CasyStrings.aiConsentTitle, close: CasyStrings.aiConsentNotNow, disabled: saving) { dismiss() }
            .pageLinks(leave: leave)
            .safeAreaInset(edge: .bottom) {
                FlowButton(busy: saving, action: { last ? allow() : withAnimation { page += 1 } }) {
                    Text(last ? (saving ? CasyStrings.aiConsentSaving : CasyStrings.aiConsentAllow) : CasyStrings.aiConsentNext)
                }
                .accessibilityIdentifier("aiConsent.next")
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
            }
        }
        .presentationDetents([.medium, .large])
        .interactiveDismissDisabled(saving)
    }

    private func allow() {
        saving = true
        failure = nil
        Task {
            defer { saving = false }
            do {
                guard let api = await Native.api() else { throw APIError.failed(status: 401, message: CasyStrings.aiConsentFailed) }
                try await api.setAiConsent(true, errorMessage: CasyStrings.aiConsentFailed)
                ProfileModel.shared.noteAiConsent(true)
                // The page follows the yes up as its own switch does.
                MyDataModel.shared.onAiConsent?(true)
                yes()
            } catch {
                failure = error.localizedDescription
            }
        }
    }
}
