// A screen's rows, for use inside a `List`: choices are rows, picking puts an
// orange tick at the end, on or off is a switch. At the largest text sizes the
// icon goes, so the words fit.

import SwiftUI

public enum RowTone: Sendable {
    case standard, danger, primary

    var color: Color {
        switch self {
        case .standard: Theme.foreground.color
        case .danger: Theme.red600.color
        case .primary: Theme.primary.color
        }
    }
}

private struct RowIcon: View {
    let systemImage: String?
    let color: Color
    @Environment(\.dynamicTypeSize) private var textSize

    var body: some View {
        if let systemImage, !textSize.isAccessibilitySize {
            Image(systemName: systemImage)
                .foregroundStyle(color)
                .frame(width: 24)
                .accessibilityHidden(true)
        }
    }
}

private struct RowText: View {
    let label: String
    let detail: String?
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(color)
            if let detail {
                Text(detail)
                    .font(.footnote)
                    .foregroundStyle(Theme.mutedForeground.color)
            }
        }
    }
}

/// A plain row: an icon, its words, and a value at the end. Put it in a
/// `NavigationLink` or `Button` to make it do something.
public struct ListRow: View {
    private let systemImage: String?
    private let label: String
    private let detail: String?
    private let value: String?
    private let tone: RowTone

    public init(
        _ label: String,
        systemImage: String? = nil,
        detail: String? = nil,
        value: String? = nil,
        tone: RowTone = .standard
    ) {
        self.label = label
        self.systemImage = systemImage
        self.detail = detail
        self.value = value
        self.tone = tone
    }

    public var body: some View {
        HStack(spacing: 12) {
            RowIcon(
                systemImage: systemImage,
                color: tone == .standard ? Theme.mutedForeground.color : tone.color)
            RowText(label: label, detail: detail, color: tone.color)
            Spacer(minLength: 8)
            if let value {
                Text(value)
                    .font(.subheadline)
                    .foregroundStyle(Theme.mutedForeground.color)
            }
        }
    }
}

/// A choice: tap to pick it, an orange tick at the end when it is picked.
/// Disabled, it shows `value` instead of a tick.
public struct ListPickRow: View {
    private let label: String
    private let systemImage: String?
    private let detail: String?
    private let value: String?
    private let isSelected: Bool
    private let action: () -> Void
    @Environment(\.isEnabled) private var isEnabled

    public init(
        _ label: String,
        isSelected: Bool,
        systemImage: String? = nil,
        detail: String? = nil,
        value: String? = nil,
        action: @escaping () -> Void
    ) {
        self.label = label
        self.isSelected = isSelected
        self.systemImage = systemImage
        self.detail = detail
        self.value = value
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                RowIcon(systemImage: systemImage, color: Theme.mutedForeground.color)
                RowText(label: label, detail: detail, color: Theme.foreground.color)
                Spacer(minLength: 8)
                if isEnabled {
                    Image(systemName: "checkmark")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Theme.primary.color)
                        .opacity(isSelected ? 1 : 0)
                        .accessibilityHidden(true)
                } else if let value {
                    Text(value)
                        .font(.subheadline)
                        .foregroundStyle(Theme.mutedForeground.color)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

/// Something on or off: a switch at the end of the row.
public struct ListSwitchRow: View {
    private let label: String
    private let systemImage: String?
    private let detail: String?
    @Binding private var isOn: Bool

    public init(
        _ label: String,
        isOn: Binding<Bool>,
        systemImage: String? = nil,
        detail: String? = nil
    ) {
        self.label = label
        self._isOn = isOn
        self.systemImage = systemImage
        self.detail = detail
    }

    public var body: some View {
        Toggle(isOn: $isOn) {
            HStack(spacing: 12) {
                RowIcon(systemImage: systemImage, color: Theme.mutedForeground.color)
                RowText(label: label, detail: detail, color: Theme.foreground.color)
            }
        }
        .tint(Theme.primary.color)
    }
}
