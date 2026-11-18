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
//              chevron 16 muted at 60 %. Pressed: bg-secondary.

import SwiftUI

/// Rows in one rounded card, as the web's `ListGroup`.
public struct CardList<Content: View>: View {
    private let title: String?
    private let footnote: String?
    private let spaced: Bool
    private let content: Content

    /// `spaced: false` leaves out the 24 points above (the web's `mt-0`).
    public init(
        _ title: String? = nil, footnote: String? = nil, spaced: Bool = true,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.footnote = footnote
        self.spaced = spaced
        self.content = content()
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let title {
                Text(title.uppercased())
                    .font(.system(size: 12, weight: .medium))
                    .tracking(0.3)
                    .foregroundStyle(Theme.mutedForeground.color)
                    .padding(.horizontal, 16)
                    .padding(.bottom, 6)
                    .accessibilityAddTraits(.isHeader)
            }
            VStack(spacing: 0) {
                Group(subviews: content) { rows in
                    ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                        row.environment(\.cardRowIsFirst, index == 0)
                    }
                }
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
                Text(footnote)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.mutedForeground.color)
                    .padding(.horizontal, 16)
                    .padding(.top, 6)
            }
        }
        .padding(.top, spaced ? 24 : 0)
    }
}

extension EnvironmentValues {
    /// The first row of a `CardList` has no hairline above it.
    @Entry var cardRowIsFirst = false
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
        @ViewBuilder leading: () -> Leading,
        @ViewBuilder trailing: () -> Trailing = { EmptyView() }
    ) {
        self.label = label
        self.detail = detail
        self.value = value
        self.tone = tone
        self.chevron = chevron
        self.leading = leading()
        self.trailing = trailing()
    }

    public var body: some View {
        HStack(spacing: 12) {
            leading
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 0) {
                    Text(label)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(tone.color)
                        .lineLimit(1)
                    if let detail {
                        Text(detail)
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.mutedForeground.color)
                            .lineLimit(1)
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
                if chevron {
                    LucideIcon("chevron-right", size: 16)
                        .foregroundStyle(Theme.mutedForeground.color.opacity(0.6))
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

extension CardRow where Leading == CardRowIcon {
    /// A row led by one of the web's lucide icons (`"settings"`, `"users"`).
    public init(
        _ label: String,
        icon: String,
        detail: String? = nil,
        value: String? = nil,
        tone: RowTone = .standard,
        chevron: Bool = false,
        @ViewBuilder trailing: () -> Trailing = { EmptyView() }
    ) {
        self.init(
            label, detail: detail, value: value, tone: tone, chevron: chevron,
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
