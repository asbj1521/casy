import CasyCore
import CasyUI
import SwiftUI
import UIKit

// The welcome animation (#228, #282), the web's WelcomeStage and the phone's
// screens on it (PhoneHome, PhoneDates, PhoneVote, TravelBox, Friends): your
// friends join a group; their paper calendars are thrown on, become one sheet
// and dissolve into the real month; the days free for everyone light up and
// are lifted into a list; those are sent off for a vote; you answer it; the
// agreed date lands in its day and goes out to everyone. Then it runs on
// from the top.

private typealias D = WelcomeDemo

/// How the phone stands, and where the colour shape lies behind it.
private struct ShapePose: Equatable {
    var x: CGFloat
    var y: CGFloat
    var rotate: Double
    var scale: CGFloat

    static let flat = ShapePose(x: -0.08, y: 0.34, rotate: -14, scale: 1.05)
    static let list = ShapePose(x: -0.16, y: 0.38, rotate: 20, scale: 1.05)
    static let vote = ShapePose(x: -0.04, y: 0.30, rotate: -22, scale: 1.1)
    static let agreed = ShapePose(x: -0.24, y: 0.42, rotate: 6, scale: 1.05)
    static let finale = ShapePose(x: 0.02, y: 0.32, rotate: -6, scale: 1.15)
    /// Spread out behind the sign-in card (SHAPE_FILL).
    static let fill = ShapePose(x: -0.15, y: -0.06, rotate: -8, scale: 1.7)
}

/// POSE_SPRING: stiffness 90, damping 20.
private let poseSpring = Animation.interpolatingSpring(stiffness: 90, damping: 20)
/// One screen of the phone giving way to the next (SCREEN_MOVE).
private let screenMove = Animation.timingCurve(0.32, 0.72, 0, 1, duration: 0.48)

struct WelcomeStage: View {
    /// Sign-in open over it: the phone gives way and the colour fills the screen.
    let leaving: Bool
    /// Grown out of the intro's icon (#275): the phone appears there first.
    let fromIntro: CGRect?

    @Environment(\.accessibilityReduceMotion) private var still
    @State private var now = 0.0
    @State private var round = 0
    @State private var size = CGSize.zero
    @State private var headlineHeight: CGFloat = 70
    @State private var grown = false
    @State private var introCover = true

    private let month = D.month(Native.now)
    private let plan: (free: [Int64], items: [[MonthItem]])
    private let vote: SuggestedEvent

    init(leaving: Bool, fromIntro: CGRect?) {
        self.leaving = leaving
        self.fromIntro = fromIntro
        let p = D.plan(month)
        plan = p
        vote = D.vote(p.free, title: CasyStrings.welcome("event"))
    }

