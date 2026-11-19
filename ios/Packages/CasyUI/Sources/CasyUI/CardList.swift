// The web's grouped list (src/components/ui/ListGroup.tsx), drawn as the web
// draws it (#281, docs/native-visual-parity.md): rows in one rounded card,
// split by hairlines that start after the icon, an optional small heading
// above and a footnote below. Not a SwiftUI `List`, whose spacing, colours and
// row heights are iOS's. Put it in a `ScrollView`.
//
// The web's values, in points (1 CSS px = 1 point at the default text size):
//   ListGroup  mt-6 (24) above; heading mb-1.5 (6) px-4 (16) 12 medium
//              uppercase tracking-wide (0.025 em) muted; card rounded-2xl (16),
//              1 border, bg-card, clipped; footnote mt-1.5 (6) px-4 12 muted.
//   ListRow    pl-4 (16), gap-3 (12); icon 20 muted (the tone's colour for
//              danger and primary), gone at the largest text sizes; then the
//              hairline part: min-h 52, py-2.5 (10), pr-4 (16), gap-3 (12),
//              1 border on top except the first row's; label 15 medium, one
//              line cut with "..."; detail 13 muted, one line; value 14 muted;
//              chevron 16 muted at 60 %. Pressed: bg-secondary. `wrap`: the
//              detail runs over several lines (ListSwitchRow's).

import SwiftUI

/// Rows in one rounded card, as the web's `ListGroup`.
public struct CardList<Content: View>: View {
    private let title: String?
    private let footnote: Text?
    private let spaced: Bool
    private let accessory: AnyView?
    private let content: Content

    /// `spaced: false` leaves out the 24 points above (the web's `mt-0`).
    /// `accessory` follows the heading, 8 points after it (a group's
    /// Medlemmer and its ?).
    public init(
        _ title: String? = nil, footnote: String? = nil, spaced: Bool = true,
        accessory: AnyView? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.init(
            title, footnoteText: footnote.map { Text(verbatim: $0) }, spaced: spaced, accessory: accessory,
            content: content)
    }

    /// A footnote with more in it than words: a link, an error under it.
    public init(
        _ title: String? = nil, footnoteText: Text?, spaced: Bool = true,
        accessory: AnyView? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.footnote = footnoteText
        self.spaced = spaced
        self.accessory = accessory
        self.content = content()
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let title {
                // Capitals drawn only, as the web's CSS `uppercase`: VoiceOver
                // reads the word as written.
                HStack(spacing: 8) {
                    Text(title)
                        .textCase(.uppercase)
                        .accessibilityLabel(title)
                        .font(.system(size: 12, weight: .medium))
                        .tracking(0.3)
                        .foregroundStyle(Theme.mutedForeground.color)
                        .cssLineHeight(16, size: 12)
                        .accessibilityAddTraits(.isHeader)
                    if let accessory { accessory }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 6)
            }
            VStack(spacing: 0) {
                Group(subviews: content) { rows in
                    ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                        row.environment(\.cardRowIsFirst, index == 0)
                    }
                }
            }
            // The first row's hairline covered by the card: the environment
            // above reaches a row inside a button, not a plain one (a member,
            // a switch row), whose line then sat on the card's top edge.
            .overlay(alignment: .top) {
                Rectangle().fill(Theme.card.color).frame(height: 1).allowsHitTesting(false)
            }
            // The border is outside the rows, as the web's (its rows are 52
            // inside a 1 point border, the card 2 taller than its rows).
            .padding(1)
            .background(Theme.card.color)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(Theme.border.color, lineWidth: 1)
            }
            if let footnote {
                footnote
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.mutedForeground.color)
                    .cssLineHeight(16, size: 12)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, 16)
                    .padding(.top, 6)
            }
        }
        .padding(.top, spaced ? 24 : 0)
    }
}

extension EnvironmentValues {
    /// The first row of a `CardList` has no hairline above it.
    @Entry public var cardRowIsFirst = false
}

/// One row of a `CardList`, as the web's `ListRow`: an icon (the web's lucide
/// name) or anything else in front, the label with an optional line under it,
/// a value, anything else at the end, and a chevron when it leads somewhere.
/// Put it in a `Button` or `NavigationLink` with `.buttonStyle(.cardRow)`.
public struct CardRow<Leading: View, Trailing: View>: View {
    private let label: String
    private let detail: String?
    private let value: String?
    private let tone: RowTone
    private let chevron: Bool
    private let expanded: Bool?
    private let wrap: Bool
    private let leading: Leading
    private let trailing: Trailing
    @Environment(\.cardRowIsFirst) private var isFirst
    @Environment(\.dynamicTypeSize) private var textSize

    public init(
        _ label: String,
        detail: String? = nil,
        value: String? = nil,
        tone: RowTone = .standard,
        chevron: Bool = false,
        expanded: Bool? = nil,
        wrap: Bool = false,
        @ViewBuilder leading: () -> Leading,
        @ViewBuilder trailing: () -> Trailing = { EmptyView() }
    ) {
        self.label = label
        self.detail = detail
        self.value = value
        self.tone = tone
        self.chevron = chevron
        self.expanded = expanded
        self.wrap = wrap
        self.leading = leading()
        self.trailing = trailing()
    }

