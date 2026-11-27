import CasyCore
import CasyUI
import SwiftUI

/// What the Apple Calendar guide's "I have the password" does: opened from
/// the Apple form, back to it. Elsewhere (Hjælp og kontakt) it has none.
extension EnvironmentValues {
    @Entry var appleGuideNext: (() -> Void)?
}

/// The shared frame of the two connect guides, as the web's HelpGuide on a
/// phone: the eyebrow (14 semibold orange capitals), the title (24 bold), the
/// intro (14 muted), then cards 16 apart.
private struct GuideFrame<Content: View>: View {
    let eyebrow: String
    let title: String
    let intro: String
    @ViewBuilder let content: Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text(eyebrow)
                    .textCase(.uppercase)
                    .font(.system(size: 14, weight: .semibold))
                    .tracking(0.35)
                    .foregroundStyle(Theme.primary.color)
                    .cssLineHeight(20, size: 14)
                Text(title)
                    .font(.system(size: 24, weight: .bold))
                    .tracking(-0.6)
                    .foregroundStyle(Theme.foreground.color)
                    .cssLineHeight(32, size: 24)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 8)
                    .accessibilityAddTraits(.isHeader)
                Text(intro)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.mutedForeground.color)
                    .cssLineHeight(20, size: 14)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 12)
                content
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 64)
        }
        .background(Theme.background.color)
    }
}

/// A guide's card: the web's rounded-2xl border bg-card p-4, its icon in an
/// orange-tinted circle beside a small badge, the title and the words.
private struct GuideCard<Visual: View>: View {
    let icon: GuideIcon
    var badge: String?
    let title: String
    var body_: String?
    @ViewBuilder let visual: Visual

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                icon.view
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(Theme.primary.color.opacity(0.1)))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 0) {
                    if let badge {
                        Text(badge)
                            .textCase(.uppercase)
                            .font(.system(size: 12, weight: .semibold))
                            .tracking(0.3)
                            .foregroundStyle(Theme.primary.color)
                            .cssLineHeight(16, size: 12)
                    }
                    Text(title)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.foreground.color)
                        .cssLineHeight(24, size: 16)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)
                    if let body_ {
                        Text(body_)
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.mutedForeground.color)
                            .cssLineHeight(22.75, size: 14)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.top, 4)
                    }
                }
            }
            visual
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card.color, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.border.color))
    }
}

private enum GuideIcon {
    case lucide(String)
    case brand(String, Color)

    @ViewBuilder var view: some View {
        switch self {
        case .lucide(let name): LucideIcon(name, size: 16).foregroundStyle(Theme.primary.color)
        case .brand(let name, let color): LucideIcon(brand: name, size: 16).foregroundStyle(color)
        }
    }
}

/// An address in monospace with its copy button, as the web's drawn links.
private struct AddressRow: View {
    let address: String
    var copyable = false
    var dashed = false
    @State private var copied = false