    private var at: D.Times { D.at }
    private var everyone: [MonthItem] { plan.items.flatMap { $0 } }
    private var agreedDay: Int64 { plan.free[0] }

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let scale = min(h * 0.92 / D.device.height, w * 0.62 / D.device.width)
            let room = 12 + headlineHeight + 10
            let framedHeight = h - room - 6
            let framed = (y: room + framedHeight / 2 - h / 2, scale: min(framedHeight / D.device.height, scale))
            let n = still ? at.shine : now
            let count = { (moments: [Double]) in moments.filter { n >= $0 }.count }
            let voting = n >= at.vote && n < at.agreed
            let listing = n >= at.list && n < at.vote
            let finale = n >= at.finale
            let framedNow = listing || voting || (finale && n < at.finaleOut)
            let thud = n >= at.landing && n < at.thudDone
            let headline: String? =
                listing
                ? CasyStrings.welcome("candidates")
                : voting ? CasyStrings.welcome("voting") : finale && n < at.finaleOut ? CasyStrings.welcome("inEveryones") : nil
            let shape: ShapePose =
                leaving
                ? .fill
                : finale
                    ? (n < at.finaleOut ? .finale : .flat)
                    : n >= at.agreed ? .agreed : voting ? .vote : listing ? .list : .flat
            let phone: (y: CGFloat, scale: CGFloat, turn: Double) =
                framedNow
                ? (voting ? (framed.y + framed.scale * 18, framed.scale * 0.92, 1) : (framed.y, framed.scale, 0))
                : thud ? (0, scale * 1.05, 0) : (0, scale, 0)
            ZStack(alignment: .topLeading) {
                ColourShape(pose: shape, stageHeight: h, leaving: leaving)
                ZStack(alignment: .topLeading) {
                    if let headline, !still {
                        Text(headline)
                            .id(headline)
                            .font(.system(size: 32, weight: .bold))
                            .tracking(-0.8)
                            .lineSpacing(-3)
                            .multilineTextAlignment(.center)
                            .foregroundStyle(Theme.foreground.color)
                            .frame(width: balancedWidth(headline, in: w - 32))
                            .frame(width: w - 32)
                            .offset(x: 16, y: 12)
                            .transition(
                                .asymmetric(
                                    insertion: .offset(y: 14).combined(with: .opacity),
                                    removal: .offset(y: -10).combined(with: .opacity)
                                ).animation(.easeInOut(duration: 0.34)))
                    }
                    // The longest line, unseen, measured: the phone stands under that much room.
                    Text(CasyStrings.welcome("voting").count > CasyStrings.welcome("inEveryones").count
                        ? CasyStrings.welcome("voting") : CasyStrings.welcome("inEveryones"))
                        .font(.system(size: 32, weight: .bold))
                        .lineSpacing(-3)
                        .multilineTextAlignment(.center)
                        .frame(width: w - 32)
                        .fixedSize(horizontal: false, vertical: true)
                        .hidden()
                        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { headlineHeight = $0 }
                    let stageTop = geo.frame(in: .global).minY
                    // Before it has grown: the intro's icon, where it stood, as big as it was.
                    let icon = fromIntro.map {
                        (center: CGPoint(x: $0.midX, y: $0.midY - stageTop), scale: $0.width / D.device.width)
                    }
                    let unGrown = !grown && !still
                    device(n: n, count: count, listing: listing, voting: voting)
                        .overlay {
                            // The icon's orange and logo, giving way to the phone as it grows.
                            if fromIntro != nil {
                                RoundedRectangle(cornerRadius: D.screenRadius, style: .continuous)
                                    .fill(WelcomeIntro.orange)
                                    .overlay { WelcomeLogo().foregroundStyle(.white).frame(width: D.device.width * 0.62) }
                                    .padding(D.edge)
                                    .opacity(introCover ? 1 : 0)
                                    .allowsHitTesting(false)
                            }
                        }
                        .rotation3DEffect(.degrees(11 * phone.turn), axis: (x: 0, y: 1, z: 0), perspective: 0.5)
                        .rotationEffect(.degrees(2 * phone.turn))
                        .scaleEffect(unGrown ? (icon?.scale ?? phone.scale) : phone.scale)
                        .frame(width: D.device.width * scale, height: D.device.height * scale)
                        .position(
                            unGrown
                                ? (icon?.center ?? CGPoint(x: w / 2, y: h / 2 + h * 1.05))
                                : CGPoint(x: w / 2, y: h / 2 + phone.y))
                        .animation(still ? nil : poseSpring, value: phone.y)
                        .animation(still ? nil : poseSpring, value: phone.scale)
                        .animation(still ? nil : poseSpring, value: phone.turn)
                        .animation(still ? nil : poseSpring, value: grown)
                    if !still {
                        WelcomeFriends(
                            size: CGSize(width: w, height: h), top: room, scale: scale, framed: framed,
                            cell: D.dayCell(agreedDay, month: month), day: agreedDay, states: friendStates(n),
                            sent: at.sends.indices.map { n >= at.sends[$0] && n < at.arrived[$0] }, tiles: at.arrived.map { n >= $0 && n < at.finaleOut })
                    }
                }
                .opacity(leaving ? 0 : 1)
                .animation(leaving ? .easeOut(duration: 0.18) : .easeIn(duration: 0.22).delay(0.42), value: leaving)
            }
            .frame(width: w, height: h, alignment: .topLeading)
            .onAppear { size = geo.size }
        }
        .accessibilityHidden(true)
        .allowsHitTesting(false)
        .task(id: round) { await play() }
        // While sign-in is open it starts over unseen, ready for back.
        .onChange(of: leaving) { _, now in
            guard now else { return }
            Task {
                try? await Task.sleep(for: .milliseconds(950))
                if leaving { round += 1 }
            }
        }
        .task {
            // Out of the intro's icon (#275): one calm sweep into the phone, the
            // icon's orange and logo fading away into its screen.
            if fromIntro != nil && !still {
                try? await Task.sleep(for: .milliseconds(30))
                withAnimation(.timingCurve(0.32, 0.72, 0, 1, duration: 0.75)) { grown = true }
                try? await Task.sleep(for: .milliseconds(590))
                withAnimation(.easeOut(duration: 0.36)) { introCover = false }
            } else {
                withAnimation(poseSpring) { grown = true }
            }
        }
    }

    /// The phone and everything on it, at its own size.
    @ViewBuilder
    private func device(n: Double, count: @escaping ([Double]) -> Int, listing: Bool, voting: Bool) -> some View {
        let thrown = count(at.thrown)
        let landed = count(at.landed)
        let taken = count(at.taken)
        let scrolled = count(at.scrolls)
        let answered = count(at.answers)
        let lit = Set(plan.free.dropFirst(taken))
        let onScreen = n < at.home ? "group" : voting ? "vote" : "home"
        let scrolls = D.listScrolls(plan.free, month: month)
        WelcomeDevice(turned: voting ? 1 : 0) {
            ZStack(alignment: .topLeading) {
                Group {
                    switch onScreen {
                    case "group":
                        // The web's exit by where it goes: to the month, it shrinks away.
                        WelcomeGroupScreen(joined: count(at.joined), leaving: n >= at.leave, arriving: round > 0)
                            .transition(
                                .asymmetric(
                                    insertion: .opacity,
                                    removal: .scale(scale: 0.6, anchor: anchor).combined(with: .opacity)
                                ).animation(screenMove))
                    case "vote":
                        WelcomeVoteScreen(event: vote, answered: answered)
                            .transition(
                                .asymmetric(
                                    insertion: .scale(scale: 0.6, anchor: anchor).combined(with: .opacity),
                                    removal: .scale(scale: 0.6, anchor: anchor).combined(with: .opacity)
                                ).animation(screenMove))
                    default:
                        WelcomeHomeScreen(
                            month: month, items: n >= at.digital ? everyone : plan.items[0],
                            pressed: !still && ((n >= at.press && n < at.list) || n >= at.landing),
                            lit: lit, shining: n >= at.shine && n < at.vote,
                            scroll: listing && n < at.back && scrolled > 0 ? scrolls[scrolled - 1] : 0,
                            dim: (listing && n < at.back) || n >= at.landing, badge: n >= at.badge && n < at.vote
                        )
                        .transition(
                            .asymmetric(
                                insertion: n >= at.agreed
                                    ? .scale(scale: 1.5, anchor: anchor).combined(with: .opacity) : .opacity,
                                removal: .scale(scale: 1.5, anchor: anchor).combined(with: .opacity)
                            ).animation(screenMove))
                    }
                }
                .id(onScreen)
                if listing && !still {
                    WelcomeDates(event: vote, days: plan.free, month: month, taken: taken, sent: n >= at.sent)
                }
                if let stage = boxStage(n), !still {
                    WelcomeTravelBox(
                        event: vote, day: agreedDay, month: month, stage: stage,
                        pressed: (n >= at.pressed && n < at.sent) || (n >= at.pillPressed && n < at.vote),
                        answered: answered)
                        .transition(.opacity.animation(.easeInOut(duration: 0.28)))
                }
            }
            .frame(width: D.screen.width, height: D.screen.height, alignment: .topLeading)
        } over: {
            if !still {
                ZStack {
                    if thrown > 0 && n < at.digital {
                        PaperStack(thrown: thrown, landed: landed, squared: n >= at.squared, month: month, items: everyone)
                    }
                    // The pile, squared, one sheet with everyone's pen on it.
                    if n >= at.merged && n < at.press + 0.5 {
                        PaperCalendar(
                            month: month, items: everyone, title: D.groupName, dissolve: n >= at.dissolve, rounded: true
                        )
                        .transition(.opacity.animation(.easeInOut(duration: 0.2)))
                    }
                }
            }
        }
    }

    /// Where the month zooms into the agreed day and back.
    private var anchor: UnitPoint {
        let cell = D.dayCell(agreedDay, month: month)
        return UnitPoint(x: cell.x / D.screen.width, y: cell.y / D.screen.height)
    }

    private func boxStage(_ n: Double) -> WelcomeTravelBox.Stage? {
        if n < at.button { return nil }
        if n < at.sent { return .button }
        if n < at.vote { return .pill }
        if n < at.agreed { return .panel }
        if n < at.collapsed { return .card }
        if n < at.flying { return .ball }
        if n < at.landing { return .flying }
        return .landed
    }

    private func friendStates(_ n: Double) -> [WelcomeFriends.State] {
        (0..<5).map { i in
            if n >= at.arrived[i] { return .around }
            if n >= at.joined[i] { return .gone }
            if n >= D.flyAt[i] { return .row }
            return round > 0 || n >= D.popAt[i] ? .around : .gone
        }
    }

    /// The round: each moment as it comes, then from the top again. While
    /// sign-in is open it waits, and starts over unseen, ready for back.
    private func play() async {
        guard !still else { return }
        now = 0
        let start = Date()
        for moment in at.moments {
            let left = moment - Date().timeIntervalSince(start)
            if left > 0 { try? await Task.sleep(for: .milliseconds(Int(left * 1000))) }
            if Task.isCancelled { return }
            while leaving {
                try? await Task.sleep(for: .milliseconds(200))
                if Task.isCancelled { return }
            }
            // As the web's setReached: each piece moves in its own way, nothing else eases.
            now = moment
        }
        let left = at.end - Date().timeIntervalSince(start)
        if left > 0 { try? await Task.sleep(for: .milliseconds(Int(left * 1000))) }
        if Task.isCancelled { return }
        round += 1
    }
}

