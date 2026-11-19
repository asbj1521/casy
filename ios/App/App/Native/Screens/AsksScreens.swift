import CasyCore
import CasyUI
import SwiftUI

/// What we say before iOS's question about notifications (#139, #200): shown
/// where people are waiting on others, as often as the page's pushAsk.ts
/// allows (it decides when). Its one button leads straight to iOS's prompt,
/// so the sheet can only be put away if that failed (App Store guideline
/// 5.1.1(iv), #147).
struct PushAskSheet: View {
    let preferences: NativePreferences
    /// "sent", "answered" or "joined".
    let reason: String
    let enablePush: () async -> String
    let onDone: () -> Void

    @State private var busy = false
    @State private var failed = false

    @Environment(\.fitSheet) private var fitSheet
    @State private var bar: CGFloat = 0
    @State private var content: CGFloat = 0

    /// The web's PushAsk (#281): the sentence (12 muted), a failure under it,
    /// Fortsæt as the FlowButton; the sheet as tall as that, in iOS's glass.
    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 0) {
                Text(CasyStrings.pushAskNote)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.mutedForeground.color)
                    .cssLineHeight(16, size: 12)
                    .fixedSize(horizontal: false, vertical: true)
                if failed { Notice(CasyStrings.pushFailed, tone: .error).padding(.top, 12) }
                FlowButton(busy: busy, action: enable) { Text(CasyStrings.pushAskEnable) }
                    .accessibilityIdentifier("push.enable")
                    .padding(.top, 16)
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
            .accessibilityIdentifier("push.screen")
            .casySheetBar(
                CasyStrings.pushAskTitle(reason),
                // Only after a failure is there anything to put away.
                close: failed ? CasyStrings.pushAskLater : "", disabled: !failed || busy, action: onDone)
        }
        .interactiveDismissDisabled(!failed)
        .nativeSheetLook(preferences)
    }

    private func enable() {
        busy = true
        failed = false
        Task {
            defer { busy = false }
            // Granted or denied, iOS has had its say: the sheet's job is done.
            if await enablePush() == "failed" { failed = true } else { onDone() }
        }
    }
}

/// An app older than the oldest release we still work with (#143): over
/// everything, with a way to the App Store app (never Safari). Nothing else
/// can be done from here, so it has no way out.
struct UpdateRequiredScreen: View {
    let preferences: NativePreferences
    let storeURL: URL?

    @Environment(\.openURL) private var openURL

    /// The web's UpdateRequired (#281): over everything on the page's
    /// background, 16 apart and centred, circle-arrow-up (56, stroke 1.5,
    /// orange), the title (24 bold), the words (15 muted, at most 384 wide),
    /// and Åbn App Store as the web's solid orange capsule, as wide as its words.
    var body: some View {
        VStack(spacing: 16) {
            LucideIcon("circle-arrow-up", size: 56, stroke: 1.5)
                .foregroundStyle(Theme.primary.color)
            Text(CasyStrings.updateTitle)
                .font(.system(size: 24, weight: .bold))
                .foregroundStyle(Theme.foreground.color)
                .cssLineHeight(32, size: 24)
                .accessibilityAddTraits(.isHeader)
            Text(CasyStrings.updateBody)
                .font(.system(size: 15))
                .foregroundStyle(Theme.mutedForeground.color)
                .cssLineHeight(22.5, size: 15)
                .frame(maxWidth: 384)
                .fixedSize(horizontal: false, vertical: true)
            if let storeURL {
                Button { openURL(storeURL) } label: {
                    Text(CasyStrings.updateButton)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(.white)
                        .cssLineHeight(22.5, size: 15)
                        .padding(.horizontal, 24)
                        .padding(.vertical, 12)
                        .background(Theme.cta.color, in: Capsule(style: .circular))
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .padding(.top, 8)
            }
        }
        .multilineTextAlignment(.center)
        .padding(.horizontal, 32)
        // The web's `fixed inset-0`: centred in the whole screen, not under the clock.
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .ignoresSafeArea()
        .background(Theme.background.color.ignoresSafeArea())
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("update.screen")
        .interactiveDismissDisabled()
        .nativeSheetLook(preferences)
    }
}