    var body: some View {
        HStack(spacing: 8) {
            Text(verbatim: address)
                .font(.system(size: 12, design: .monospaced))
                .foregroundStyle(Theme.foreground.color)
                .lineLimit(1)
                .truncationMode(.tail)
                .frame(maxWidth: .infinity, alignment: .leading)
            if copyable {
                Button {
                    UIPasteboard.general.string = "https://\(address)"
                    copied = true
                    Task {
                        try? await Task.sleep(for: .seconds(2))
                        copied = false
                    }
                } label: {
                    HStack(spacing: 4) {
                        LucideIcon(copied ? "check" : "copy", size: 16)
                        Text(copied ? CasyStrings.copied : CasyStrings.copy).font(.system(size: 14))
                    }
                    .foregroundStyle(Theme.primary.color)
                    .fixedSize()
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("guide.copyAddress")
            } else {
                LucideIcon("copy", size: 16)
                    .foregroundStyle(Theme.mutedForeground.color)
                    .accessibilityHidden(true)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, copyable ? 10 : 8)
        .background(Theme.background.color, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .strokeBorder(Theme.border.color, style: StrokeStyle(lineWidth: 1, dash: dashed ? [4, 3] : []))
        )
    }
}

// MARK: Apple Calendar, as a list

/// Forbind din Apple-kalender (#202): the web's step-by-step guide with its
/// animated walkthrough, as one list in the iPhone's words. The app reads the
/// phone's own calendar, so an Apple account is only the other way in and
/// needs no film: what it takes, the steps at Apple (the first one sending
/// the person to Safari themselves, since the app never opens it), the two
/// things that go wrong, and what we keep.
struct AppleGuideScreen: View {
    @Environment(\.closeSheet) private var closeSheet
    @Environment(\.dismiss) private var dismiss
    @Environment(\.appleGuideNext) private var next

    private static let account = "account.apple.com/account/manage"

    var body: some View {
        let c = HelpPages.shared.appleGuide.current
        GuideFrame(eyebrow: c.eyebrow, title: c.title, intro: c.intro) {
            VStack(alignment: .leading, spacing: 16) {
                GuideCard(icon: .lucide("list-checks"), title: c.needTitle) {
                    bullets(c.need)
                }
                GuideCard(icon: .brand("apple", Theme.primary.color), title: c.stepsTitle) {
                    VStack(alignment: .leading, spacing: 12) {
                        Notice(c.signIn, tone: .warning)
                        numbered(1) {
                            VStack(alignment: .leading, spacing: 8) {
                                stepText(CasyStrings.guidesAppleOpen)
                                AddressRow(address: Self.account, copyable: true)
                            }
                        }
                        ForEach(Array(c.steps.enumerated()), id: \.offset) { i, step in
                            numbered(i + 2) { stepText(step) }
                        }
                    }
                    .accessibilityIdentifier("appleGuide.steps")
                }
                FoldOut(title: c.failedTitle, text: c.failed)
                FoldOut(title: c.missingTitle, text: c.missing)
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .top, spacing: 8) {
                        LucideIcon("shield-check", size: 16)
                            .foregroundStyle(Theme.primary.color)
                            .padding(.top, 2)
                            .accessibilityHidden(true)
                        Text(c.safe)
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.mutedForeground.color)
                            .cssLineHeight(20, size: 14)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.secondary.color, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    Text(HelpPages.text(c.revoke, size: 12))
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.mutedForeground.color)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, 4)
                }
            }
            .padding(.top, 24)
        }
        .accessibilityIdentifier("help.appleGuide")
        .casyPushedBar(c.eyebrow, close: CasyStrings.done, action: closeSheet)
        .safeAreaInset(edge: .bottom) {
            if let next {
                FlowButton(action: {
                    dismiss()
                    next()
                }) {
                    Text(c.next)
                }
                .accessibilityIdentifier("appleGuide.next")
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
            }
        }
    }

    private func bullets(_ items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(items, id: \.self) { item in
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    LucideIcon("check", size: 14)
                        .foregroundStyle(Theme.primary.color)
                        .accessibilityHidden(true)
                    stepText(item)
                }
            }
        }
    }

    /// The web's checklist row: a 24 point orange-tinted circle with the number.
    private func numbered<Words: View>(_ n: Int, @ViewBuilder words: () -> Words) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text(verbatim: "\(n)")
                .font(.system(size: 12, weight: .semibold).monospacedDigit())
                .foregroundStyle(Theme.primary.color)
                .frame(width: 24, height: 24)
                .background(Circle().fill(Theme.primary.color.opacity(0.1)))
                .accessibilityHidden(true)
            words()
                .padding(.top, 2)
        }
        .accessibilityElement(children: .combine)
    }

    private func stepText(_ words: String) -> some View {
        Text(words)
            .font(.system(size: 14))
            .foregroundStyle(Theme.foreground.color)
            .cssLineHeight(22.75, size: 14)
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// The web's FoldOut: a question that opens to its answer.
private struct FoldOut: View {
    let title: String
    let text: String
    @State private var open = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation(.easeOut(duration: 0.2)) { open.toggle() }
            } label: {
                HStack(spacing: 8) {
                    Text(title)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Theme.foreground.color)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    LucideIcon("chevron-down", size: 16)
                        .foregroundStyle(Theme.mutedForeground.color)
                        .rotationEffect(.degrees(open ? 180 : 0))
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityAddTraits(open ? .isSelected : [])
            if open {
                Rectangle().fill(Theme.border.color).frame(height: 1)
                Text(text)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.mutedForeground.color)
                    .cssLineHeight(22.75, size: 14)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.background.color, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Theme.border.color))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

// MARK: Find your calendar's link

/// Find din kalenders link (#202), as the web's ConnectIcsHelp on a phone:
/// the warning in a grey box, then five places a link comes from, each with
/// its drawing of that app's screen.
struct LinkGuideScreen: View {
    @Environment(\.closeSheet) private var closeSheet

    var body: some View {
        let c = HelpPages.shared.linkGuide.current
        GuideFrame(eyebrow: c.eyebrow, title: c.title, intro: c.intro) {
            HStack(alignment: .top, spacing: 8) {
                LucideIcon("info", size: 16)
                    .foregroundStyle(Theme.primary.color)
                    .padding(.top, 2)
                    .accessibilityHidden(true)
                Text(c.warning)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.mutedForeground.color)
                    .cssLineHeight(20, size: 14)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.secondary.color, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .padding(.top, 24)
            VStack(alignment: .leading, spacing: 16) {
                ForEach(c.sources) { source in
                    GuideCard(icon: icon(source.id), badge: source.badge, title: source.title, body_: source.body) {
                        drawing(source.id, c.mock)
                    }
                }
            }
            .padding(.top, 32)
        }
        .accessibilityIdentifier("help.linkGuide")
        .casyPushedBar(c.eyebrow, close: CasyStrings.done, action: closeSheet)
    }

