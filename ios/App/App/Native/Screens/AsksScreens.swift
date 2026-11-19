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

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "arrow.up.circle")
                .font(.system(size: 56, weight: .light))
                .foregroundStyle(Theme.primary.color)
                .accessibilityHidden(true)
            Text(CasyStrings.updateTitle)
                .font(.title.bold())
                .foregroundStyle(Theme.foreground.color)
                .accessibilityAddTraits(.isHeader)
            Text(CasyStrings.updateBody)
                .font(.subheadline)
                .foregroundStyle(Theme.mutedForeground.color)
                .frame(maxWidth: 360)
            if let storeURL {
                FlowButton(kind: .solid, action: { openURL(storeURL) }) { Text(CasyStrings.updateButton) }
                    .frame(maxWidth: 360)
                    .padding(.top, 8)
            }
        }
        .multilineTextAlignment(.center)
        .padding(.horizontal, 32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.background.color.ignoresSafeArea())
        .interactiveDismissDisabled()
        .nativeSheetLook(preferences)
    }
}