/// The narrowest width that keeps a headline on as few lines as the whole
/// width does: its lines come out even, as the web's `text-balance`.
private func balancedWidth(_ text: String, in width: CGFloat) -> CGFloat {
    let font = UIFont.systemFont(ofSize: 32, weight: .bold)
    let attributed = NSAttributedString(string: text, attributes: [.font: font, .kern: -0.8])
    func lines(_ w: CGFloat) -> Int {
        let height = attributed.boundingRect(
            with: CGSize(width: w, height: .greatestFiniteMagnitude), options: [.usesLineFragmentOrigin], context: nil
        ).height
        return Int((height / font.lineHeight).rounded())
    }
    let wanted = lines(width)
    guard wanted > 1 else { return width }
    var low: CGFloat = width / CGFloat(wanted)
    var high = width
    while high - low > 1 {
        let mid = (low + high) / 2
        if lines(mid) > wanted { low = mid } else { high = mid }
    }
    return ceil(high) + 2
}

/// The colour shape behind the phone (SHAPE_COLORS in its rounded box, with
/// the second blob), moving with the phone; spread out behind the sign-in card.
private struct ColourShape: View {
    let pose: ShapePose
    let stageHeight: CGFloat
    let leaving: Bool

    @Environment(\.accessibilityReduceMotion) private var still
    /// Risen into place: it starts under the stage and comes up with the phone.
    @State private var risen = false

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let boxW = w * 1.6
            let boxH = boxW * 0.9
            ZStack(alignment: .topLeading) {
                WelcomeShapeColours().opacity(leaving ? 1 : 0).animation(.easeInOut(duration: 0.45), value: leaving)
                WelcomeShapeBox(width: boxW, height: boxH)
                    .scaleEffect(pose.scale)
                    .rotationEffect(.degrees(pose.rotate))
                    .position(x: -w * 0.3 + boxW / 2 + boxW * pose.x, y: boxH / 2 + boxH * (risen || still ? pose.y : 0.9))
                    .animation(poseSpring, value: pose)
                    .animation(poseSpring, value: risen)
                // Fading out at the bottom, under the headline and buttons.
                LinearGradient(
                    stops: [
                        .init(color: Theme.background.color.opacity(0), location: 0),
                        .init(color: Theme.background.color.opacity(0.7), location: 0.5),
                        .init(color: Theme.background.color, location: 1),
                    ], startPoint: .top, endPoint: .bottom
                )
                .frame(height: 192)
                .offset(y: stageHeight + 40 - 192)
                .opacity(leaving ? 0 : 1)
                .animation(.easeInOut(duration: 0.3), value: leaving)
            }
            .frame(width: w, height: leaving ? geo.size.height + 400 : stageHeight + 40, alignment: .topLeading)
            .clipped()
            .onAppear { risen = true }
        }
        .ignoresSafeArea()
    }
}

// MARK: - The phone's month