    private func icon(_ id: String) -> GuideIcon {
        switch id {
        case "google": .brand("google", Theme.primary.color)
        case "outlook": .brand("microsoft", Theme.primary.color)
        case "platform": .lucide("building-complex")
        default: .brand("apple", Theme.primary.color)
        }
    }

    @ViewBuilder private func drawing(_ id: String, _ m: HelpPages.LinkGuide.Mock) -> some View {
        switch id {
        case "subscribed": subscribed(m)
        case "own":
            panel(m.sharing) {
                VStack(spacing: 12) {
                    HStack {
                        Text(m.publicCalendar).font(.system(size: 14)).foregroundStyle(Theme.foreground.color)
                        Spacer()
                        Capsule().fill(Theme.primary.color).frame(width: 36, height: 20)
                            .overlay(alignment: .trailing) {
                                Circle().fill(.white).frame(width: 16, height: 16).padding(.trailing, 2)
                            }
                    }
                    AddressRow(address: "webcal://p01-caldav.icloud.com/published/2/…", dashed: true)
                }
                .padding(16)
            }
        case "google":
            panel(m.integrate) {
                HStack {
                    Text(m.secretAddress)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Theme.primary.color)
                    Spacer()
                    LucideIcon("copy", size: 16).foregroundStyle(Theme.primary.color)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Theme.primary.color.opacity(0.1), in: RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(Theme.primary.color.opacity(0.4)))
                .padding(16)
            }
        case "outlook":
            panel(m.publishTitle) {
                VStack(alignment: .leading, spacing: 12) {
                    Text(m.canView)
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.mutedForeground.color)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.secondary.color.opacity(0.4), in: RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(Theme.border.color))
                    Text(m.publish)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Theme.cta.color, in: Capsule())
                    AddressRow(address: "https://outlook.office365.com/owa/calendar/…/calendar.ics", dashed: true)
                }
                .padding(16)
            }
        default:
            VStack(alignment: .leading, spacing: 12) {
                WrapLayout(spacing: 8) {
                    ForEach(m.keywords, id: \.self) { word in
                        Text(word)
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.foreground.color)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 4)
                            .background(Theme.secondary.color.opacity(0.4), in: Capsule())
                            .overlay(Capsule().strokeBorder(Theme.border.color))
                    }
                }
                Text(HelpPages.text(m.looksLike))
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.mutedForeground.color)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.background.color, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Theme.border.color))
        }
    }

    /// Apple Calendar's sidebar with Skole picked, its menu open on Vis info, and the link under it.
    private func subscribed(_ m: HelpPages.LinkGuide.Mock) -> some View {
        VStack(spacing: 0) {
            HStack(alignment: .top, spacing: 0) {
                VStack(spacing: 0) {
                    ForEach(Array(m.sidebar.enumerated()), id: \.offset) { i, name in
                        Text(name)
                            .font(.system(size: 14, weight: i == 1 ? .medium : .regular))
                            .foregroundStyle(i == 1 ? Theme.primary.color : Theme.mutedForeground.color)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(i == 1 ? Theme.primary.color.opacity(0.1) : .clear)
                            .overlay(i == 1 ? Rectangle().strokeBorder(Theme.primary.color.opacity(0.4)) : nil)
                        if i < m.sidebar.count - 1 { Rectangle().fill(Theme.border.color).frame(height: 1) }
                    }
                }
                .frame(width: 104)
                .background(Theme.secondary.color.opacity(0.4))
                Rectangle().fill(Theme.border.color).frame(width: 1)
                VStack(alignment: .leading, spacing: 0) {
                    Text(m.getInfo)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Theme.primary.color)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Theme.primary.color.opacity(0.1), in: RoundedRectangle(cornerRadius: 6))
                    Text(m.unsubscribe)
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.mutedForeground.color)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                }
                .padding(4)
                .frame(maxWidth: 176, alignment: .leading)
                .background(Theme.background.color, in: RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(Theme.border.color))
                .shadow(color: .black.opacity(0.1), radius: 6, y: 4)
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            Rectangle().fill(Theme.border.color).frame(height: 1)
            HStack {
                Text(verbatim: "webcal://timetable.school.edu/feed/1234.ics")
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundStyle(Theme.foreground.color)
                    .lineLimit(1)
                Spacer(minLength: 8)
                LucideIcon("copy", size: 16).foregroundStyle(Theme.mutedForeground.color)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .background(Theme.background.color)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Theme.border.color))
        .accessibilityHidden(true)
    }

    /// The web's MockPanel: a drawn dialog, a small title bar over its contents.
    private func panel<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.mutedForeground.color)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .frame(maxWidth: .infinity, alignment: .leading)
            Rectangle().fill(Theme.border.color).frame(height: 1)
            content()
        }
        .background(Theme.background.color)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Theme.border.color))
        .accessibilityHidden(true)
    }
}
