// The smaller pieces: a text field with its label, someone's picture or letter,
// a message after its icon, and a button that asks first.

import SwiftUI

/// A text field as the web's `FIELD` (src/components/ui/field.ts): 48 tall,
/// 17 point, rounded-xl (12), 1 border on the card's colour, 14 points in,
/// orange border and a 2 point orange ring at 20 % while typing; its label
/// above as `FIELD_LABEL`: 12 medium capitals, tracked, muted, 4 in, 6 above
/// the field. `label: nil` for a field on its own (an email to add); `weight`
/// for a group's name (semibold). `lines` over 1 makes it grow; `secure`
/// hides what is typed (a password).
public struct CasyField: View {
    private let label: String?
    private let placeholder: String
    private let lines: Int
    private let secure: Bool
    private let weight: Font.Weight
    private let accessibility: String
    private let autofocus: Bool
    @Binding private var text: String
    @FocusState private var focused: Bool
    @ScaledMetric(relativeTo: .body) private var height: CGFloat = 48
    @ScaledMetric(relativeTo: .body) private var textSize: CGFloat = 17

    public init(
        _ label: String?,
        text: Binding<String>,
        placeholder: String = "",
        lines: Int = 1,
        secure: Bool = false,
        weight: Font.Weight = .regular,
        accessibilityLabel: String? = nil,
        autofocus: Bool = false
    ) {
        self.autofocus = autofocus
        self.label = label
        self._text = text
        self.placeholder = placeholder
        self.lines = lines
        self.secure = secure
        self.weight = weight
        self.accessibility = accessibilityLabel ?? label ?? placeholder
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let label {
                Text(label)
                    .textCase(.uppercase)
                    .font(.system(size: 12, weight: .medium))
                    .tracking(0.3)
                    .foregroundStyle(Theme.mutedForeground.color)
                    .cssLineHeight(16, size: 12)
                    .padding(.horizontal, 4)
                    .accessibilityHidden(true)
            }
            field
                .font(.system(size: textSize, weight: weight))
                .foregroundStyle(Theme.foreground.color)
                .textFieldStyle(.plain)
                .focused($focused)
                .padding(.horizontal, 14)
                .padding(.vertical, lines > 1 ? 10 : 0)
                .frame(minHeight: height)
                .background(Theme.card.color, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .strokeBorder(focused ? Theme.primary.color : Theme.border.color, lineWidth: 1)
                }
                .background {
                    // focus:ring-2 ring-primary/20, outside the border.
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(Theme.primary.color.opacity(focused ? 0.2 : 0))
                        .padding(-2)
                }
                .contentShape(Rectangle())
                .onTapGesture { focused = true }
                .accessibilityLabel(accessibility)
                // The web's autoFocus: the keyboard up once it is on screen.
                .task {
                    guard autofocus else { return }
                    try? await Task.sleep(for: .milliseconds(150))
                    focused = true
                }
        }
    }

    @ViewBuilder private var field: some View {
        let prompt = Text(placeholder).foregroundStyle(Theme.mutedForeground.color)
        if secure {
            SecureField("", text: $text, prompt: prompt)
        } else {
            TextField("", text: $text, prompt: prompt, axis: lines > 1 ? .vertical : .horizontal)
                .lineLimit(lines > 1 ? lines...(lines * 3) : 1...1)
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
    /// At the top of a group's screen.
    case extraLarge = 96
    /// Alone at the top of a screen: an invitation's group.
    case hero = 112
}

extension AvatarSize {
    /// The letter's size, as the web's Avatar sizes it (`text-xl` in `lg`);
    /// the sizes the web doesn't have keep 42 % of the circle.
    var letterSize: CGFloat {
        switch self {
        case .extraSmall: 10
        case .small: 11
        case .medium: 12
        case .row: 16
        case .large: 20
        // A group's screen: h-24 with text-[2rem].
        case .extraLarge: 32
        // An invitation's or a group's sheet: h-28 with text-[2.5rem].
        case .hero: 40
        }
    }
}

/// The letter shown without a picture: a name's first, in capitals.
public func avatarLetter(_ name: String) -> String {
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
                .font(.system(size: size.letterSize, weight: .semibold))
                .foregroundStyle(colors.text.color)
        }
    }

    public var body: some View {
        Group {
            if let url {
                // Kept once fetched, so it doesn't flash its letter each time (#199).
                RemoteImage(url: url) { letter }
                    .scaledToFill()
                    .clipShape(Circle())
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

    /// The web's lucide icon for the tone (Notice.tsx).
    var icon: String {
        switch self {
        case .error: "circle-x"
        case .success: "circle-check"
        case .warning: "triangle-alert"
        case .info: "info"
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

    /// The web's Notice: a 16 point icon 2 below the top, 8 before 14 point
    /// words (20 high lines).
    private var line: some View {
        HStack(alignment: .top, spacing: 8) {
            LucideIcon(tone.icon, size: 16)
                .padding(.top, 2)
                .accessibilityHidden(true)
            Text(text)
                .font(.system(size: 14))
                .cssLineHeight(20, size: 14)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    public var body: some View {
        Group {
            if bare {
                line.foregroundStyle(tone.bareText)
            } else {
                line
                    .foregroundStyle(tone.boxText)
                    .padding(12)
                    .background(tone.boxBackground, in: RoundedRectangle(cornerRadius: 8))
                    .overlay {
                        RoundedRectangle(cornerRadius: 8).strokeBorder(tone.boxBorder, lineWidth: 1)
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