/// The phone's screen (PhoneHome): the home page simplified, its real month
/// under its two capsules and over the three buttons along the bottom.
private struct WelcomeHomeScreen: View {
    let month: Int64
    let items: [MonthItem]
    let pressed: Bool
    /// The free days not yet lifted out, and whether they are lit.
    let lit: Set<Int64>
    let shining: Bool
    let scroll: CGFloat
    let dim: Bool
    let badge: Bool
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let lang: Lang = CasyStrings.language == "en" ? .en : .da
        let name = monthName(month, lang)
        ZStack(alignment: .topLeading) {
            Theme.background.color
            VStack(spacing: 0) {
                VStack(alignment: .leading, spacing: 8) {
                    Spacer(minLength: 0)
                    Text(verbatim: name.prefix(1).uppercased() + name.dropFirst())
                        .font(.system(size: 32, weight: .bold))
                        .tracking(-0.8)
                        .foregroundStyle(Theme.foreground.color)
                        .padding(.horizontal, 12)
                    HStack(spacing: 0) {
                        ForEach([1, 2, 3, 4, 5, 6, 0], id: \.self) { dow in
                            Text(verbatim: String(weekdayShortName(wallTime(2026, 0, 4 + dow, 12, appTimeZone), lang).prefix(1)).uppercased())
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(dow == 0 || dow == 6 ? Theme.mutedForeground.color : Theme.foreground.color)
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .padding(.bottom, 4)
                }
                .frame(height: D.headerHeight)
                // The free days lit in the month's own rows, fading up (the web's layer over it).
                PileMonth(
                    month: month, items: items, color: D.colorOf, shine: lit, width: D.screen.width,
                    dark: scheme == .dark, pressed: pressed, shineOpacity: shining ? 1 : 0)
                // The next month, under its short name over its first day (MONTH_LABEL_PX).
                let next = startOfMonth(month, appTimeZone, 1)
                let firstColumn = CGFloat((localDate(next, appTimeZone).dow + 6) % 7)
                let short = monthShortName(next, lang).replacingOccurrences(of: ".", with: "")
                Text(verbatim: short.prefix(1).uppercased() + short.dropFirst())
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(Theme.foreground.color)
                    .lineLimit(1)
                    .frame(width: D.screen.width / 7)
                    .offset(x: firstColumn * D.screen.width / 7)
                    .frame(width: D.screen.width, height: 28, alignment: .topLeading)
                PileMonth(
                    month: next, items: [], color: D.colorOf, shine: [],
                    width: D.screen.width, dark: scheme == .dark)
            }
            // Moved frame by frame as one: the lit days' glow can't trail behind their numbers.
            .modifier(Shift(y: -scroll))
            .opacity(dim ? 0.3 : 1)
            .animation(.easeInOut(duration: 0.45), value: scroll)
            .animation(.easeInOut(duration: 0.45), value: dim)
            LinearGradient(
                stops: [.init(color: Theme.background.color, location: 0.8), .init(color: Theme.background.color.opacity(0), location: 1)],
                startPoint: .top, endPoint: .bottom
            )
            .frame(height: 104)
            LinearGradient(
                stops: [.init(color: Theme.background.color.opacity(0), location: 0), .init(color: Theme.background.color, location: 0.3)],
                startPoint: .top, endPoint: .bottom
            )
            .frame(height: 92)
            .offset(y: D.screen.height - 92)
            HStack(alignment: .top) {
                pill { HStack(spacing: 6) { LucideIcon("layers", size: 20); Text(CasyStrings.calendarsTitle) }.padding(.leading, 14).padding(.trailing, 16) }
                Spacer()
                pill {
                    HStack(spacing: 12) {
                        LucideIcon("plus", size: 20)
                        Rectangle().fill(Theme.primary.color.opacity(0.3)).frame(width: 1, height: 20)
                        Text(CasyStrings.homeToday)
                    }
                    .padding(.horizontal, 16)
                }
            }
            .padding(.horizontal, 16)
            .offset(y: D.pillTop)
            HStack(spacing: 12) {
                round("calendar-check").overlay(alignment: .topTrailing) {
                    if badge {
                        Text(verbatim: "1")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(minWidth: 20, minHeight: 20)
                            .background(Theme.cta.color, in: Capsule())
                            .offset(x: 4, y: -4)
                            .transition(.scale.animation(.interpolatingSpring(stiffness: 500, damping: 18)))
                    }
                }
                HStack(spacing: 8) {
                    LucideIcon("calendar-search", size: 20)
                    Text(CasyStrings.homePlan).fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity, minHeight: 48)
                .phoneGlass(Capsule(), clear: false)
                round("user")
            }
            .font(.system(size: 17))
            .foregroundStyle(Theme.primary.color)
            .padding(.horizontal, 16)
            .offset(y: D.screen.height - 20 - 48)
        }
        .font(.system(size: 17))
        .foregroundStyle(Theme.primary.color)
        .frame(width: D.screen.width, height: D.screen.height, alignment: .topLeading)
        .clipped()
    }

    private func pill<C: View>(@ViewBuilder _ content: () -> C) -> some View {
        content().frame(height: 40).phoneGlass(Capsule(), clear: true)
    }

    private func round(_ icon: String) -> some View {
        LucideIcon(icon, size: 24).frame(width: 48, height: 48).phoneGlass(Circle(), clear: false)
    }
}

extension View {
    /// The drawn phone's capsules in the real app's glass (Liquid Glass): the
    /// web fakes it (NO_BLUR), natively the month bends under it as it
    /// scrolls. Clear on top, as the home page's capsules; regular along the
    /// bottom, as its three buttons.
    fileprivate func phoneGlass<S: Shape>(_ shape: S, clear: Bool) -> some View {
        casyGlass(in: shape, clear: clear)
    }

    /// The web's drawn capsule (NO_BLUR), a soft face and a bright rim: on the
    /// vote, where the phone is turned in 3D and real glass breaks up.
    fileprivate func drawnGlass<S: Shape>(_ shape: S) -> some View {
        background(Theme.card.color.opacity(0.72), in: shape)
            .overlay { shape.stroke(.white.opacity(0.6), lineWidth: 1) }
            .shadow(color: .black.opacity(0.08), radius: 6, y: 3)
    }
}

// MARK: - The dates

/// The dates found, as Planlæg lists them (PhoneDates): each comes out of its
/// green circle, which stretches into its row; sent, they fly down into the
/// Aftaler button.
private struct WelcomeDates: View {
    let event: SuggestedEvent
    let days: [Int64]
    let month: Int64
    let taken: Int
    let sent: Bool

    var body: some View {
        ZStack(alignment: .topLeading) {
            ForEach(Array(days.enumerated()), id: \.offset) { i, day in
                if i < taken {
                    DateRowOut(event: event, i: i, day: day, month: month, sent: sent)
                }
            }
        }
        .frame(width: D.screen.width, height: D.screen.height, alignment: .topLeading)
    }
}

private struct DateRowOut: View {
    let event: SuggestedEvent
    let i: Int
    let day: Int64
    let month: Int64
    let sent: Bool

    @State private var out = false
    @State private var faded = false

    var body: some View {
        let width = D.screen.width - D.list.left * 2
        let height = D.list.height
        let top = D.rowTop(i)
        let cell = D.dayCell(day, month: month)
        let circle: CGFloat = 32
        let aftaler = CGPoint(x: 40, y: D.screen.height - 44)
        let date = event.candidates[i]
        let lang: Lang = CasyStrings.language == "en" ? .en : .da
        let label = dayLabel(day, lang)
        let frame: CGRect =
            sent
            ? CGRect(x: aftaler.x - width * 0.04, y: aftaler.y - height * 0.15, width: width * 0.08, height: height * 0.3)
            : out
                ? CGRect(x: D.list.left, y: top, width: width, height: height)
                : CGRect(x: cell.x - circle / 2, y: top + height / 2 - circle / 2, width: circle, height: circle)
        ZStack {
            Theme.card.color
            Theme.emerald500.color.opacity(faded ? 0 : 1)
            HStack(spacing: 12) {
                Text(verbatim: "\(i + 1)")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 24, height: 24)
                    .background(Theme.cta.color, in: Circle())
                VStack(alignment: .leading, spacing: 0) {
                    Text(verbatim: label.prefix(1).uppercased() + label.dropFirst())
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(Theme.foreground.color)
                        .lineLimit(1)
                    Text(verbatim: "\(formatTime(date.start))-\(formatTime(date.end))")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.mutedForeground.color)
                }
                Spacer(minLength: 0)
                LucideIcon("check", size: 20, stroke: 3).foregroundStyle(Theme.primary.color)
            }
            .padding(.horizontal, 16)
            .frame(width: width, height: height)
            .opacity(faded ? 1 : 0)
            .scaleEffect(x: frame.width / width, y: frame.height / height)
        }
        .frame(width: frame.width, height: frame.height)
        .clipShape(RoundedRectangle(cornerRadius: min(22, frame.height / 2), style: .continuous))
        .overlay { RoundedRectangle(cornerRadius: min(22, frame.height / 2), style: .continuous).strokeBorder(Theme.border.color) }
        .shadow(color: .black.opacity(0.1), radius: 8, y: 4)
        .opacity(sent && faded ? 0 : 1)
        .offset(x: frame.minX, y: frame.minY)
        .animation(
            sent ? .timingCurve(0.45, 0, 0.3, 1, duration: 0.62).delay(Double(i) * 0.1) : .timingCurve(0.3, 0.9, 0.3, 1, duration: 0.55),
            value: frame)
        .onAppear {
            out = true
            withAnimation(.easeInOut(duration: 0.35).delay(0.25)) { faded = true }
        }
    }
}

