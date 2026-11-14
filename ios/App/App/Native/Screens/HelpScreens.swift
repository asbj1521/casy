import CasyCore
import CasyUI
import SwiftUI

/// The pages a link inside the app can open (#198): the help pages and Dine
/// data in Swift; anything else is still the web's, shown in the app's own
/// page (never Safari).
enum PageLink: Hashable {
    case support, howItWorks, terms, myData
    /// The privacy policy, at a section when it names one (/privacy#ai).
    case privacy(section: String?)

    init?(_ address: String) {
        let parts = address.split(separator: "#", maxSplits: 1).map(String.init)
        switch parts.first {
        case "/support": self = .support
        case "/how-it-works": self = .howItWorks
        case "/terms": self = .terms
        case "/privacy": self = .privacy(section: parts.count > 1 ? parts[1] : nil)
        case "/profile/data": self = .myData
        default: return nil
        }
    }
}

extension View {
    /// Links in this screen's text open the app's own pages, pushed on the
    /// sheet's stack; Mail opens for an address; anything else hands over to
    /// the web's page inside the app.
    func pageLinks(leave: @escaping (LeavingProfile) -> Void) -> some View {
        modifier(PageLinks(leave: leave))
    }
}

private struct PageLinks: ViewModifier {
    let leave: (LeavingProfile) -> Void
    @State private var next: PageLink?

    func body(content: Content) -> some View {
        content
            .environment(
                \.openURL,
                OpenURLAction { url in
                    if url.scheme == "mailto" { return .systemAction }
                    let address = url.absoluteString
                    if let page = PageLink(address) {
                        next = page
                    } else if address.hasPrefix("/") {
                        leave(.webScreen(address))
                    }
                    return .handled
                }
            )
            .navigationDestination(item: $next) { page in
                PageScreen(page: page, leave: leave)
            }
    }
}

/// The screen for a link's page.
struct PageScreen: View {
    let page: PageLink
    let leave: (LeavingProfile) -> Void

    var body: some View {
        switch page {
        case .support: LegalScreen(page: HelpPages.shared.support.current, leave: leave)
        case .howItWorks: HowItWorksScreen(leave: leave)
        case .terms: LegalScreen(page: HelpPages.shared.terms.current, leave: leave)
        case .privacy(let section):
            LegalScreen(page: HelpPages.shared.privacy.current, section: section, leave: leave)
        case .myData: MyDataScreen(leave: leave)
        }
    }
}

/// Hjælp og kontakt, Vilkår or Privatliv, as the web's LegalPage: when it
/// last changed, then plain sections.
struct LegalScreen: View {
    let page: HelpPages.Legal
    /// A section to open at.
    var section: String?
    let leave: (LeavingProfile) -> Void

    @Environment(\.closeSheet) private var closeSheet

    var body: some View {
        ScrollViewReader { reader in
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    Text(page.updated)
                        .font(.footnote)
                        .foregroundStyle(Theme.mutedForeground.color)
                    ForEach(page.sections) { s in
                        VStack(alignment: .leading, spacing: 10) {
                            Text(s.title)
                                .font(.headline)
                                .foregroundStyle(Theme.foreground.color)
                                .accessibilityAddTraits(.isHeader)
                            ForEach(Array(s.blocks.enumerated()), id: \.offset) { _, block in
                                BlockView(block: block)
                            }
                        }
                        .id(s.id)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
            .task {
                if let section { reader.scrollTo(section, anchor: .top) }
            }
        }
        .background(Theme.background.color)
        .tint(Theme.foreground.color)
        .casyPushedBar(page.title, close: CasyStrings.done, action: closeSheet)
        .pageLinks(leave: leave)
    }
}

private struct BlockView: View {
    let block: HelpPages.Block

