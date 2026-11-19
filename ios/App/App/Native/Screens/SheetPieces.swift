import CasyUI
import SwiftUI

/// The web's `ListPickRow` in a `CardList`: a row that is picked by a tap,
/// its 20 point orange tick at the end while picked (room kept for it while
/// not). `value` instead of the tick for a row that can't be picked (someone
/// already invited).
struct PickRow<Leading: View>: View {
    let label: String
    var detail: String?
    let picked: Bool
    var value: String?
    let action: () -> Void
    @ViewBuilder let leading: () -> Leading

    var body: some View {
        Button(action: action) {
            CardRow(label, detail: detail, value: value, leading: leading) {
                if value == nil {
                    LucideIcon("check", size: 20)
                        .foregroundStyle(Theme.primary.color)
                        .opacity(picked ? 1 : 0)
                        .accessibilityHidden(true)
                }
            }
        }
        .buttonStyle(.cardRow)
        .disabled(value != nil)
        .accessibilityAddTraits(picked ? .isSelected : [])
    }
}

extension PickRow where Leading == EmptyView {
    init(_ label: String, picked: Bool, action: @escaping () -> Void) {
        self.init(label: label, picked: picked, action: action, leading: { EmptyView() })
    }
}

extension View {
    /// The web's BottomSheet on a phone: as tall as what is in it (`content`,
    /// measured, plus the bar and the main button), never past 85 % of the
    /// screen, where it scrolls. Below full height iOS draws it in its glass.
    func sheetFits(_ content: CGFloat, chrome: CGFloat = 150) -> some View {
        let screen =
            UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.screen.bounds.height }
            .first ?? 844
        return presentationDetents([.height(min(content + chrome, screen * 0.85))])
    }

    /// PictureButton's badge: 24, -bottom-0.5 -right-0.5, a 2 point ring in
    /// the card's colour, bg-secondary, a 14 point camera (a spinner while busy).
    func cameraBadge(busy: Bool = false) -> some View {
        overlay(alignment: .bottomTrailing) {
            ZStack {
                Circle().fill(Theme.secondary.color)
                Circle().strokeBorder(Theme.card.color, lineWidth: 2)
                Group {
                    if busy {
                        ProgressView().controlSize(.mini)
                    } else {
                        LucideIcon("camera", size: 14)
                    }
                }
                .foregroundStyle(Theme.foreground.color)
            }
            .frame(width: 24, height: 24)
            .offset(x: 2, y: 2)
        }
    }
}
