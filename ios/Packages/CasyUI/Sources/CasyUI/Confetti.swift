// A burst of confetti for a moment that is done (the web's swipe/Celebration):
// up and out from a third of the way down, falling a little as paper does.
// Nothing at all with reduced motion: the words say it.

import SwiftUI

public struct Confetti: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var flown = false
    @State private var pieces: [Piece] = Self.make()

    /// Casy's own colours: the coral accent, the "everyone" green, amber and a sky blue.
    private static let colors: [Color] = [
        Color(red: 233 / 255, green: 86 / 255, blue: 12 / 255),
        Color(red: 53 / 255, green: 151 / 255, blue: 102 / 255),
        Color(red: 245 / 255, green: 159 / 255, blue: 10 / 255),
        Color(red: 14 / 255, green: 162 / 255, blue: 231 / 255),
    ]

    private struct Piece {
        let x: CGFloat
        let y: CGFloat
        let rotation: Double
        let delay: Double
        let color: Color
        let round: Bool
    }

    private static func make() -> [Piece] {
        (0..<36).map { i in
            let angle = Double(i) / 36 * .pi * 2 + .random(in: 0..<0.4)
            let distance = 120 + Double.random(in: 0..<160)
            return Piece(
                x: cos(angle) * distance, y: sin(angle) * distance * 0.7 + 140,
                rotation: .random(in: -360...360), delay: .random(in: 0..<0.12),
                color: colors[i % colors.count], round: i % 3 == 0)
        }
    }

    public init() {}

    public var body: some View {
        GeometryReader { box in
            if !reduceMotion {
                ZStack {
                    ForEach(pieces.indices, id: \.self) { i in
                        let p = pieces[i]
                        RoundedRectangle(cornerRadius: p.round ? 4 : 2)
                            .fill(p.color)
                            .frame(width: p.round ? 8 : 6, height: p.round ? 8 : 12)
                            .scaleEffect(flown ? 1 : 0.6)
                            .rotationEffect(.degrees(flown ? p.rotation : 0))
                            .offset(x: flown ? p.x : 0, y: flown ? p.y : 0)
                            .opacity(flown ? 0 : 1)
                            .animation(.timingCurve(0.15, 0.7, 0.4, 1, duration: 1.6).delay(p.delay), value: flown)
                    }
                }
                .position(x: box.size.width / 2, y: box.size.height / 3)
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .onAppear { flown = true }
    }
}
