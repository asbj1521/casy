// The web's SwipeReveal (src/components/ui/SwipeReveal.tsx, #223), for a
// CardList row (#281): the row slides left to show one red button, as iOS
// Mail's rows do. The button only shows; a press does it, so a stray swipe
// costs nothing. While it is open, a tap on the row closes it instead of
// opening what the row leads to. A swipe can't be done with VoiceOver, so the
// row also offers the button as an action, and whatever it does must be
// reachable another way too (the group's own screen).
//
// The web's values: the button 88 wide (5.5rem), 15 semibold white on
// rgb(220, 38, 38) whatever the theme; the row on bg-card above it; open past
// half the button's width or with a flick faster than 400 points a second;
// the spring stiffness 500, damping 40; 10 % give past either end.

#if os(iOS)
    import SwiftUI
    import UIKit

    public struct SwipeReveal<Row: View>: View {
        private let label: String
        @Binding private var isOpen: Bool
        private let onPress: () -> Void
        private let row: Row

        @State private var offset: CGFloat = 0
        @State private var dragging = false
        @Environment(\.accessibilityReduceMotion) private var reduceMotion

        private static var width: CGFloat { 88 }
        private static var flick: CGFloat { 400 }
        private static var red: Color { Color(red: 220 / 255, green: 38 / 255, blue: 38 / 255) }

        public init(
            _ label: String, isOpen: Binding<Bool>, onPress: @escaping () -> Void,
            @ViewBuilder row: () -> Row
        ) {
            self.label = label
            self._isOpen = isOpen
            self.onPress = onPress
            self.row = row()
        }

        public var body: some View {
            ZStack(alignment: .trailing) {
                Button(action: onPress) {
                    Text(label)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: Self.width)
                        .frame(maxHeight: .infinity)
                        .background(Self.red)
                }
                .buttonStyle(.plain)
                // Reachable once open (VoiceOver has the row's action too).
                .accessibilityHidden(!isOpen)
                // Not there at rest: its red bled through the row's soft edges.
                .opacity(offset < 0 ? 1 : 0)
                row
                    // Solid, so the red never shows through the row.
                    .background(Theme.card.color)
                    .overlay {
                        // Open: a tap anywhere on the row closes it.
                        if isOpen || dragging {
                            Color.clear
                                .contentShape(Rectangle())
                                .onTapGesture { settle(open: false) }
                        }
                    }
                    .offset(x: offset)
                    .gesture(
                        SidewaysPan(
                            changed: { dx in
                                dragging = true
                                let start = isOpen ? -Self.width : 0
                                offset = give(start + dx)
                            },
                            ended: { velocity in
                                let open =
                                    velocity < -Self.flick
                                    || (velocity < Self.flick && offset < -Self.width / 2)
                                if open && !isOpen {
                                    UISelectionFeedbackGenerator().selectionChanged()
                                }
                                settle(open: open)
                                // The lifted finger's tap closes, never opens the row.
                                Task { @MainActor in
                                    try? await Task.sleep(for: .milliseconds(300))
                                    dragging = false
                                }
                            })
                    )
            }
            .clipped()
            .accessibilityAction(named: label, onPress)
            .onChange(of: isOpen) { _, open in
                // Closed from outside (another row opened): back it goes.
                if !dragging { move(to: open ? -Self.width : 0) }
            }
        }

        /// The web's dragElastic 0.1: a tenth of the way past either end.
        private func give(_ x: CGFloat) -> CGFloat {
            if x > 0 { return x * 0.1 }
            if x < -Self.width { return -Self.width + (x + Self.width) * 0.1 }
            return x
        }

        private func settle(open: Bool) {
            isOpen = open
            move(to: open ? -Self.width : 0)
        }

        private func move(to x: CGFloat) {
            if reduceMotion {
                offset = x
            } else {
                withAnimation(.interpolatingSpring(stiffness: 500, damping: 40)) { offset = x }
            }
        }
    }

    /// A pan that begins only when the finger moves more sideways than up or
    /// down, so the list around the row keeps scrolling as iOS scrolls it.
    private struct SidewaysPan: UIGestureRecognizerRepresentable {
        let changed: (CGFloat) -> Void
        let ended: (CGFloat) -> Void

        func makeCoordinator(converter: CoordinateSpaceConverter) -> Coordinator { Coordinator() }

        func makeUIGestureRecognizer(context: Context) -> UIPanGestureRecognizer {
            let pan = UIPanGestureRecognizer()
            pan.delegate = context.coordinator
            return pan
        }

        func handleUIGestureRecognizerAction(_ pan: UIPanGestureRecognizer, context: Context) {
            switch pan.state {
            case .changed: changed(pan.translation(in: pan.view).x)
            case .ended, .cancelled, .failed: ended(pan.velocity(in: pan.view).x)
            default: break
            }
        }

        final class Coordinator: NSObject, UIGestureRecognizerDelegate {
            func gestureRecognizerShouldBegin(_ recognizer: UIGestureRecognizer) -> Bool {
                guard let pan = recognizer as? UIPanGestureRecognizer else { return false }
                let v = pan.velocity(in: pan.view)
                return abs(v.x) > abs(v.y)
            }
        }
    }
#endif
