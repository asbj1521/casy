import SwiftUI

/// One of the web's lucide icons (#281), the very drawing the web shows: the
/// assets are written from lucide-react by `scripts/native/lucide-icons.mjs`
/// (a new icon is added there first). `size` is the web's `h-* w-*` in points;
/// the stroke scales with it, as lucide-react's does. Tinted by the foreground
/// style, as the web's `currentColor`.
public struct LucideIcon: View {
    private let asset: String
    private let size: CGFloat

    /// `stroke` other than 2 picks the asset drawn at that width (`strokeWidth={2.25}`).
    public init(_ name: String, size: CGFloat, stroke: Double = 2) {
        // "\(2.25)", never the phone's own number format ("2,25" in Danish).
        // A whole width without its ".0" (3, not 3.0), as the script names the asset.
        let width = stroke == stroke.rounded() ? "\(Int(stroke))" : "\(stroke)"
        asset = stroke == 2 ? "lucide.\(name)" : "lucide.\(name).\(width)"
        self.size = size
    }

    public var body: some View {
        Image(asset, bundle: .module)
            .renderingMode(.template)
            .resizable()
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

/// The web's count on a button (HomeBar's and HomeToolbar's badges): a 20 point
/// orange capsule, at least round, 4 points of padding, 11 point semibold white,
/// set 4 points outside the button's top right corner by its caller
/// (`.overlay(alignment: .topTrailing) { CountBadge(n).offset(x: 4, y: -4) }`).
public struct CountBadge: View {
    private let count: Int

    public init(_ count: Int) { self.count = count }

    public var body: some View {
        Text(verbatim: "\(count)")
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 4)
            .frame(minWidth: 20, minHeight: 20)
            .background(Theme.cta.color, in: Capsule())
            .accessibilityHidden(true)
    }
}
