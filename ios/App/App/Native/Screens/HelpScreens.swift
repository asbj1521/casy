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
        case .support: LegalScreen(page: HelpPages.shared.support.current, name: "support", leave: leave)
        case .howItWorks: HowItWorksScreen(leave: leave)
        case .terms: LegalScreen(page: HelpPages.shared.terms.current, name: "terms", leave: leave)
        case .privacy(let section):
            LegalScreen(page: HelpPages.shared.privacy.current, name: "privacy", section: section, leave: leave)
        case .myData: MyDataScreen(leave: leave)
        }
    }
}

/// Hjælp og kontakt, Vilkår or Privatliv, as the web's LegalPage (#281):
/// the title (24 bold), when it last changed (14 muted), then sections 32
/// apart, each a heading (18 semibold) over paragraphs 12 apart (14 muted,
/// lines 1.625 high), the links and highlighted words medium.
struct LegalScreen: View {
    let page: HelpPages.Legal
    /// For the tests: `help.<name>`.
    var name = "legal"
    /// A section to open at.
    var section: String?
    let leave: (LeavingProfile) -> Void

    @Environment(\.closeSheet) private var closeSheet

    var body: some View {
        ScrollViewReader { reader in
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Text(page.title)
                        .font(.system(size: 24, weight: .bold))
                        .tracking(-0.6)
                        .foregroundStyle(Theme.foreground.color)
                        .cssLineHeight(32, size: 24)
                        .accessibilityAddTraits(.isHeader)
                    Text(page.updated)
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.mutedForeground.color)
                        .cssLineHeight(20, size: 14)
                        .padding(.top, 8)
                    ForEach(page.sections) { s in
                        VStack(alignment: .leading, spacing: 0) {
                            Text(s.title)
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundStyle(Theme.foreground.color)
                                .cssLineHeight(28, size: 18)
                                .accessibilityAddTraits(.isHeader)
                            VStack(alignment: .leading, spacing: 12) {
                                ForEach(Array(s.blocks.enumerated()), id: \.offset) { _, block in
                                    BlockView(block: block)
                                }
                            }
                            .padding(.top, 8)
                        }
                        .padding(.top, 32)
                        .id(s.id)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)
                .padding(.top, 16)
                .padding(.bottom, 64)
            }
            .task {
                if let section { reader.scrollTo(section, anchor: .top) }
            }
        }
        .accessibilityIdentifier("help.\(name)")
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
            // The web's list-disc pl-5 space-y-2.
            VStack(alignment: .leading, spacing: 8) {
                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    HStack(alignment: .firstTextBaseline, spacing: 0) {
                        // The web's disc: about 5 points across.
                        Text("•")
                            .font(.system(size: 20))
                            .foregroundStyle(Theme.mutedForeground.color)
                            .frame(width: 20, alignment: .center)
                            .accessibilityHidden(true)
                        paragraph(item)
                    }
                }
            }
        }
    }

    private func paragraph(_ words: String) -> some View {
        Text(HelpPages.text(words, size: 14))
            .font(.system(size: 14))
            .foregroundStyle(Theme.mutedForeground.color)
            .cssLineHeight(22.75, size: 14)
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// Sådan virker det (#271), as the web's HowItWorks page (#281): the eyebrow
/// (13 semibold orange capitals), the title (28 bold), the intro (16), six
/// steps down a line, each a 44 point orange-tinted circle with the web's
/// icon and its number, what we never see in a grey card, and Planlæg as a
/// glass capsule centred at the end.
struct HowItWorksScreen: View {
    let leave: (LeavingProfile) -> Void

    @Environment(\.closeSheet) private var closeSheet
    private let icons = ["log-in", "calendar-plus", "users", "sparkles", "hand", "calendar-check"]

    var body: some View {
        let c = HelpPages.shared.howItWorks.current
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text(c.eyebrow)
                    .textCase(.uppercase)
                    .font(.system(size: 13, weight: .semibold))
                    .tracking(0.33)
                    .foregroundStyle(Theme.primary.color)
                    .cssLineHeight(19.5, size: 13)
                Text(c.title)
                    .font(.system(size: 28, weight: .bold))
                    .tracking(-0.7)
                    .foregroundStyle(Theme.foreground.color)
                    .cssLineHeight(35, size: 28)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 8)
                    .accessibilityAddTraits(.isHeader)
                Text(c.intro)
                    .font(.system(size: 16))
                    .foregroundStyle(Theme.mutedForeground.color)
                    .cssLineHeight(26, size: 16)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 12)
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(c.steps.enumerated()), id: \.offset) { i, step in
                        stepRow(i, step, last: i == c.steps.count - 1)
                    }
                }
                .padding(.top, 32)
                neverSees(c)
                    .padding(.top, 40)
                Button(action: closeSheet) {
                    HStack(spacing: 8) {
                        Text(c.plan).font(.system(size: 17, weight: .semibold))
                        LucideIcon("arrow-right", size: 20)
                    }
                    .foregroundStyle(Theme.primary.color)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 12)
                    .casyGlass()
                    .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                // The home page under the sheet has a Planlæg of its own.
                .accessibilityIdentifier("howItWorks.plan")
                .frame(maxWidth: .infinity)
                .padding(.top, 40)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 64)
        }
        .accessibilityIdentifier("help.how")
        .background(Theme.background.color)
        .casyPushedBar(c.eyebrow, close: CasyStrings.done, action: closeSheet)
        .pageLinks(leave: leave)
    }

    private func stepRow(_ i: Int, _ step: HelpPages.HowItWorks.Step, last: Bool) -> some View {
        HStack(alignment: .top, spacing: 16) {
            ZStack(alignment: .topTrailing) {
                LucideIcon(icons[i % icons.count], size: 20)
                    .foregroundStyle(Theme.primary.color)
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(Theme.primary.color.opacity(0.1)))
                Text(verbatim: "\(i + 1)")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 20, height: 20)
                    .background(Circle().fill(Theme.cta.color))
                    .offset(x: 4, y: -4)
            }
            .frame(maxHeight: .infinity, alignment: .top)
            .background(alignment: .top) {
                // The line down to the next step: from 48 below the circle's top to the row's end.
                if !last {
                    Capsule()
                        .fill(Theme.primary.color.opacity(0.15))
                        .frame(width: 2)
                        .padding(.top, 48)
                }
            }
            .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 0) {
                Text(step.title)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Theme.foreground.color)
                    .cssLineHeight(25.5, size: 17)
                Text(step.body)
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.mutedForeground.color)
                    .cssLineHeight(24.375, size: 15)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 4)
            }
            .padding(.top, 6)
            .padding(.bottom, last ? 0 : 28)
            .accessibilityElement(children: .combine)
            .accessibilityLabel("\(i + 1). \(step.title). \(step.body)")
        }
    }

    private func neverSees(_ c: HelpPages.HowItWorks) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                LucideIcon("eye-off", size: 20).foregroundStyle(Theme.primary.color)
                Text(c.neverSeesTitle)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Theme.foreground.color)
                    .cssLineHeight(25.5, size: 17)
            }
            .accessibilityAddTraits(.isHeader)
            Text(HelpPages.text("\(c.neverSeesBody) [\(c.privacyLink)](/privacy).", size: 15))
                .font(.system(size: 15))
                .foregroundStyle(Theme.mutedForeground.color)
                .tint(Theme.foreground.color)
                .cssLineHeight(24.375, size: 15)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Theme.secondary.color))
    }
}