// MARK: - The vote

/// The day behind a vote on the phone (PhoneVote): the date in question with
/// the event pencilled in, gliding on to the next as each is answered.
private struct WelcomeVoteScreen: View {
    let event: SuggestedEvent
    let answered: Int

    private static let hourHeight: CGFloat = 62
    private static let dayTop: CGFloat = 106

    var body: some View {
        let dates = event.candidates
        let date = dates[min(answered, dates.count - 1)]
        let lang: Lang = CasyStrings.language == "en" ? .en : .da
        let name = monthName(instantOrZero(date.start), lang)
        ZStack(alignment: .topLeading) {
            Theme.background.color
            ZStack {
                day(date, lang: lang)
                    .id(date.id)
                    .transition(.asymmetric(insertion: .offset(x: D.screen.width), removal: .offset(x: -D.screen.width)))
            }
            // GLIDE: the day gliding on to the next date as each is answered.
            .animation(.timingCurve(0.32, 0.72, 0, 1, duration: 0.5), value: date.id)
            .frame(width: D.screen.width, height: D.screen.height - Self.dayTop - 316 + 28, alignment: .top)
            .clipped()
            .offset(y: Self.dayTop)
            HStack(alignment: .top) {
                HStack(spacing: 0) {
                    LucideIcon("chevron-left", size: 24)
                    Text(verbatim: name.prefix(1).uppercased() + name.dropFirst())
                }
                .padding(.leading, 8).padding(.trailing, 16)
                .frame(height: 40)
                .drawnGlass(Capsule())
                Spacer()
                HStack(spacing: 12) {
                    LucideIcon("plus", size: 20)
                    Rectangle().fill(Theme.primary.color.opacity(0.3)).frame(width: 1, height: 20)
                    Text(CasyStrings.homeToday)
                }
                .padding(.horizontal, 16)
                .frame(height: 40)
                .drawnGlass(Capsule())
            }
            .font(.system(size: 17))
            .foregroundStyle(Theme.primary.color)
            .padding(.horizontal, 16)
            .offset(y: D.pillTop)
        }
        .frame(width: D.screen.width, height: D.screen.height, alignment: .topLeading)
    }

