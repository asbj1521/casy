// A sheet's top bar, the same on every sheet (CLAUDE.md, design rule 11): the
// title on the left and one text button on the right that closes the sheet
// (Annuller, Færdig or Luk). The main action is never up here: it is a
// FlowButton pinned along the bottom. A screen pushed inside a sheet keeps the
// same button on the right, with the system's back arrow on the left.
// Sheets place their buttons only through these, never with ToolbarItem.

import SwiftUI

#if os(iOS)
    /// A small icon button left of the sheet's text button (the web's BottomSheet
    /// `action`, Planlæg's reset, #189): a lucide icon, named for VoiceOver.
    public struct SheetIconAction {
        let icon: String
        let label: String
        let run: () -> Void

        public init(icon: String, label: String, run: @escaping () -> Void) {
            self.icon = icon
            self.label = label
            self.run = run
        }
    }

    extension View {
        /// The top bar of a sheet's first screen: `title` on the left, `close`
        /// on the right. `disabled` while something it would interrupt runs.
        public func casySheetBar(
            _ title: String, close: String, disabled: Bool = false, icon: SheetIconAction? = nil,
            action: @escaping () -> Void
        ) -> some View {
            modifier(SheetBar(title: title, close: close, disabled: disabled, icon: icon, action: action))
        }

        /// The top bar of a screen pushed inside a sheet: the back arrow on the
        /// left, `title` in the middle, and the sheet's own button on the right.
        public func casyPushedBar(
            _ title: String, close: String, action: @escaping () -> Void
        ) -> some View {
            navigationTitle(title)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button(close, action: action)
                    }
                }
        }
    }

    private struct SheetBar: ViewModifier {
        let title: String
        let close: String
        let disabled: Bool
        let icon: SheetIconAction?
        let action: () -> Void

        func body(content: Content) -> some View {
            content
                // Kept for VoiceOver and the back button of a screen pushed on it.
                .navigationTitle(title)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar(removing: .title)
                .toolbar {
                    if #available(iOS 26, *) {
                        ToolbarItem(placement: .topBarLeading) {
                            SheetTitle(title, alone: close.isEmpty)
                        }
                        .sharedBackgroundVisibility(.hidden)
                    } else {
                        ToolbarItem(placement: .topBarLeading) {
                            SheetTitle(title, alone: close.isEmpty)
                        }
                    }
                    if let icon {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button(action: icon.run) { LucideIcon(icon.icon, size: 18) }
                                .accessibilityLabel(icon.label)
                        }
                    }
                    // Empty: nothing to close yet (the push ask until iOS's question failed).
                    if !close.isEmpty {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button(close, action: action)
                                .disabled(disabled)
                        }
                    }
                }
        }
    }

    /// The title as words, not a button: no glass behind it on iOS 26.
    private struct SheetTitle: View {
        let title: String
        /// No button beside it: the bar's whole width.
        let alone: Bool

        init(_ title: String, alone: Bool) {
            self.title = title
            self.alone = alone
        }

        var body: some View {
            Text(title)
                // BottomSheet's title: 17 bold.
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(Theme.foreground.color)
                // A long one (a trip's question) gets two lines and shrinks a
                // little, rather than pushing the sheet's button off the bar.
                .lineLimit(2)
                .minimumScaleFactor(0.8)
                .multilineTextAlignment(.leading)
                .accessibilityAddTraits(.isHeader)
                // The bar sizes an item by its own width: the words' own, at
                // most what leaves the close button's room on the smallest
                // iPhone (the whole of its bar without one), so a short title
                // leaves room for a longer button (Behold den) on a floating
                // sheet.
                .frame(maxWidth: alone ? 320 : 230, alignment: .leading)
                .fixedSize()
        }
    }
#endif
