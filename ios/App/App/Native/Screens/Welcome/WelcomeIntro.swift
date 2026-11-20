import CasyCore
import CasyUI
import SwiftUI

/// Before the welcome's animation (#275, #282), the web's WelcomeIntro: the
/// joke shown rather than told, on orange over the whole screen. "Vi kender
/// det alle:" alone in the middle, then up to the top; a friend's grey
/// message, "Det lyder SÅ sjovt!", types itself, then "Vi finder lige en dag"
/// takes its place; it grows old (cracks, cobwebs, yellowing, its words
/// fading) while the months race past under it; the line goes back to the
/// middle as "Alle ved det ik bliver til noget...", then "Men nu gør det!";
/// "Introducerer:" and the app's icon pops up big in the middle. Its place is
/// handed on (`onDone`) for the animation's phone to grow out of.
struct WelcomeIntro: View {
    let onDone: (CGRect) -> Void

    @Environment(\.accessibilityReduceMotion) private var still
    @State private var now = 0
    @State private var typedFirst = 0
    @State private var typed = 0
    @State private var agingSince: Date?
    @State private var running = false

    private var lang: String { CasyStrings.language == "en" ? "en" : "da" }

    /// When each part starts, in ms from the intro's start (the web's AT).
    enum At {
        static let up = 1300
        static let bubble = 1800
        static let second = 3400
        static let aging = 5000
        static let fade = 7700
        static let verdict = 8100
        static let turn = 10500
        static let present = 12900
        static let zoom = 15000
    }

    /// How long the message takes to grow old, and the timeline to run, in s.
    static let ageFor = 2.7
    static let runFor = 3.2
    /// How fast a message types itself, per letter.
    static let typeEvery: Duration = .milliseconds(45)
    /// The web's move: 0.7 s on (0.32, 0.72, 0, 1).
    static let move = Animation.timingCurve(0.32, 0.72, 0, 1, duration: 0.7)
    static let orange = Color(hex: 0xFF4D00)