    private func day(_ date: CandidateDate, lang: Lang) -> some View {
        let at = instantOrZero(date.start)
        let column = (localDate(at, appTimeZone).dow + 6) % 7
        // "Fredag 13. nov." / "Friday 13 Nov", as the web's toLocaleDateString.
        let d = localDate(at, appTimeZone)
        let named = weekdayName(at, lang)
        let short = lang == .da ? "\(named) \(d.day). \(monthShortName(at, lang))" : "\(named) \(d.day) \(monthShortName(at, lang))"
        let label = short.prefix(1).uppercased() + short.dropFirst()
        return VStack(spacing: 0) {
            HStack(spacing: 0) {
                ForEach(0..<7, id: \.self) { i in
                    VStack(spacing: 4) {
                        Text(verbatim: String(weekdayShortName(wallTime(2026, 0, 5 + i, 12, appTimeZone), lang).prefix(1)).uppercased())
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(Theme.foreground.color)
                        Text(verbatim: "\(localDate(addDays(at, i - column, appTimeZone), appTimeZone).day)")
                            .font(.system(size: 18, weight: i == column ? .bold : .regular))
                            .foregroundStyle(i == column ? Theme.background.color : Theme.foreground.color)
                            .frame(width: 36, height: 36)
                            .background(i == column ? Theme.foreground.color : .clear, in: Circle())
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            Text(verbatim: label)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Theme.primary.color)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .overlay(alignment: .top) { Rectangle().fill(Theme.border.color.opacity(0.7)).frame(height: 1) }
                .overlay(alignment: .bottom) { Rectangle().fill(Theme.border.color.opacity(0.7)).frame(height: 1) }
                .padding(.top, 8)
            ZStack(alignment: .topLeading) {
                ForEach(0..<6, id: \.self) { i in
                    ZStack(alignment: .topLeading) {
                        Text(verbatim: "\(Int(D.eventHours.from) - 1 + i):00")
                            .font(.system(size: 12).monospacedDigit())
                            .foregroundStyle(Theme.mutedForeground.color)
                            .offset(x: 8, y: -8)
                        Rectangle().fill(Theme.border.color.opacity(0.7)).frame(height: 1).padding(.leading, 56)
                    }
                    .offset(y: CGFloat(i) * Self.hourHeight)
                }
                VStack(alignment: .leading, spacing: 0) {
                    Text(event.title).font(.system(size: 14, weight: .bold))
                    Text(verbatim: "\(formatTime(date.start))-\(formatTime(date.end))").font(.system(size: 13))
                }
                .foregroundStyle(Theme.primary.color)
                .padding(.horizontal, 8).padding(.vertical, 4)
                .frame(width: D.screen.width - 64, height: Self.hourHeight * 3, alignment: .topLeading)
                .background(Theme.primary.color.opacity(0.15), in: RoundedRectangle(cornerRadius: 6))
                .overlay { RoundedRectangle(cornerRadius: 6).strokeBorder(Theme.primary.color) }
                .offset(x: 56, y: Self.hourHeight)
            }
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .padding(.top, 8)
        }
    }
}

/// What the panel over the day says (VotePanel): the title, a bar per date,
/// and the app's real card, thrown the way its answer says.
private struct WelcomeVotePanel: View {
    let event: SuggestedEvent
    let answered: Int

    private static let answers: [EventResponse] = [.accepted, .declined, .accepted]

    var body: some View {
        let dates = event.candidates
        let index = min(answered, dates.count - 1)
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                VStack(alignment: .leading, spacing: 0) {
                    Text(event.title).font(.system(size: 17, weight: .bold)).foregroundStyle(Theme.foreground.color)
                    Text(verbatim: event.group.name).font(.system(size: 13)).foregroundStyle(Theme.mutedForeground.color)
                }
                Spacer()
                LucideIcon("rotate-ccw", size: 20).foregroundStyle(Theme.amber600.color).opacity(0.3)
                Text(CasyStrings.voteDone).font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.primary.color)
                    .padding(.horizontal, 8)
            }
            HStack(spacing: 4) {
                ForEach(0..<dates.count, id: \.self) { i in
                    Capsule()
                        .fill(
                            i == answered
                                ? Theme.foreground.color
                                : i < answered
                                    ? (Self.answers[i] == .accepted ? Theme.emerald500.color : Theme.rose400.color)
                                    : Theme.secondary.color
                        )
                        .frame(height: 6)
                }
            }
            .animation(.easeInOut(duration: 0.3), value: answered)
            .padding(.top, 8)
            ZStack {
                if index + 1 < dates.count {
                    VoteCardFace(event: event, date: dates[index + 1], position: index + 2, total: dates.count, yours: nil)
                        .offset(y: 8).scaleEffect(0.96).opacity(0.6)
                }
                if answered >= dates.count {
                    Text(CasyStrings.voteDoneTitle).font(.system(size: 20, weight: .bold)).foregroundStyle(Theme.foreground.color)
                        .transition(.opacity.animation(.easeInOut(duration: 0.2).delay(0.15)))
                }
                if answered < dates.count {
                    VoteCardFace(event: event, date: dates[index], position: index + 1, total: dates.count, yours: nil)
                        .overlay(alignment: Self.answers[index] == .accepted ? .topLeading : .topTrailing) {
                            stamp(Self.answers[index]).opacity(0)
                        }
                        .id(dates[index].id)
                        .transition(
                            .asymmetric(
                                insertion: .scale(scale: 0.96).combined(with: .offset(y: 8)),
                                removal: .offset(x: Self.answers[max(0, answered - 1)] == .accepted ? 640 : -640)
                                    .combined(with: .opacity)
                            ).animation(.timingCurve(0.3, 0, 0.8, 0.6, duration: 0.42)))
                }
            }
            .frame(height: 212)
            .padding(.top, 12)
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 20)
        .frame(width: D.screen.width)
    }

    private func stamp(_ answer: EventResponse) -> some View {
        let yes = answer == .accepted
        return Text(yes ? CasyStrings.voteCan : CasyStrings.voteCant)
            .font(.system(size: 24, weight: .heavy))
            .textCase(.uppercase)
            .foregroundStyle(yes ? Theme.emerald600.color : Theme.rose600.color)
            .padding(.horizontal, 8)
            .overlay { RoundedRectangle(cornerRadius: 8).strokeBorder(yes ? Theme.emerald500.color : Theme.rose500.color, lineWidth: 3) }
            .rotationEffect(.degrees(yes ? -12 : 12))
            .padding(24)
    }
}

// MARK: - The box that travels

/// The one box that carries the second half (TravelBox): the send button
/// becomes the "Svar på" pill, which grows into the vote's panel, which
/// becomes the agreed card, which collapses into a circle that lands on its day.
struct WelcomeTravelBox: View {
    enum Stage: Equatable { case button, pill, panel, card, ball, flying, landed }

    let event: SuggestedEvent
    let day: Int64
    let month: Int64
    let stage: Stage
    let pressed: Bool
    let answered: Int

    private static let card = CGRect(x: 20, y: 360, width: D.screen.width - 40, height: 222)
    private static let ball: CGFloat = 60
    private static let dayCircle: CGFloat = 32
    private static var ballFrom: CGPoint { CGPoint(x: D.screen.width / 2, y: card.midY) }

    private static func rect(_ stage: Stage) -> (CGRect, CGFloat) {
        switch stage {
        case .button:
            return (CGRect(x: D.list.left, y: D.rowTop(3) + 6, width: D.screen.width - D.list.left * 2, height: 56), 28)
        case .pill: return (CGRect(x: 46, y: D.screen.height - 124, width: D.screen.width - 92, height: 44), 22)
        case .panel: return (CGRect(x: 0, y: D.screen.height - 316, width: D.screen.width, height: 356), 28)
        case .card: return (card, 28)
        case .ball, .flying, .landed:
            return (CGRect(x: ballFrom.x - ball / 2, y: ballFrom.y - ball / 2, width: ball, height: ball), ball / 2)
        }
    }

    @State private var flight = 0.0
    @State private var squash = false

