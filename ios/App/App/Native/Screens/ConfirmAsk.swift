import CasyUI
import SwiftUI

/// The web's ConfirmPanel on a phone (#227, #281): a small "Er du sikker?"
/// sheet with what will happen (15 point), anything to type first, and the
/// button that does it as the FlowButton along the bottom (red when
/// something is lost for good); Annuller closes it, never while it runs.
/// Closes itself once the action is done; a failure stays in it.
struct ConfirmAsk: View {
    let message: String
    let confirmLabel: String
    var danger = true
    /// A name or word to type before the button works, and the line above the field.
    var typeToConfirm: (prompt: String, expected: String)?
    let action: () async throws -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var typed = ""
    @State private var busy = false
    @State private var failure: String?
    @State private var contentHeight: CGFloat = 80

    private var typedRight: Bool {
        guard let typeToConfirm else { return true }
        return typed.trimmingCharacters(in: .whitespaces).lowercased()
            == typeToConfirm.expected.trimmingCharacters(in: .whitespaces).lowercased()
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 0) {
                Text(message)
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.foreground.color)
                    .cssLineHeight(22.5, size: 15)
                    .fixedSize(horizontal: false, vertical: true)
                if let typeToConfirm {
                    Text(typeToConfirm.prompt)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Theme.foreground.color)
                        .padding(.top, 12)
                    TextField("", text: $typed)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.foreground.color)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .frame(maxWidth: 320)
                        .background(Theme.card.color, in: RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(Theme.red200.color, lineWidth: 1))
                        .padding(.top, 4)
                        .accessibilityLabel(typeToConfirm.prompt)
                }
                if let failure {
                    Notice(failure, tone: .error, bare: true).padding(.top, 12)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { contentHeight = $0 }
            .padding(.horizontal, 20)
            .frame(maxHeight: .infinity, alignment: .top)
            .safeAreaInset(edge: .bottom) {
                FlowButton(kind: danger ? .danger : .main, busy: busy) {
                    run()
                } label: {
                    Text(confirmLabel)
                }
                .disabled(!typedRight || busy)
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
            }
            .casySheetBar(CasyStrings.areYouSure, close: CasyStrings.cancel, disabled: busy) { dismiss() }
        }
        // As tall as it needs: the bar, the words, the button.
        .presentationDetents([.height(contentHeight + 150)])
        .interactiveDismissDisabled(busy)
    }

    private func run() {
        busy = true
        failure = nil
        Task {
            do {
                try await action()
                dismiss()
            } catch {
                busy = false
                failure = error.localizedDescription
            }
        }
    }
}

/// Children side by side, onto the next line when the row is full (the
/// web's `flex flex-wrap`), `spacing` apart both ways.
struct WrapLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, line: CGFloat = 0, widest: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > 0, x + size.width > width {
                y += line + spacing
                x = 0
                line = 0
            }
            x += size.width + spacing
            line = max(line, size.height)
            widest = max(widest, x - spacing)
        }
        return CGSize(width: proposal.width ?? widest, height: y + line)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, line: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > bounds.maxX {
                y += line + spacing
                x = bounds.minX
                line = 0
            }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            line = max(line, size.height)
        }
    }
}

/// A small round button with a border on the page's background: the web's
/// `h-8 w-8 rounded-full border bg-background` (28 on a user's row), its
/// 14 point icon muted, spinning while `spinning`.
struct RoundIconButton: View {
    let icon: String
    var size: CGFloat = 32
    var spinning = false
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            LucideIcon(icon, size: 14)
                .foregroundStyle(Theme.mutedForeground.color)
                .rotationEffect(.degrees(spinning ? 360 : 0))
                .animation(
                    spinning ? .linear(duration: 1).repeatForever(autoreverses: false) : .default,
                    value: spinning
                )
                .frame(width: size, height: size)
                .background(Theme.background.color, in: Circle())
                .overlay(Circle().strokeBorder(Theme.border.color, lineWidth: 1))
                .contentShape(Circle().inset(by: -6))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

/// A capsule button with a border on the page's background: Opdater and the
/// push test (14 semibold, `px-3.5 py-1.5`), or a review's Klaret and Slet
/// (`small`: 12 medium, `px-2.5 py-1`), an optional icon before the words.
struct OutlineCapsule: View {
    let label: String
    var icon: String?
    var small = false
    var color: Color = Theme.foreground.color
    var spinning = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: small ? 4 : 8) {
                if let icon {
                    LucideIcon(icon, size: small ? 14 : 16)
                        .rotationEffect(.degrees(spinning ? 360 : 0))
                        .animation(
                            spinning ? .linear(duration: 1).repeatForever(autoreverses: false) : .default,
                            value: spinning
                        )
                }
                Text(label)
                    .font(.system(size: small ? 12 : 14, weight: small ? .medium : .semibold))
                    .cssLineHeight(small ? 16 : 20, size: small ? 12 : 14)
            }
            .foregroundStyle(color)
            .padding(.horizontal, small ? 10 : 14)
            .padding(.vertical, small ? 4 : 6)
            .background(Theme.background.color, in: Capsule())
            .overlay(Capsule().strokeBorder(Theme.border.color, lineWidth: 1))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

extension View {
    /// The web's admin and review cards: `rounded-2xl border bg-card shadow-sm`.
    func adminCard() -> some View {
        background(Theme.card.color, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(Theme.border.color, lineWidth: 1)
            }
            .shadow(color: .black.opacity(0.05), radius: 1, y: 1)
    }

    /// A 1 point line along the top: the web's `border-t` and `divide-y`.
    func hairlineAbove() -> some View {
        overlay(alignment: .top) { Rectangle().fill(Theme.border.color).frame(height: 1) }
    }
}

/// Children side by side across the whole width, each its own width plus an
/// equal share of what is left (the web's `flex-auto`), so a long label is
/// never cut while a shorter one is.
struct FlexAutoRow: Layout {
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
        let natural = sizes.reduce(0) { $0 + $1.width }
        return CGSize(width: proposal.width ?? natural, height: sizes.map(\.height).max() ?? 0)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
        let natural = sizes.reduce(0) { $0 + $1.width }
        let extra = subviews.isEmpty ? 0 : max(0, bounds.width - natural) / CGFloat(subviews.count)
        var x = bounds.minX
        for (view, size) in zip(subviews, sizes) {
            let width = size.width + extra
            view.place(
                at: CGPoint(x: x, y: bounds.minY), proposal: ProposedViewSize(width: width, height: bounds.height))
            x += width
        }
    }
}