    var body: some View {
        switch block {
        case .text(let words):
            paragraph(words)
        case .list(let items):
            VStack(alignment: .leading, spacing: 8) {
                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text("•").foregroundStyle(Theme.mutedForeground.color).accessibilityHidden(true)
                        paragraph(item)
                    }
                }
            }
        }
    }

    private func paragraph(_ words: String) -> some View {
        Text(HelpPages.text(words))
            .font(.subheadline)
            .foregroundStyle(Theme.mutedForeground.color)
            .lineSpacing(3)
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// Sådan virker det (#271): six steps down a line, what we never see, and the
/// way back to planning.
struct HowItWorksScreen: View {
    let leave: (LeavingProfile) -> Void

    @Environment(\.closeSheet) private var closeSheet
    private let icons = [
        "person.crop.circle.badge.checkmark", "calendar.badge.plus", "person.3", "sparkles",
        "hand.raised", "calendar.badge.checkmark",
    ]

    var body: some View {
        let c = HelpPages.shared.howItWorks.current
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text(c.eyebrow.uppercased())
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.primary.color)
                Text(c.title)
                    .font(.title2.weight(.bold))
                    .padding(.top, 6)
                    .accessibilityAddTraits(.isHeader)
                Text(c.intro)
                    .font(.body)
                    .foregroundStyle(Theme.mutedForeground.color)
                    .padding(.top, 10)
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(c.steps.enumerated()), id: \.offset) { i, step in
                        stepRow(i, step, last: i == c.steps.count - 1)
                    }
                }
                .padding(.top, 28)
                neverSees(c)
                    .padding(.top, 32)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .background(Theme.background.color)
        .safeAreaInset(edge: .bottom) {
            FlowButton(action: closeSheet) {
                Label(c.plan, systemImage: "arrow.right").labelStyle(TrailingIcon())
            }
            // The home page under the sheet has a Planlæg of its own.
            .accessibilityIdentifier("howItWorks.plan")
            .padding(.horizontal, 16)
            .padding(.bottom, 8)
        }
        .casyPushedBar(c.eyebrow, close: CasyStrings.done, action: closeSheet)
        .pageLinks(leave: leave)
    }

    private func stepRow(_ i: Int, _ step: HelpPages.HowItWorks.Step, last: Bool) -> some View {
        HStack(alignment: .top, spacing: 16) {
            ZStack(alignment: .topTrailing) {
                Image(systemName: icons[i % icons.count])
                    .font(.system(size: 19))
                    .foregroundStyle(Theme.primary.color)
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(Theme.primary.color.opacity(0.1)))
                Text("\(i + 1)")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.white)
                    .frame(width: 20, height: 20)
                    .background(Circle().fill(Theme.cta.color))
                    .offset(x: 4, y: -4)
            }
            .frame(maxHeight: .infinity, alignment: .top)
            .background(alignment: .top) {
                // The line down to the next step.
                if !last {
                    Capsule()
                        .fill(Theme.primary.color.opacity(0.15))
                        .frame(width: 2)
                        .padding(.top, 50)
                }
            }
            .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text(step.title).font(.headline)
                Text(step.body)
                    .font(.subheadline)
                    .foregroundStyle(Theme.mutedForeground.color)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.top, 6)
            .padding(.bottom, last ? 0 : 28)
            .accessibilityElement(children: .combine)
            .accessibilityLabel("\(i + 1). \(step.title). \(step.body)")
        }
    }

    private func neverSees(_ c: HelpPages.HowItWorks) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(c.neverSeesTitle, systemImage: "eye.slash")
                .font(.headline)
                .labelStyle(.titleAndIcon)
                .accessibilityAddTraits(.isHeader)
            Text(HelpPages.text("\(c.neverSeesBody) [\(c.privacyLink)](/privacy)."))
                .font(.subheadline)
                .foregroundStyle(Theme.mutedForeground.color)
                .tint(Theme.foreground.color)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.secondary.color))
    }
}

/// The words, then the arrow after them, as the web's button.
private struct TrailingIcon: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 8) {
            configuration.title
            configuration.icon
        }
    }
}
