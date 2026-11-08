// Casy's colours, light and dark: the web's phone values (src/index.css and
// src/theme.css), kept equal by Tests/CasyUITests/Fixtures/colors.json.

import SwiftUI

#if canImport(UIKit)
    import UIKit
#else
    import AppKit
#endif

/// A colour as the stylesheets give it, 0...255 per channel.
public struct CasyColor: Sendable, Equatable {
    public let light: [Int]
    public let dark: [Int]

    init(_ light: [Int], _ dark: [Int]) {
        self.light = light
        self.dark = dark
    }

    /// The colour for the current appearance.
    public var color: Color {
        #if canImport(UIKit)
            Color(
                uiColor: UIColor { traits in
                    Self.platform(traits.userInterfaceStyle == .dark ? dark : light)
                })
        #else
            Color(
                nsColor: NSColor(name: nil) { appearance in
                    let isDark = appearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua
                    return Self.platform(isDark ? dark : light)
                })
        #endif
    }

    #if canImport(UIKit)
        private static func platform(_ rgb: [Int]) -> UIColor {
            UIColor(
                red: CGFloat(rgb[0]) / 255, green: CGFloat(rgb[1]) / 255,
                blue: CGFloat(rgb[2]) / 255, alpha: 1)
        }
    #else
        private static func platform(_ rgb: [Int]) -> NSColor {
            NSColor(
                srgbRed: CGFloat(rgb[0]) / 255, green: CGFloat(rgb[1]) / 255,
                blue: CGFloat(rgb[2]) / 255, alpha: 1)
        }
    #endif
}

/// Every colour the native screens use. Write orange text in `primary`; a solid
/// orange fill is `cta`, whose contrast with white is the checked one.
public enum Theme {
    public static let primary = CasyColor([184, 68, 10], [244, 106, 37])
    public static let primaryForeground = CasyColor([255, 255, 255], [255, 255, 255])
    public static let cta = CasyColor([194, 65, 12], [234, 88, 12])
    public static let background = CasyColor([250, 248, 245], [12, 12, 14])
    public static let foreground = CasyColor([31, 37, 51], [240, 238, 234])
    public static let card = CasyColor([255, 255, 255], [27, 27, 29])
    public static let cardForeground = CasyColor([31, 37, 51], [240, 238, 234])
    public static let secondary = CasyColor([241, 238, 234], [42, 42, 45])
    public static let secondaryForeground = CasyColor([31, 37, 51], [240, 238, 234])
    public static let muted = CasyColor([243, 241, 237], [37, 37, 40])
    public static let mutedForeground = CasyColor([103, 113, 131], [161, 161, 170])
    public static let border = CasyColor([226, 228, 233], [54, 54, 58])
    public static let everyone = CasyColor([53, 151, 102], [67, 177, 122])
    public static let emerald50 = CasyColor([236, 253, 245], [2, 44, 34])
    public static let emerald100 = CasyColor([209, 250, 229], [6, 78, 59])
    public static let emerald200 = CasyColor([167, 243, 208], [6, 95, 70])
    public static let emerald700 = CasyColor([4, 120, 87], [110, 231, 183])
    public static let emerald800 = CasyColor([6, 95, 70], [167, 243, 208])
    public static let emerald900 = CasyColor([6, 78, 59], [209, 250, 229])
    public static let sky100 = CasyColor([224, 242, 254], [12, 74, 110])
    public static let sky700 = CasyColor([3, 105, 161], [125, 211, 252])
    public static let amber50 = CasyColor([255, 251, 235], [69, 26, 3])
    public static let amber100 = CasyColor([254, 243, 199], [120, 53, 15])
    public static let amber200 = CasyColor([253, 230, 138], [146, 64, 14])
    public static let amber700 = CasyColor([180, 83, 9], [252, 211, 77])
    public static let amber800 = CasyColor([146, 64, 14], [253, 230, 138])
    public static let amber900 = CasyColor([120, 53, 15], [254, 243, 199])
    public static let violet100 = CasyColor([237, 233, 254], [76, 29, 149])
    public static let violet700 = CasyColor([109, 40, 217], [196, 181, 253])
    public static let rose100 = CasyColor([255, 228, 230], [136, 19, 55])
    public static let rose700 = CasyColor([190, 18, 60], [253, 164, 175])
    public static let red50 = CasyColor([254, 242, 242], [69, 10, 10])
    public static let red200 = CasyColor([254, 202, 202], [153, 27, 27])
    public static let red600 = CasyColor([220, 38, 38], [248, 113, 113])
    public static let red700 = CasyColor([185, 28, 28], [252, 165, 165])
    public static let red900 = CasyColor([127, 29, 29], [254, 226, 226])

    /// By name, as the colour fixture has them.
    static let all: [String: CasyColor] = [
        "primary": primary,
        "primaryForeground": primaryForeground,
        "cta": cta,
        "background": background,
        "foreground": foreground,
        "card": card,
        "cardForeground": cardForeground,
        "secondary": secondary,
        "secondaryForeground": secondaryForeground,
        "muted": muted,
        "mutedForeground": mutedForeground,
        "border": border,
        "everyone": everyone,
        "emerald50": emerald50,
        "emerald100": emerald100,
        "emerald200": emerald200,
        "emerald700": emerald700,
        "emerald800": emerald800,
        "emerald900": emerald900,
        "sky100": sky100,
        "sky700": sky700,
        "amber50": amber50,
        "amber100": amber100,
        "amber200": amber200,
        "amber700": amber700,
        "amber800": amber800,
        "amber900": amber900,
        "violet100": violet100,
        "violet700": violet700,
        "rose100": rose100,
        "rose700": rose700,
        "red50": red50,
        "red200": red200,
        "red600": red600,
        "red700": red700,
        "red900": red900,
    ]
}
