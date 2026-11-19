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
    /// Ikke nu, when the sheet is a screen of its own (the home page's question).
    var close: (() -> Void)?

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

    @Environment(\.fitSheet) private var fitSheet
    @State private var bar: CGFloat = 0
    @State private var content: CGFloat = 300

    /// The web's AiConsentSheet on a phone (#281): the pages side by side,
    /// turned by a swipe, as tall as the longest so nothing jumps, each its
    /// heading (15 semibold) and its words (14 muted); the dots 16 under them
    /// (8 high, the page's 20 wide and orange); the way on as the FlowButton
    /// under that. The sheet as tall as it, in iOS's glass: from Tilføj til
    /// kalender its own detent, on its own (the home page's) `fitSheet`.
    var body: some View {
        let titles = CasyStrings.aiConsentPages
        let last = page == pages.count - 1
        NavigationStack {
            VStack(spacing: 0) {
                // The longest page, unseen, sets the height; the pages turn over it.
                ZStack(alignment: .topLeading) {
                    ForEach(pages.indices, id: \.self) { i in
                        pageView(titles[i], pages[i]).hidden()
                    }
                }
                .frame(maxWidth: .infinity)
                .accessibilityHidden(true)
                .overlay {
                    TabView(selection: $page) {
                        ForEach(pages.indices, id: \.self) { i in
                            pageView(titles[i], pages[i])
                                .frame(maxHeight: .infinity, alignment: .top)
                                .tag(i)
                                .accessibilityLabel(CasyStrings.aiConsentPageDot(i + 1, of: pages.count))
                        }
                    }
                    .tabViewStyle(.page(indexDisplayMode: .never))
                }
                .padding(.top, 16)
                HStack(spacing: 8) {
                    ForEach(pages.indices, id: \.self) { i in
                        Button {
                            withAnimation { page = i }
                        } label: {
                            Capsule()
                                .fill(i == page ? Theme.primary.color : Theme.mutedForeground.color.opacity(0.3))
                                .frame(width: i == page ? 20 : 8, height: 8)
                                .padding(6)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .padding(-6)
                        .accessibilityLabel(CasyStrings.aiConsentPageDot(i + 1, of: pages.count))
                        .accessibilityAddTraits(i == page ? .isSelected : [])
                    }
                }
                .animation(.easeOut(duration: 0.2), value: page)
                .padding(.top, 16)
                if let failure {
                    Notice(failure, tone: .error).padding(.top, 16)
                }
                FlowButton(busy: saving, action: { last ? allow() : withAnimation { page += 1 } }) {
                    Text(last ? (saving ? CasyStrings.aiConsentSaving : CasyStrings.aiConsentAllow) : CasyStrings.aiConsentNext)
                }
                .accessibilityIdentifier("aiConsent.next")
                .padding(.top, 16)
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 16)
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { content = $0 }
            .frame(maxHeight: .infinity, alignment: .top)
            .onGeometryChange(for: CGFloat.self) { $0.safeAreaInsets.top } action: { bar = $0 }
            .onChange(of: bar + content, initial: true) { _, height in
                if bar > 0 { fitSheet(height) }
            }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("aiConsent.screen")
            .casySheetBar(CasyStrings.aiConsentTitle, close: CasyStrings.aiConsentNotNow, disabled: saving) {
                if let close { close() } else { dismiss() }
            }
            .pageLinks(leave: leave)
        }
        // From Tilføj til kalender, a SwiftUI sheet: as tall as its bar and content.
        .presentationDetents([.height(content + max(bar, 56))])
        .interactiveDismissDisabled(saving)
    }

    /// One page: its heading and its words, the link in them the foreground's.
    private func pageView(_ title: String, _ paragraphs: [String]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.foreground.color)
                .padding(.bottom, 8)
            VStack(alignment: .leading, spacing: 12) {
                ForEach(paragraphs, id: \.self) { paragraph in
                    Text(Self.linked(paragraph))
                        .font(.system(size: 14))
                        .tint(Theme.mutedForeground.color)
                        .foregroundStyle(Theme.mutedForeground.color)
                        .cssLineHeight(20, size: 14)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// The words with their link as the web draws it here: the same muted
    /// colour, underlined (`underline underline-offset-2`).
    private static func linked(_ markdown: String) -> AttributedString {
        var text = (try? AttributedString(markdown: markdown)) ?? AttributedString(markdown)
        for run in text.runs where run.link != nil {
            text[run.range].underlineStyle = .single
        }
        return text
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
