// The smaller pieces: a text field with its label, someone's picture or letter,
// a message after its icon, and a button that asks first.

import SwiftUI

/// A text field as the Planlæg sheet has it: tall, 17 point, rounded, with a
/// small uppercase label above. `lines` over 1 makes it grow.
public struct CasyField: View {
    private let label: String
    private let placeholder: String
    private let lines: Int
    @Binding private var text: String
    @FocusState private var focused: Bool
    @ScaledMetric(relativeTo: .body) private var height: CGFloat = 48

    public init(
        _ label: String,
        text: Binding<String>,
        placeholder: String = "",
        lines: Int = 1
    ) {
        self.label = label
        self._text = text
        self.placeholder = placeholder
        self.lines = lines
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.caption.weight(.medium))
                .textCase(.uppercase)
                .foregroundStyle(Theme.mutedForeground.color)
                .padding(.horizontal, 4)
                .accessibilityHidden(true)
            TextField(placeholder, text: $text, axis: lines > 1 ? .vertical : .horizontal)
                .lineLimit(lines > 1 ? lines...(lines * 3) : 1...1)
                .font(.body)
                .foregroundStyle(Theme.foreground.color)
                .textFieldStyle(.plain)
                .focused($focused)
                .padding(.horizontal, 14)
                .padding(.vertical, lines > 1 ? 10 : 0)
                .frame(minHeight: height)
                .background(Theme.card.color, in: RoundedRectangle(cornerRadius: 12))
                .overlay {
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(
                            focused ? Theme.primary.color : Theme.border.color,
                            lineWidth: 1)
                }
                .accessibilityLabel(label)
        }
    }
}

public enum AvatarSize: CGFloat, Sendable {
    case extraSmall = 20
    case small = 24
    case medium = 32
    /// In front of a list row.
    case row = 40
    case large = 56
}

/// The letter shown without a picture: a name's first, in capitals.
func avatarLetter(_ name: String) -> String {
    let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.prefix(1).uppercased()
}

private let avatarPalette: [(background: CasyColor, text: CasyColor)] = [
    (Theme.emerald100, Theme.emerald700),
    (Theme.sky100, Theme.sky700),
    (Theme.amber100, Theme.amber700),
    (Theme.violet100, Theme.violet700),
    (Theme.rose100, Theme.rose700),
]

/// Which colours a place in a list gets, so neighbours never match.
func avatarColors(_ index: Int) -> (background: CasyColor, text: CasyColor) {
    let count = avatarPalette.count
    return avatarPalette[((index % count) + count) % count]
}

/// Someone's picture in a circle or, without one or while it can't be loaded,
/// their first letter. Silent for VoiceOver unless `labelled`, for where only
/// the letter shows.
public struct Avatar: View {
    private let name: String
    private let index: Int
    private let size: AvatarSize
    private let labelled: Bool
    private let url: URL?

    public init(
        name: String,
        index: Int,
        size: AvatarSize = .small,
        labelled: Bool = false,
        url: URL? = nil
    ) {
        self.name = name
        self.index = index
        self.size = size
        self.labelled = labelled
        self.url = url
    }

    private var letter: some View {
        let colors = avatarColors(index)
        return ZStack {
            Circle().fill(colors.background.color)
            Text(avatarLetter(name))
                .font(.system(size: size.rawValue * 0.42, weight: .semibold))
                .foregroundStyle(colors.text.color)
        }
    }

    public var body: some View {
        Group {
            if let url {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill().clipShape(Circle())
                    } else {
                        letter
                    }
                }
            } else {
                letter
            }
        }
        .frame(width: size.rawValue, height: size.rawValue)
        .accessibilityHidden(!labelled)
        .accessibilityLabel(name)
    }
}

public enum NoticeTone: Sendable {
    case error, success, warning, info

    var systemImage: String {
        switch self {
        case .error: "xmark.circle"
        case .success: "checkmark.circle"
        case .warning: "exclamationmark.triangle"
        case .info: "info.circle"
        }
    }

    var boxText: Color {
        switch self {
        case .error: Theme.red900.color
        case .success: Theme.emerald900.color
        case .warning: Theme.amber900.color
        case .info: Theme.mutedForeground.color
        }
    }

    var bareText: Color {
        switch self {
        case .error: Theme.red700.color
        case .success: Theme.emerald800.color
        case .warning: Theme.amber800.color
        case .info: Theme.mutedForeground.color
        }
    }

    var boxBackground: Color {
        switch self {
        case .error: Theme.red50.color
        case .success: Theme.emerald50.color
        case .warning: Theme.amber50.color
        case .info: Theme.secondary.color.opacity(0.4)
        }
    }

    var boxBorder: Color {
        switch self {
        case .error: Theme.red200.color
        case .success: Theme.emerald200.color
        case .warning: Theme.amber200.color
        case .info: Theme.border.color
        }
    }
}

/// A message after its icon. Boxed by default; `bare` is the same line
/// without the box, for a short result under the button that caused it. An
/// error is read out by VoiceOver as it appears.
public struct Notice: View {
    private let tone: NoticeTone
    private let text: String
    private let bare: Bool

    public init(_ text: String, tone: NoticeTone, bare: Bool = false) {
        self.text = text
        self.tone = tone
        self.bare = bare
    }

    private var line: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Image(systemName: tone.systemImage).accessibilityHidden(true)
            Text(text).frame(maxWidth: .infinity, alignment: .leading)
        }
        .font(.subheadline)
    }

    public var body: some View {
        Group {
            if bare {
                line.foregroundStyle(tone.bareText)
            } else {
                line
                    .foregroundStyle(tone.boxText)
                    .padding(12)
                    .background(tone.boxBackground, in: RoundedRectangle(cornerRadius: 12))
                    .overlay {
                        RoundedRectangle(cornerRadius: 12).stroke(tone.boxBorder, lineWidth: 1)
                    }
            }
        }
        .onAppear {
            if tone == .error {
                AccessibilityNotification.Announcement(text).post()
            }
        }
    }
}

/// The second step before anything that needs a yes: the system's own
/// question, red when something is lost for good.
public struct ConfirmButton<Label: View>: View {
    private let message: String
    private let confirmLabel: String
    private let destructive: Bool
    private let action: () -> Void
    private let label: Label
    @State private var asking = false

    public init(
        message: String,
        confirmLabel: String,
        destructive: Bool = true,
        action: @escaping () -> Void,
        @ViewBuilder label: () -> Label
    ) {
        self.message = message
        self.confirmLabel = confirmLabel
        self.destructive = destructive
        self.action = action
        self.label = label()
    }

    public var body: some View {
        Button {
            asking = true
        } label: {
            label
        }
        .confirmationDialog(message, isPresented: $asking, titleVisibility: .visible) {
            Button(confirmLabel, role: destructive ? .destructive : nil, action: action)
            Button(CasyStrings.cancel, role: .cancel) {}
        }
    }
}