    var body: some View {
        let (rect, radius) = Self.rect(stage)
        let flying = stage == .flying || stage == .landed
        let landed = stage == .landed
        let isBall = stage == .ball || flying
        let cell = D.dayCell(day, month: month)
        let lang: Lang = CasyStrings.language == "en" ? .en : .da
        let date = event.candidates.first { $0.id == String(day) } ?? event.candidates[0]
        let headline = formatHeadline(
            event.settings.kind, vacationDays: 0, start: date.start, end: date.end, lang, CasyStrings.headlineWords)
        ZStack(alignment: .topLeading) {
            Color.black.opacity(stage == .card ? 0.3 : 0).animation(.easeInOut(duration: 0.35), value: stage)
            ZStack(alignment: .topLeading) {
                Theme.card.color
                face(stage == .button) {
                    Text(CasyStrings.pileSuggest(event.candidates.count))
                        .font(.system(size: 17, weight: .bold)).foregroundStyle(Theme.primary.color)
                        .frame(width: rect.width, height: rect.height)
                }
                face(stage == .pill) {
                    HStack(spacing: 8) {
                        LucideIcon("vote", size: 20)
                        Text(CasyStrings.homeVoteAnswer(event.title)).lineLimit(1)
                        LucideIcon("chevron-right", size: 16)
                    }
                    .font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.primary.color)
                    .frame(width: rect.width, height: rect.height)
                }
                if [.pill, .panel, .card].contains(stage) {
                    face(stage == .panel) { WelcomeVotePanel(event: event, answered: answered) }
                }
                Theme.cta.color.opacity(isBall ? 1 : 0).animation(.easeInOut(duration: 0.25), value: isBall)
                face(stage == .card) {
                    VStack(alignment: .leading, spacing: 4) {
                        // Each line as tall as the web's (1.5 times its size; 1.1 for the date).
                        Text(CasyStrings.agreedEveryone).textCase(.uppercase)
                            .font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.primary.color)
                            .frame(height: 18)
                        Text(event.title).font(.system(size: 17, weight: .semibold)).foregroundStyle(Theme.foreground.color)
                            .frame(height: 25.5)
                        Text(verbatim: headline.lines.joined(separator: " "))
                            .font(.system(size: 28, weight: .heavy)).tracking(-0.7).foregroundStyle(Theme.foreground.color)
                            .frame(height: 30.8)
                        Text(verbatim: headline.time).font(.system(size: 17)).foregroundStyle(Theme.foreground.color)
                            .frame(height: 25.5)
                        HStack(spacing: -8) {
                            ForEach(Array(event.invitees.enumerated()), id: \.offset) { i, p in
                                Avatar(name: p.name, index: i, size: .medium)
                                    .overlay { Circle().strokeBorder(Theme.card.color, lineWidth: 2) }
                            }
                        }
                        .padding(.top, 8)
                    }
                    .padding(20)
                    .frame(width: Self.card.width, alignment: .leading)
                    .lineLimit(1)
                }
                if landed {
                    Text(verbatim: "\(localDate(day, appTimeZone).day)")
                        .font(.system(size: 18 * Self.ball / Self.dayCircle, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: rect.width, height: rect.height)
                        .transition(.opacity.animation(.easeInOut(duration: 0.15).delay(0.06)))
                }
            }
            .frame(width: rect.width, height: rect.height, alignment: .topLeading)
            .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
            // A card throughout, as the web's: the phone turns in 3D as the pill
            // grows into the panel, and real glass breaks up under that.
            .overlay { RoundedRectangle(cornerRadius: radius, style: .continuous).strokeBorder(Theme.border.color) }
            .shadow(color: .black.opacity(0.38), radius: 20, y: 14)
            .scaleEffect(pressed ? 0.94 : 1)
            .keyframeAnimator(initialValue: 1.0, trigger: squash) { view, s in view.scaleEffect(s) } keyframes: { _ in
                KeyframeTrack {
                    LinearKeyframe(1.5, duration: 0)
                    CubicKeyframe(0.82, duration: 0.15)
                    CubicKeyframe(1.08, duration: 0.15)
                    CubicKeyframe(1, duration: 0.12)
                }
            }
            // The flight: one curve to the day, slow off and quickening into the landing,
            // shrinking about the ball's own centre (before it is moved to its place).
            .modifier(FlightAlong(progress: flying ? flight : 0, to: cell, from: Self.ballFrom, ballSize: Self.ball, day: Self.dayCircle))
            .offset(x: rect.minX, y: rect.minY)
            .animation(.interpolatingSpring(stiffness: 170, damping: 24), value: stage)
            .animation(.easeOut(duration: 0.15), value: pressed)
            if landed { landing(at: cell) }
        }
        .frame(width: D.screen.width, height: D.screen.height, alignment: .topLeading)
        .onChange(of: stage) { _, now in
            if now == .flying { withAnimation(.linear(duration: D.flightFor)) { flight = 1 } }
            if now == .landed { squash.toggle() }
        }
    }

    private func face<C: View>(_ shown: Bool, @ViewBuilder _ content: () -> C) -> some View {
        content()
            .opacity(shown ? 1 : 0)
            .animation(shown ? .easeInOut(duration: 0.22).delay(0.14) : .easeInOut(duration: 0.12), value: shown)
    }

    /// The event under its number, two rings going out, and a burst of bits.
    private func landing(at cell: CGPoint) -> some View {
        ZStack {
            Text(event.title)
                .font(.system(size: 11, weight: .semibold)).foregroundStyle(.white).lineLimit(1)
                .padding(.horizontal, 4)
                .frame(width: 50, height: 17)
                .background(Theme.cta.color, in: RoundedRectangle(cornerRadius: 4))
                .offset(y: 21 + 8)
            Ring(delay: 0)
            Ring(delay: 0.12)
            Burst()
        }
        .position(cell)
    }
}

/// A move worked out each frame, so everything under it moves as one.
private struct Shift: ViewModifier, Animatable {
    var y: CGFloat
    var animatableData: CGFloat {
        get { y }
        set { y = newValue }
    }
    func body(content: Content) -> some View { content.offset(y: y) }
}

/// The ball's way to the day along a curve bending to one side (curveTo).
private struct FlightAlong: ViewModifier, Animatable {
    var progress: Double
    let to: CGPoint
    let from: CGPoint
    let ballSize: CGFloat
    let day: CGFloat

    var animatableData: Double {
        get { progress }
        set { progress = newValue }
    }

    func body(content: Content) -> some View {
        let u = progress
        let t = u * u * (2.2 - 1.2 * u)
        let dx = to.x - from.x
        let dy = to.y - from.y
        let length = max(hypot(dx, dy), 1)
        let control = CGPoint(x: from.x + dx / 2 - dy / length * 70, y: from.y + dy / 2 + dx / length * 70)
        let a = (1 - t) * (1 - t)
        let b = 2 * t * (1 - t)
        let c = t * t
        let x = a * from.x + b * control.x + c * to.x - from.x
        let y = a * from.y + b * control.y + c * to.y - from.y
        return content
            .scaleEffect(1 + (day / ballSize - 1) * t)
            .offset(x: x, y: y)
    }
}

private struct Ring: View {
    let delay: Double
    @State private var out = false

    var body: some View {
        Circle().strokeBorder(Theme.primary.color, lineWidth: 3)
            .frame(width: 40, height: 40)
            .scaleEffect(out ? 5 : 0.6)
            .opacity(out ? 0 : 0.9)
            .onAppear { withAnimation(.easeOut(duration: 0.8).delay(delay)) { out = true } }
    }
}

/// Bits in everyone's colours and orange, thrown out and falling.
private struct Burst: View {
    @State private var t = 0.0