    public var body: some View {
        HStack(spacing: 12) {
            leading
            HStack(spacing: 12) {
                // The web's lines are 1.5 high (22.5 for the label, 19.5 for
                // the detail): the room above and under each line added.
                VStack(alignment: .leading, spacing: 0) {
                    Text(label)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(tone.color)
                        .lineLimit(1)
                        .cssLineHeight(22.5, size: 15)
                    if let detail {
                        Text(detail)
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.mutedForeground.color)
                            .lineLimit(wrap ? nil : 1)
                            .cssLineHeight(19.5, size: 13)
                            .fixedSize(horizontal: false, vertical: wrap)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if let value {
                    Text(value)
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.mutedForeground.color)
                        .fixedSize()
                }
                trailing
                // `expanded`: a row that opens rows under it, its chevron
                // turned down while open (the web's rotate-90).
                if chevron || expanded != nil {
                    LucideIcon("chevron-right", size: 16)
                        .foregroundStyle(Theme.mutedForeground.color.opacity(0.6))
                        .rotationEffect(.degrees(expanded == true ? 90 : 0))
                        .animation(.easeOut(duration: 0.15), value: expanded)
                }
            }
            .padding(.vertical, 10)
            .padding(.trailing, 16)
            .frame(minHeight: 52)
            .overlay(alignment: .top) {
                if !isFirst {
                    Rectangle().fill(Theme.border.color).frame(height: 1)
                }
            }
        }
        .padding(.leading, 16)
        .contentShape(Rectangle())
    }
}

extension CardRow where Leading == EmptyView, Trailing == EmptyView {
    /// A row with nothing in front or after: a fact, a fold. No closure, so
    /// `CardRow(name) { Avatar(...) }` still means the avatar in front.
    public init(
        _ label: String,
        detail: String? = nil,
        value: String? = nil,
        tone: RowTone = .standard,
        chevron: Bool = false,
        expanded: Bool? = nil,
        wrap: Bool = false
    ) {
        self.init(
            label, detail: detail, value: value, tone: tone, chevron: chevron, expanded: expanded,
            wrap: wrap, leading: { EmptyView() }, trailing: { EmptyView() })
    }
}

extension CardRow where Leading == CardRowIcon {
    /// A row led by one of the web's lucide icons (`"settings"`, `"users"`).
    public init(
        _ label: String,
        icon: String,
        detail: String? = nil,
        value: String? = nil,
        tone: RowTone = .standard,
        chevron: Bool = false,
        wrap: Bool = false,
        @ViewBuilder trailing: () -> Trailing = { EmptyView() }
    ) {
        self.init(
            label, detail: detail, value: value, tone: tone, chevron: chevron, wrap: wrap,
            leading: { CardRowIcon(icon, tone: tone) }, trailing: trailing)
    }
}

/// A row's 20 point icon, muted (or the tone's colour), gone at the largest
/// text sizes so the words fit (the web's `large-text:hidden`).
public struct CardRowIcon: View {
    private let name: String
    private let tone: RowTone
    @Environment(\.dynamicTypeSize) private var textSize

    public init(_ name: String, tone: RowTone = .standard) {
        self.name = name
        self.tone = tone
    }

    public var body: some View {
        if !textSize.isAccessibilitySize {
            LucideIcon(name, size: 20)
                .foregroundStyle(tone == .standard ? Theme.mutedForeground.color : tone.color)
        }
    }
}

/// How many wait for an answer, at a row's end (the web's GroupsRow): a 20
/// point orange circle at least, 6 points of padding, 12 point semibold white.
public struct CardRowCount: View {
    private let count: Int

    public init(_ count: Int) { self.count = count }

    public var body: some View {
        if count > 0 {
            Text(verbatim: "\(count)")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.primaryForeground.color)
                .padding(.horizontal, 6)
                .frame(minWidth: 20, minHeight: 20)
                .background(Theme.primary.color, in: Capsule())
        }
    }
}

/// A `CardRow` pressed: the web's `active:bg-secondary`, nothing else.
public struct CardRowPress: ButtonStyle {
    public init() {}

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(configuration.isPressed ? Theme.secondary.color : .clear)
    }
}

extension ButtonStyle where Self == CardRowPress {
    public static var cardRow: CardRowPress { CardRowPress() }
}

extension View {
    /// The web's CSS line height for text of `size` points: the system font's
    /// own line is `size * 1.193`; the rest goes between lines and, halved,
    /// above the first and under the last, as CSS puts it.
    public func cssLineHeight(_ height: CGFloat, size: CGFloat) -> some View {
        let natural = size * 1.193
        let extra = max(0, height - natural)
        return lineSpacing(extra).padding(.vertical, extra / 2)
    }
}