    private var words: (relate: String, verdict: String, turn: String, present: String, first: String, message: String) {
        lang == "en"
            ? ("We all know this one:", "Everyone knows it won't happen...", "But now it will!", "Introducing:",
               "That sounds SO fun!", "We'll find a day 😍")
            : ("Vi kender det alle:", "Alle ved det ik bliver til noget...", "Men nu gør det!", "Introducerer:",
               "Det lyder SÅ sjovt!", "Vi finder lige en dag 😍")
    }

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height + geo.safeAreaInsets.top + geo.safeAreaInsets.bottom
            let safeTop = geo.safeAreaInsets.top
            let up = now >= At.up
            let alone = !up || now >= At.verdict
            let presenting = now >= At.present
            let handed = now >= At.zoom
            let middle = h * 0.5 - 130
            let icon = min(w * 0.56, 230)
            let iconCenter = CGPoint(x: w / 2, y: h * 0.5 + 30)
            let headingTop = max(40, safeTop + 16)
            ZStack(alignment: .topLeading) {
                Self.orange
                // The line, each one fading in over the last, in the same box.
                heading
                    .frame(width: w, height: 144)
                    .scaleEffect(alone ? 1.12 : 1)
                    .offset(y: headingTop + (presenting ? middle - icon / 2 - 60 : alone ? middle : 0))
                    .opacity(now == 0 || handed ? 0 : 1)
                    .animation(Self.move, value: alone)
                    .animation(Self.move, value: presenting)
                    .animation(.easeOut(duration: 0.7), value: now == 0)
                    .animation(.linear(duration: 0.05), value: handed)
                // The friend's message, from the left, typing itself; then growing old.
                if now >= At.bubble {
                    bubbles(width: w - 40)
                        .padding(.horizontal, 20)
                        .offset(y: h * 0.34)
                        .opacity(now >= At.verdict ? 0 : 1)
                        .animation(Self.move, value: now >= At.verdict)
                        .transition(.offset(x: -w * 1.1).combined(with: .opacity).animation(Self.move))
                }
                // Time passing, under the message.
                if agingSince != nil && now < At.fade {
                    IntroTimeline(lang: lang, run: running)
                        .padding(.horizontal, 20)
                        .padding(.top, 32)
                        .offset(y: h * 0.34 + 136)
                        .transition(.opacity.animation(.easeInOut(duration: 0.6)))
                }
                if presenting {
                    IntroIcon(size: icon)
                        .position(iconCenter)
                        .opacity(handed ? 0 : 1)
                        .transition(.scale(scale: 0.3).combined(with: .opacity).animation(.interpolatingSpring(stiffness: 260, damping: 18)))
                }
            }
            .frame(width: w, height: h, alignment: .topLeading)
            .clipped()
            .foregroundStyle(.white)
            .ignoresSafeArea()
            .task { await play(iconRect: CGRect(x: iconCenter.x - icon / 2, y: iconCenter.y - icon / 2, width: icon, height: icon)) }
        }
        .ignoresSafeArea()
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("welcome.intro")
    }

    @ViewBuilder private var heading: some View {
        let text =
            now >= At.present
            ? words.present : now >= At.turn ? words.turn : now >= At.verdict ? words.verdict : words.relate
        ZStack {
            Text(text)
                .id(text)
                .font(.system(size: 38, weight: .bold))
                .lineSpacing(-4)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
                .transition(.opacity.animation(.easeInOut(duration: 0.22)))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder private func bubbles(width: CGFloat) -> some View {
        TimelineView(.animation(paused: agingSince == nil)) { context in
            let age = agingSince.map { min(1, context.date.timeIntervalSince($0) / (still ? Self.ageFor / 2 : Self.ageFor)) } ?? 0
            ZStack(alignment: .topLeading) {
                if now >= At.second {
                    AgingBubble(text: words.message, typed: typed, age: age, maxWidth: width * 0.82)
                        .transition(.asymmetric(
                            insertion: .offset(y: 16).combined(with: .opacity).animation(.timingCurve(0.32, 0.72, 0, 1, duration: 0.3).delay(0.25)),
                            removal: .opacity))
                } else {
                    AgingBubble(text: words.first, typed: typedFirst, age: 0, maxWidth: width * 0.82)
                        .transition(.asymmetric(insertion: .identity, removal: .offset(y: -16).combined(with: .opacity).animation(.easeInOut(duration: 0.25))))
                }
            }
            .frame(width: width, alignment: .leading)
        }
    }

    /// The script: each moment as the web's timers reach it, the messages typed
    /// letter by letter, and the handover at the end.
    private func play(iconRect: CGRect) async {
        let k = still ? 0.5 : 1
        let start = Date()
        func until(_ ms: Int) async {
            let left = Double(ms) * k / 1000 - Date().timeIntervalSince(start)
            if left > 0 { try? await Task.sleep(for: .milliseconds(Int(left * 1000))) }
        }
        try? await Task.sleep(for: .milliseconds(30))
        withAnimation { now = 1 }
        for moment in [At.up, At.bubble] {
            await until(moment)
            withAnimation { now = moment }
        }
        for i in 1...words.first.count {
            if Task.isCancelled { return }
            typedFirst = i
            try? await Task.sleep(for: still ? .zero : Self.typeEvery)
        }
        await until(At.second)
        withAnimation { now = At.second }
        try? await Task.sleep(for: .milliseconds(250))
        for i in 1...words.message.count {
            if Task.isCancelled { return }
            typed = i
            try? await Task.sleep(for: still ? .zero : Self.typeEvery)
        }
        await until(At.aging)
        withAnimation {
            now = At.aging
            agingSince = Date()
        }
        running = true
        for moment in [At.fade, At.verdict, At.turn, At.present, At.zoom] {
            await until(moment)
            if Task.isCancelled { return }
            withAnimation { now = moment }
        }
        onDone(iconRect)
    }
}

/// The app's icon, introduced: orange, a white rim, the logo in white.
struct IntroIcon: View {
    let size: CGFloat

    var body: some View {
        RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
            .fill(WelcomeIntro.orange)
            .overlay {
                RoundedRectangle(cornerRadius: size * 0.22, style: .continuous).strokeBorder(.white, lineWidth: 3)
            }
            .overlay { WelcomeLogo().frame(height: size * 0.68) }
            .frame(width: size, height: size)
            .shadow(color: .black.opacity(0.25), radius: 25, y: 20)
            .accessibilityHidden(true)
    }
}

/// The logo (LogoMark): the icon's own letters as shapes in Danish, the
/// English name in tall condensed capitals.
struct WelcomeLogo: View {
    var body: some View {
        if CasyStrings.language == "en" {
            VStack(spacing: 0) {
                Text(verbatim: "WE\u{2019}LL").font(.system(size: 200, weight: .black)).fontWidth(.compressed)
                Text(verbatim: "FIND A DAY").font(.system(size: 200, weight: .black)).fontWidth(.compressed)
            }
            .minimumScaleFactor(0.05)
            .lineLimit(1)
        } else {
            LogoLetters()
        }
    }
}

/// The friend's message (AgingBubble): typed, then old, cracked, mossy,
/// spun over and unreadable as `age` goes from 0 to 1.
private struct AgingBubble: View {
    let text: String
    let typed: Int
    let age: Double
    let maxWidth: CGFloat

    private static let cracks: [(String, Double)] = [
        ("M8 0 L12 9 L9 16 L15 26 L13 34", 0.18),
        ("M62 50 L58 40 L63 31 L57 22", 0.32),
        ("M12 9 L22 11 L28 7", 0.42),
        ("M58 40 L70 42 L76 37 L84 41", 0.5),
        ("M92 0 L88 8 L91 14", 0.6),
        ("M9 16 L4 20", 0.68),
        ("M63 31 L72 27", 0.74),
    ]

    private func mix(_ a: Double, _ b: Double, _ t: Double) -> Double { a + (b - a) * t }

    var body: some View {
        let t = min(max(age, 0), 1)
        let background = Color(
            red: mix(0xEF, 0xD6, t) / 255, green: mix(0xEF, 0xCD, t) / 255, blue: mix(0xF1, 0xB6, t) / 255)
        let words = 1 - 0.55 * min(max((t - 0.15) / 0.75, 0), 1)
        let shape = UnevenRoundedRectangle(
            topLeadingRadius: 22, bottomLeadingRadius: 6, bottomTrailingRadius: 22, topTrailingRadius: 22,
            style: .continuous)
        ZStack(alignment: .topLeading) {
            // The whole text holds the bubble's size; what is typed shows over it.
            Text(text).hidden()
            HStack(spacing: 1) {
                Text(String(text.prefix(typed)))
                if typed < text.count { Cursor() }
            }
            .opacity(words)
        }
        .font(.system(size: 19))
        .foregroundStyle(Color(hex: 0x1C1C1E))
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(background, in: shape)
        .overlay {
            ZStack {
                ForEach(Array(Self.cracks.enumerated()), id: \.offset) { _, crack in
                    Grown(path: crack.0, box: CGSize(width: 100, height: 50), progress: (t - crack.1) / 0.22)
                        .stroke(Color(red: 60 / 255, green: 50 / 255, blue: 35 / 255, opacity: 0.7), lineWidth: 1.4)
                }
            }
            .clipShape(shape)
        }
        .overlay(alignment: .topLeading) { Cobweb(age: t, start: 0.05).frame(width: 64, height: 64).offset(x: -12, y: -16) }
        .overlay(alignment: .bottomTrailing) {
            Cobweb(age: t, start: 0.4).frame(width: 56, height: 56).rotationEffect(.degrees(180)).offset(x: 12, y: 16)
        }
        .rotationEffect(.degrees(-3.5 * t))
        .offset(y: 10 * t)
        .frame(maxWidth: maxWidth, alignment: .leading)
        .fixedSize(horizontal: false, vertical: true)
    }
}

/// The typing cursor, blinking.
private struct Cursor: View {
    @State private var on = true

    var body: some View {
        Rectangle()
            .frame(width: 2, height: 21)
            .opacity(on ? 1 : 0)
            .onAppear { withAnimation(.easeInOut(duration: 0.4).repeatForever()) { on = false } }
    }
}

/// A cobweb in a corner, spun thread by thread as the message ages.
private struct Cobweb: View {
    let age: Double
    let start: Double

    private static let threads: [String] = {
        let angles = [0.0, 22, 45, 68, 90].map { $0 * .pi / 180 }
        let f = { (v: Double) in String(format: "%.1f", v) }
        let spokes = angles.map { "M0 0 L\(f(cos($0) * 60)) \(f(sin($0) * 60))" }
        let rings = [16.0, 28, 40, 52].map { d -> String in
            let pt = { (r: Double, k: Double) in "\(f(cos(r) * d * k)) \(f(sin(r) * d * k))" }
            var path = "M\(pt(angles[0], 1))"
            for i in 1..<angles.count {
                path += " Q\(pt((angles[i - 1] + angles[i]) / 2, 0.86)) \(pt(angles[i], 1))"
            }
            return path
        }
        return spokes + rings
    }()

    var body: some View {
        let span = (1 - start) / Double(Self.threads.count)
        ZStack {
            ForEach(Array(Self.threads.enumerated()), id: \.offset) { i, d in
                let from = start + Double(i) * span * 0.8
                let to = start + Double(i + 1) * span * 0.8 + 0.08
                Grown(path: d, box: CGSize(width: 60, height: 60), progress: (age - from) / (to - from))
                    .stroke(.white.opacity(0.9), style: StrokeStyle(lineWidth: 1, lineCap: .round))
            }
        }
        .accessibilityHidden(true)
    }
}

/// An SVG path in a `box` of its own units, stretched over the view, drawn
/// as far as `progress` (0 to 1), nothing at all before it starts.
private struct Grown: Shape {
    let path: String
    let box: CGSize
    let progress: Double

    func path(in rect: CGRect) -> Path {
        guard progress > 0 else { return Path() }
        let scaled = Path(SVGPath.parse(path)).applying(
            CGAffineTransform(scaleX: rect.width / box.width, y: rect.height / box.height))
        return scaled.trimmedPath(from: 0, to: min(progress, 1))
    }
}

/// Time going by, under the message: the day it was sent, then the months
/// running past towards now, faster and faster.
private struct IntroTimeline: View {
    let lang: String
    let run: Bool

    private static let monthWidth: CGFloat = 64
    private var months: [String] {
        let one =
            lang == "en"
            ? ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"]
            : ["apr.", "maj", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.", "dec.", "jan.", "feb.", "mar."]
        return Array(repeating: one, count: 4).flatMap { $0 }
    }

    @State private var moved = false

    private var strip: some View {
        HStack(alignment: .top, spacing: 0) {
            VStack(alignment: .leading, spacing: 8) {
                Circle().fill(.white).frame(width: 12, height: 12)
                Text(lang == "en" ? "Sent 12 Mar" : "Sendt 12. mar.")
                    .font(.system(size: 13, weight: .semibold)).fixedSize()
            }
            .frame(width: Self.monthWidth * 1.6, alignment: .leading)
            ForEach(Array(months.enumerated()), id: \.offset) { _, m in
                VStack(alignment: .leading, spacing: 10) {
                    Circle().fill(.white.opacity(0.8)).frame(width: 6, height: 6).padding(.top, 3)
                    Text(m).font(.system(size: 12)).foregroundStyle(.white.opacity(0.85)).fixedSize()
                }
                .frame(width: Self.monthWidth, alignment: .leading)
            }
        }
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            Rectangle().fill(.white.opacity(0.5)).frame(height: 2).offset(y: 5)
            // The months run out of sight before "now"; laid over the line so
            // their length never widens anything.
            Color.clear
                .frame(height: 56)
                .overlay(alignment: .topLeading) {
                    strip
                        .fixedSize()
                        .offset(x: moved ? 24 - CGFloat(months.count) * Self.monthWidth + 220 : 24)
                }
                .clipped()
                .mask(
                    LinearGradient(
                        stops: [.init(color: .black, location: 0.85), .init(color: .clear, location: 1)],
                        startPoint: .leading, endPoint: .trailing)
                )
                .padding(.trailing, 56)
            // "now" at the line's end, never reached.
            HStack {
                Spacer()
                VStack(spacing: 8) {
                    Pulse()
                    Text(lang == "en" ? "now" : "nu").font(.system(size: 13, weight: .semibold))
                }
                .padding(.trailing, 20)
            }
        }
        .frame(height: 56, alignment: .top)
        .accessibilityHidden(true)
        .onChange(of: run, initial: true) { _, go in
            guard go else { return }
            withAnimation(.timingCurve(0.55, 0, 1, 1, duration: WelcomeIntro.runFor)) { moved = true }
        }
    }
}

/// The "now" dot, beating.
private struct Pulse: View {
    @State private var big = false

    var body: some View {
        Circle()
            .fill(WelcomeIntro.orange)
            .overlay { Circle().strokeBorder(.white, lineWidth: 2) }
            .frame(width: 12, height: 12)
            .scaleEffect(big ? 1.3 : 1)
            .onAppear { withAnimation(.easeInOut(duration: 0.6).repeatForever()) { big = true } }
    }
}

/// The SVG path commands the welcome's drawings use (M L H V Q C S Z, and
/// their relative forms), as a CGPath.
enum SVGPath {
    static func parse(_ d: String) -> CGPath {
        let path = CGMutablePath()
        var current = CGPoint.zero
        var start = CGPoint.zero
        var lastControl: CGPoint?
        // Tokens: commands and numbers.
        var tokens: [String] = []
        var token = ""
        for ch in d {
            if ch.isLetter && ch != "e" {
                if !token.isEmpty { tokens.append(token); token = "" }
                tokens.append(String(ch))
            } else if ch == " " || ch == "," || ch == "\n" {
                if !token.isEmpty { tokens.append(token); token = "" }
            } else if ch == "-" && !token.isEmpty && token.last != "e" {
                tokens.append(token)
                token = "-"
            } else if ch == "." && token.contains(".") {
                tokens.append(token)
                token = "."
            } else {
                token.append(ch)
            }
        }
        if !token.isEmpty { tokens.append(token) }

        var i = 0
        var command: Character = "M"
        func number() -> CGFloat {
            defer { i += 1 }
            return CGFloat(Double(tokens[i]) ?? 0)
        }
        func hasNumber() -> Bool { i < tokens.count && Double(tokens[i]) != nil }
        while i < tokens.count {
            if let c = tokens[i].first, tokens[i].count == 1, c.isLetter {
                command = c
                i += 1
                if c == "Z" || c == "z" {
                    path.closeSubpath()
                    current = start
                    lastControl = nil
                    continue
                }
            }
            let relative = command.isLowercase
            let base = relative ? current : .zero
            switch command.uppercased().first! {
            case "M":
                let p = CGPoint(x: base.x + number(), y: base.y + number())
                path.move(to: p)
                current = p
                start = p
                lastControl = nil
                command = relative ? "l" : "L"
            case "L":
                let p = CGPoint(x: base.x + number(), y: base.y + number())
                path.addLine(to: p)
                current = p
                lastControl = nil
            case "H":
                current.x = (relative ? current.x : 0) + number()
                path.addLine(to: current)
                lastControl = nil
            case "V":
                current.y = (relative ? current.y : 0) + number()
                path.addLine(to: current)
                lastControl = nil
            case "Q":
                let c = CGPoint(x: base.x + number(), y: base.y + number())
                let p = CGPoint(x: base.x + number(), y: base.y + number())
                path.addQuadCurve(to: p, control: c)
                current = p
                lastControl = nil
            case "C":
                let c1 = CGPoint(x: base.x + number(), y: base.y + number())
                let c2 = CGPoint(x: base.x + number(), y: base.y + number())
                let p = CGPoint(x: base.x + number(), y: base.y + number())
                path.addCurve(to: p, control1: c1, control2: c2)
                current = p
                lastControl = c2
            case "S":
                let c1 = lastControl.map { CGPoint(x: 2 * current.x - $0.x, y: 2 * current.y - $0.y) } ?? current
                let c2 = CGPoint(x: base.x + number(), y: base.y + number())
                let p = CGPoint(x: base.x + number(), y: base.y + number())
                path.addCurve(to: p, control1: c1, control2: c2)
                current = p
                lastControl = c2
            default:
                i += 1
            }
            // Numbers left over repeat the command.
            if !hasNumber() && i < tokens.count && !(tokens[i].first?.isLetter ?? false) { i += 1 }
        }
        return path
    }
}