    var body: some View {
        let colors = ["234, 88, 12"] + D.friends.map(\.color)
        ZStack {
            ForEach(0..<40, id: \.self) { i in
                let angle = Double(i) / 40 * .pi * 2 + Double(i % 3) * 0.2
                let reach = 70 + Double(i % 5) * 34
                let x = cos(angle) * reach
                let y = sin(angle) * reach - 18
                let up = min(t / 0.45, 1)
                let fall = max(0, (t - 0.45) / 0.55)
                RoundedRectangle(cornerRadius: 1)
                    .fill(Color(rgb: colors[i % colors.count]))
                    .frame(width: 6, height: 11)
                    .rotationEffect(.degrees((i % 2 == 1 ? 1 : -1) * 220 * t))
                    .offset(x: x * t, y: y * up + 90 * fall)
                    .opacity(t < 0.45 ? 1 : 1 - fall)
            }
        }
        .modifier(BurstClock(t: t))
        .onAppear { withAnimation(.easeOut(duration: 1.3)) { t = 1 } }
    }
}

/// Lets the burst's clock animate (the bits read `t` each frame).
private struct BurstClock: ViewModifier, Animatable {
    var t: Double
    var animatableData: Double {
        get { t }
        set { t = newValue }
    }
    func body(content: Content) -> some View { content }
}

// MARK: - The friends

/// The five friends (Friends): around the phone at the start, flying into
/// their rows as they join, back out at the end with the agreed date's tile
/// and a tick. They live on the stage, outside the phone.
struct WelcomeFriends: View {
    enum State { case gone, around, row }

    let size: CGSize
    let top: CGFloat
    let scale: CGFloat
    let framed: (y: CGFloat, scale: CGFloat)
    let cell: CGPoint
    let day: Int64
    let states: [State]
    let sent: [Bool]
    let tiles: [Bool]

    private static let face: CGFloat = 58
    private static let places: [(side: CGFloat, y: CGFloat)] = [(-1, 0.34), (1, 0.26), (-1, 0.74), (1, 0.55), (1, 0.84)]

    var body: some View {
        let w = size.width
        let h = size.height
        let leftX = 5 + Self.face / 2
        let rightX = w - 5 - 15 - Self.face / 2
        let from = CGPoint(
            x: w / 2 + (cell.x - D.screen.width / 2) * framed.scale,
            y: h / 2 + framed.y + (cell.y - D.screen.height / 2) * framed.scale)
        let lang: Lang = CasyStrings.language == "en" ? .en : .da
        ZStack(alignment: .topLeading) {
            ForEach(Array(D.friends.enumerated()), id: \.offset) { i, f in
                let place = CGPoint(x: Self.places[i].side < 0 ? leftX : rightX, y: top + Self.places[i].y * (h - top))
                let row = CGPoint(
                    x: w / 2 + (D.rows.left + 12 + D.rows.face / 2 - D.screen.width / 2) * scale,
                    y: h / 2 + (D.rows.top + CGFloat(i + 1) * D.rows.height + D.rows.height / 2 - D.screen.height / 2) * scale)
                let state = states[i]
                let at = state == .row ? row : place
                if sent[i] && !tiles[i] {
                    SentDot(from: from, to: place)
                }
                WelcomeFace(name: f.name, color: f.color, size: Self.face)
                    .shadow(color: .black.opacity(0.25), radius: 12, y: 8)
                    .overlay(alignment: .bottomTrailing) {
                        VStack(spacing: 1) {
                            // "FRE", as the web's weekdaysShort: no full stop.
                            Text(verbatim: weekdayShortName(day, lang).replacingOccurrences(of: ".", with: "")).textCase(.uppercase)
                                .font(.system(size: 9, weight: .bold)).foregroundStyle(Theme.primary.color)
                            Text(verbatim: "\(localDate(day, appTimeZone).day)")
                                .font(.system(size: 20, weight: .bold)).foregroundStyle(Theme.foreground.color)
                        }
                        .frame(width: 34, height: 38)
                        .background(Theme.card.color, in: RoundedRectangle(cornerRadius: 9))
                        .overlay { RoundedRectangle(cornerRadius: 9).strokeBorder(Theme.border.color) }
                        .shadow(color: .black.opacity(0.25), radius: 8, y: 6)
                        .scaleEffect(tiles[i] ? 1 : 0)
                        .rotationEffect(.degrees(tiles[i] ? 0 : -14))
                        .animation(tiles[i] ? .interpolatingSpring(stiffness: 420, damping: 16).delay(0.05) : .easeIn(duration: 0.2), value: tiles[i])
                        .offset(x: 15, y: 17)
                        .overlay(alignment: .topTrailing) {
                            LucideIcon("check", size: 12, stroke: 3.5)
                                .foregroundStyle(.white)
                                .frame(width: 18, height: 18)
                                .background(Theme.emerald500.color, in: Circle())
                                .overlay { Circle().strokeBorder(Theme.card.color, lineWidth: 1.5) }
                                .scaleEffect(tiles[i] ? 1 : 0)
                                .animation(tiles[i] ? .interpolatingSpring(stiffness: 520, damping: 16).delay(0.2) : .easeIn(duration: 0.16), value: tiles[i])
                                // On the tile's top corner, as the web's (right -20, bottom 14 of the face):
                                // placed from where the tile stood before its own move.
                                .offset(x: 20, y: 6)
                        }
                    }
                    // As the web's: flying into its row everything eases together; back
                    // around, it is put in its place at once, unseen, and only grows.
                    .scaleEffect(state == .gone ? 0 : state == .row ? D.rows.face * scale / Self.face : 1)
                    .animation(
                        state == .row
                            ? .timingCurve(0.5, 0, 0.3, 1, duration: D.flyFor)
                            : state == .around ? .interpolatingSpring(stiffness: 340, damping: 17) : nil,
                        value: state)
                    .opacity(state == .gone ? 0 : 1)
                    .position(at)
                    .animation(state == .row ? .timingCurve(0.5, 0, 0.3, 1, duration: D.flyFor) : nil, value: state)
            }
        }
        .frame(width: w, height: h, alignment: .topLeading)
    }
}

/// The date on its way out to a friend; different paces across and down make it a curve.
private struct SentDot: View {
    let from: CGPoint
    let to: CGPoint
    @State private var gone = false

    var body: some View {
        Circle().fill(Theme.cta.color)
            .frame(width: 16, height: 16)
            .scaleEffect(gone ? 1.4 : 0.6)
            .position(x: gone ? to.x : from.x, y: from.y)
            .offset(y: gone ? to.y - from.y : 0)
            .onAppear {
                withAnimation(.timingCurve(0.3, 0, 0.5, 1, duration: D.sendFor)) { gone = true }
            }
    }
}
