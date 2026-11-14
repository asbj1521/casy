// A sheet's top bar, the same on every sheet (CLAUDE.md, design rule 11): the
// title on the left and one text button on the right that closes the sheet
// (Annuller, Færdig or Luk). The main action is never up here: it is a
// FlowButton pinned along the bottom. A screen pushed inside a sheet keeps the
// same button on the right, with the system's back arrow on the left.
// Sheets place their buttons only through these, never with ToolbarItem.

import SwiftUI

#if os(iOS)
    extension View {
        /// The top bar of a sheet's first screen: `title` on the left, `close`
        /// on the right. `disabled` while something it would interrupt runs.
        public func casySheetBar(
            _ title: String, close: String, disabled: Bool = false,
            action: @escaping () -> Void
        ) -> some View {
            modifier(SheetBar(title: title, close: close, disabled: disabled, action: action))
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
                            SheetTitle(title)
                        }
                        .sharedBackgroundVisibility(.hidden)
                    } else {
                        ToolbarItem(placement: .topBarLeading) {
                            SheetTitle(title)
                        }
                    }
                    ToolbarItem(placement: .topBarTrailing) {
                        Button(close, action: action)
                            .disabled(disabled)
                    }
                }
        }
    }

    /// The title as words, not a button: no glass behind it on iOS 26.
    private struct SheetTitle: View {
        let title: String

        init(_ title: String) { self.title = title }

        var body: some View {
            Text(title)
                .font(.headline)
                .foregroundStyle(Theme.foreground.color)
                .lineLimit(1)
                .accessibilityAddTraits(.isHeader)
                .fixedSize()
        }
    }
#endif
