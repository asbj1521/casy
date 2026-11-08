// The glass and the buttons made of it. Every choice between iOS 26's real
// Liquid Glass and the frosted material before it is made here, never in a screen.

import SwiftUI

extension View {
    /// A capsule of glass behind the view: real on iOS 26, frosted before it.
    @ViewBuilder
    public func casyGlass() -> some View {
        if #available(iOS 26, macOS 26, *) {
            glassEffect(.regular.interactive(), in: .capsule)
        } else {
            background(.regularMaterial, in: Capsule())
        }
    }
}

/// How a pressed capsule answers: a small shrink, as on the web.
private struct PressStyle: ButtonStyle {
    let scale: CGFloat

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? scale : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

public enum FlowButtonKind: Sendable {
    /// The way on: orange.
    case main
    /// The second choice beside it: the text's own colour.
    case quiet
    /// What is lost for good: red.
    case danger
}

/// A screen's main action, a full-width glass capsule. One per sheet or screen,
/// pinned along the bottom with `.safeAreaInset(edge: .bottom)`.
public struct FlowButton<Label: View>: View {
    private let kind: FlowButtonKind
    private let busy: Bool
    private let action: () -> Void
    private let label: Label
    @ScaledMetric(relativeTo: .body) private var height: CGFloat = 48
    @Environment(\.isEnabled) private var isEnabled

    public init(
        kind: FlowButtonKind = .main,
        busy: Bool = false,
        action: @escaping () -> Void,
        @ViewBuilder label: () -> Label
    ) {
        self.kind = kind
        self.busy = busy
        self.action = action
        self.label = label()
    }

    private var foreground: Color {
        switch kind {
        case .main: Theme.primary.color
        case .quiet: Theme.foreground.color
        case .danger: Theme.red600.color
        }
    }

    public var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if busy { ProgressView().controlSize(.small) }
                label
            }
            .font(.body.weight(kind == .quiet ? .semibold : .bold))
            .foregroundStyle(foreground)
            .frame(maxWidth: .infinity, minHeight: height)
            .contentShape(Capsule())
            .casyGlass()
            .opacity(isEnabled && !busy ? 1 : 0.5)
        }
        .buttonStyle(PressStyle(scale: 0.98))
        .disabled(busy)
    }
}

public enum GlassButtonSize: Sendable {
    case medium, small
}

/// A button on its own: a glass capsule with orange text and icon.
public struct GlassButton<Label: View>: View {
    private let systemImage: String?
    private let size: GlassButtonSize
    private let busy: Bool
    private let action: () -> Void
    private let label: Label
    @Environment(\.isEnabled) private var isEnabled

    public init(
        systemImage: String? = nil,
        size: GlassButtonSize = .medium,
        busy: Bool = false,
        action: @escaping () -> Void,
        @ViewBuilder label: () -> Label
    ) {
        self.systemImage = systemImage
        self.size = size
        self.busy = busy
        self.action = action
        self.label = label()
    }

    public var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if busy {
                    ProgressView().controlSize(.small)
                } else if let systemImage {
                    Image(systemName: systemImage)
                }
                label
            }
            .font(size == .medium ? .body : .subheadline.weight(.semibold))
            .foregroundStyle(Theme.primary.color)
            .padding(.horizontal, size == .medium ? 18 : 14)
            // 44 points to touch, however small it is drawn.
            .frame(minHeight: size == .medium ? 44 : 36)
            .casyGlass()
            .contentShape(Capsule())
            .frame(minHeight: 44)
            .opacity(isEnabled && !busy ? 1 : 0.5)
        }
        .buttonStyle(PressStyle(scale: 0.95))
        .disabled(busy)
    }
}
