import CasyCore
import CasyUI
import SwiftUI

// The welcome's drawn phone and what is on it (#228, #282): the web's
// PhoneDevice, PhoneGroup, Friends' faces and PaperCalendar, in the phone's
// own points (WelcomeDemo.screen), scaled by the stage.

private typealias D = WelcomeDemo

/// Silver, brightest where the light catches it, darker toward the corners (METAL).
private let metal = LinearGradient(
    stops: [
        .init(color: Color(hex: 0x8C8F94), location: 0), .init(color: Color(hex: 0xECEDED), location: 0.07),
        .init(color: Color(hex: 0xC4C6C9), location: 0.22), .init(color: Color(hex: 0xDFE0E2), location: 0.5),
        .init(color: Color(hex: 0xC4C6C9), location: 0.78), .init(color: Color(hex: 0xECEDED), location: 0.93),
        .init(color: Color(hex: 0x8C8F94), location: 1),
    ], startPoint: .leading, endPoint: .trailing)

/// The phone on the welcome screen, drawn rather than a picture (PhoneDevice):
/// silver with its side and buttons showing when turned (`turned`, 0 to 1),
/// the black bezel, the Dynamic Island. `screen` is cut to the screen's
/// corners; `over` lies over the whole screen, uncut, for the paper.
struct WelcomeDevice<Screen: View, Over: View>: View {
    var turned: Double = 0
    @ViewBuilder let screen: () -> Screen
    @ViewBuilder let over: () -> Over

    var body: some View {
        ZStack {
            // Its thickness, seen when turned: the same outline, darker, behind.
            RoundedRectangle(cornerRadius: D.deviceRadius, style: .continuous)
                .fill(metal)
                .overlay {
                    RoundedRectangle(cornerRadius: D.deviceRadius, style: .continuous).fill(.black.opacity(0.3))
                }
                .offset(x: 14 * turned)
                .opacity(turned)
            ForEach(Array([(184.0, 48.0), (262, 86), (366, 86)].enumerated()), id: \.offset) { _, b in
                sideButton(top: b.0, height: b.1, left: true)
            }
            sideButton(top: 296, height: 136, left: false)
            RoundedRectangle(cornerRadius: D.deviceRadius, style: .continuous)
                .fill(metal)
                .overlay {
                    RoundedRectangle(cornerRadius: D.deviceRadius, style: .continuous)
                        .strokeBorder(.white.opacity(0.55), lineWidth: 1)
                }
            RoundedRectangle(cornerRadius: D.deviceRadius - D.band, style: .continuous)
                .fill(.black)
                .padding(D.band)
            ZStack(alignment: .top) {
                Theme.background.color
                screen()
                Capsule().fill(.black).frame(width: 122, height: 35)
                    .overlay(alignment: .trailing) {
                        Circle()
                            .fill(
                                RadialGradient(
                                    colors: [Color(hex: 0x27335F), Color(hex: 0x0B0E1F), Color(hex: 0x05060C)],
                                    center: UnitPoint(x: 0.4, y: 0.4), startRadius: 0, endRadius: 8)
                            )
                            .frame(width: 13, height: 13)
                            .padding(.trailing, 10)
                    }
                    .padding(.top, 11)
            }
            .frame(width: D.screen.width, height: D.screen.height)
            .clipShape(RoundedRectangle(cornerRadius: D.screenRadius, style: .continuous))
            over().frame(width: D.screen.width, height: D.screen.height)
        }
        .frame(width: D.device.width, height: D.device.height)
    }

    private func sideButton(top: Double, height: Double, left: Bool) -> some View {
        RoundedRectangle(cornerRadius: 2)
            .fill(
                LinearGradient(
                    colors: [Color(hex: 0xA9ABAF), Color(hex: 0xE3E4E6), Color(hex: 0xC9CACD), Color(hex: 0x8E9095)],
                    startPoint: .top, endPoint: .bottom)
            )
            .frame(width: 6, height: height)
            .position(x: left ? 0 : D.device.width, y: top + height / 2)
            .frame(width: D.device.width, height: D.device.height)
    }
}

/// A person's round face in their own colour (Face).
struct WelcomeFace: View {
    let name: String
    let color: String
    let size: CGFloat

    var body: some View {
        Text(verbatim: String(name.prefix(1)))
            .font(.system(size: size * 0.42, weight: .bold))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(Color(rgb: color), in: Circle())
    }
}

/// A group on the phone (PhoneGroup): its name, how many are in it, the
/// members as rows, friends coming in as they join. `leaving`, the members'
/// card grows to the whole screen, the page the month appears on;
/// `arriving` (every round after the first), it comes out of it the same way.
struct WelcomeGroupScreen: View {
    let joined: Int
    let leaving: Bool
    let arriving: Bool

    @State private var grown: Bool

    init(joined: Int, leaving: Bool, arriving: Bool) {
        self.joined = joined
        self.leaving = leaving
        self.arriving = arriving
        _grown = State(initialValue: arriving)
    }

    private static let grow = Animation.interpolatingSpring(stiffness: 170, damping: 26)

    private var card: CGRect {
        CGRect(
            x: D.rows.left, y: D.rows.top, width: D.screen.width - D.rows.left * 2,
            height: D.rows.height * CGFloat(D.people.count + 1))
    }
    private var shown: Bool { !leaving && !(arriving && grown) }

    var body: some View {
        let rect = grown ? CGRect(origin: .zero, size: D.screen) : card
        ZStack(alignment: .topLeading) {
            Theme.background.color
            topBar
            heading
            members
                .frame(width: rect.width, height: rect.height, alignment: .topLeading)
                .clipShape(RoundedRectangle(cornerRadius: grown ? D.screenRadius : 16, style: .continuous))
                .offset(x: rect.minX, y: rect.minY)
        }
        .frame(width: D.screen.width, height: D.screen.height, alignment: .topLeading)
        .animation(.easeInOut(duration: 0.22).delay(!leaving && arriving ? 0.3 : 0), value: shown)
        .onAppear {
            if arriving { withAnimation(Self.grow) { grown = false } }
        }
        .onChange(of: leaving) { _, now in
            if now { withAnimation(Self.grow) { grown = true } }
        }
    }

    private var topBar: some View {
        HStack {
            HStack(spacing: 0) {
                LucideIcon("chevron-left", size: 24)
                Text(CasyStrings.groupsShort)
            }
            Spacer()
            Text(CasyStrings.done).fontWeight(.semibold)
        }
        .font(.system(size: 17))
        .foregroundStyle(Theme.primary.color)
        .padding(.horizontal, 16)
        .frame(width: D.screen.width)
        .offset(y: 62)
        .opacity(shown ? 1 : 0)
    }

    private var heading: some View {
        VStack(spacing: 0) {
            Text(verbatim: String(D.groupName.prefix(1)))
                .font(.system(size: 40, weight: .bold))
                .foregroundStyle(Theme.orange700.color)
                .frame(width: 96, height: 96)
                .background(Theme.orange100.color, in: Circle())
            Text(verbatim: D.groupName)
                .font(.system(size: 24, weight: .bold))
                .tracking(-0.6)
                .foregroundStyle(Theme.foreground.color)
                .padding(.top, 12)
            Text(CasyStrings.groupMembers(1 + joined))
                .font(.system(size: 15).monospacedDigit())
                .foregroundStyle(Theme.mutedForeground.color)
        }
        .frame(width: D.screen.width)
        .offset(y: 112)
        .opacity(shown ? 1 : 0)
    }

    /// The members, each in the place its face flies to; grown, the page itself.
    private var members: some View {
        ZStack(alignment: .topLeading) {
            Theme.card.color
            memberRows
                .frame(width: card.width, height: card.height, alignment: .topLeading)
                .opacity(shown ? 1 : 0)
            Theme.background.color.opacity(grown ? 1 : 0)
        }
    }

    private var memberRows: some View {
        ZStack(alignment: .topLeading) {
            row(0, CasyStrings.welcome("you"), D.people[0].color)
            ForEach(Array(D.friends.enumerated()), id: \.offset) { i, f in
                if i < joined {
                    // The face lands and stays: the row is there as it arrives.
                    row(i + 1, f.name, f.color)
                        .transition(.identity)
                }
            }
            HStack(spacing: 12) {
                LucideIcon("plus", size: 24)
                Text(CasyStrings.groupInvitePeople).fontWeight(.medium)
            }
            .font(.system(size: 17))
            .foregroundStyle(Theme.primary.color)
            .padding(.horizontal, 16)
            .frame(height: D.rows.height)
            .offset(y: CGFloat(D.people.count) * D.rows.height)
        }
    }

    private func row(_ i: Int, _ name: String, _ color: String) -> some View {
        HStack(spacing: 12) {
            WelcomeFace(name: name, color: color, size: D.rows.face)
            Text(name).font(.system(size: 17)).foregroundStyle(Theme.foreground.color)
        }
        .padding(.horizontal, 12)
        .frame(height: D.rows.height)
        .offset(y: CGFloat(i) * D.rows.height)
    }
}

// MARK: - The paper calendars

private let paper = Color(hex: 0xFBF8F0)
private let ink = Color(hex: 0x2B2926)
private let weekendInk = Color(hex: 0xB3362B)

/// Three pen scribbles, like a word written fast; a day picks one.
private let scribbles = [
    "M2 11c3-9 5-9 6-1s3 7 6 0 5-8 7 0 3 7 6 1 4-7 7-1 3 5 8 0",
    "M2 8c2 5 4 6 7 1s4-6 6 0 3 6 6 0 4-5 7 1 5 4 10-2",
    "M3 10c4-8 6-7 7 0s4 5 6-1 5-7 6 1 4 6 8-1 3-3 8-1",
]

/// A real paper calendar, printed and written on (PaperCalendar): its
/// binding, whose it is, the numbers in a printed serif, and someone's busy
/// days in their own pen, each scribble exactly where the month draws that
/// person's bar. With no `who`, everyone's pen: the calendars made one, which
/// then dissolves (`dissolve`) a week at a time from the middle out.
struct PaperCalendar: View {
    let month: Int64
    let items: [MonthItem]
    var who: String?
    let title: String
    var color: String?
    var dissolve = false
    var rounded = false

    var body: some View {
        let weeks = PileMonth.weeks(month, items)
        let middle = Double(weeks.count - 1) / 2
        let step = 0.16
        let last = (middle + 1) * step
        let column = D.screen.width / 7
        ZStack(alignment: .topLeading) {
            piece(dissolveAfter: last) {
                ZStack(alignment: .topLeading) {
                    HStack(spacing: 22) {
                        ForEach(0..<10, id: \.self) { _ in
                            Circle().fill(Color(hex: 0x3A3833).opacity(0.8)).frame(width: 13, height: 13)
                                .overlay(alignment: .bottom) {
                                    Capsule()
                                        .fill(
                                            LinearGradient(
                                                stops: [
                                                    .init(color: Color(hex: 0x8A8C90), location: 0),
                                                    .init(color: Color(hex: 0xE6E7E8), location: 0.45),
                                                    .init(color: Color(hex: 0x9B9DA1), location: 1),
                                                ], startPoint: .leading, endPoint: .trailing)
                                        )
                                        .frame(width: 5, height: 22)
                                        .offset(y: -5)
                                }
                        }
                    }
                    .frame(width: D.screen.width)
                    .offset(y: 18)
                    Text(verbatim: title)
                        .font(.custom("Georgia-Bold", size: 46))
                        .tracking(-1)
                        .lineLimit(1)
                        .foregroundStyle(color.map { Color(rgb: $0) } ?? ink)
                        .frame(width: D.screen.width - 32, height: 56)
                        .offset(x: 16, y: 62)
                    HStack(spacing: 0) {
                        ForEach([1, 2, 3, 4, 5, 6, 0], id: \.self) { dow in
                            Text(verbatim: String(weekdayShortName(wallTime(2026, 0, 4 + dow, 12, appTimeZone), CasyStrings.language == "en" ? .en : .da).prefix(1)).uppercased())
                                .font(.custom("Georgia-Bold", size: 12))
                                .tracking(1)
                                .foregroundStyle(dow == 0 || dow == 6 ? weekendInk : ink)
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .offset(y: D.headerHeight - 24)
                }
                .frame(width: D.screen.width, height: D.headerHeight, alignment: .topLeading)
            }
            ForEach(Array(weeks.enumerated()), id: \.offset) { w, week in
                piece(dissolveAfter: abs(Double(w) - middle) * step) {
                    ZStack(alignment: .topLeading) {
                        Rectangle().fill(ink.opacity(0.25)).frame(height: 1)
                        HStack(spacing: 0) {
                            ForEach(Array(week.days.enumerated()), id: \.offset) { c, day in
                                Text(verbatim: day.inMonth ? "\(day.dayOfMonth)" : "")
                                    .font(.custom("Georgia", size: 20))
                                    .foregroundStyle(c >= 5 ? weekendInk : ink)
                                    .frame(width: column, height: 40)
                            }
                        }
                        ForEach(1..<7, id: \.self) { c in
                            Rectangle().fill(ink.opacity(0.1)).frame(width: 1, height: D.weekRow)
                                .offset(x: column * CGFloat(c))
                        }
                        let placed = who.map { w in week.layout.placed.filter { $0.item.calendarId == w } } ?? week.layout.placed
                        ForEach(Array(placed.enumerated()), id: \.offset) { _, p in
                            Scribble(path: scribbles[(w * 7 + p.from + p.lane) % scribbles.count])
                                .stroke(
                                    Color(rgb: color ?? D.colorOf(p.item.calendarId)),
                                    style: StrokeStyle(lineWidth: 2.2, lineCap: .round, lineJoin: .round))
                                .frame(width: column - 8, height: monthLanePoints - 3)
                                .offset(x: column * CGFloat(p.from) + 4, y: 40 + CGFloat(p.lane) * monthLanePoints)
                        }
                    }
                    .frame(width: D.screen.width, height: D.weekRow, alignment: .topLeading)
                }
                .offset(y: D.headerHeight + CGFloat(w) * D.weekRow)
            }
            piece(dissolveAfter: last) {
                Color.clear.frame(width: D.screen.width, height: max(0, D.screen.height - D.headerHeight - CGFloat(weeks.count) * D.weekRow))
            }
            .offset(y: D.headerHeight + CGFloat(weeks.count) * D.weekRow)
        }
        .frame(width: D.screen.width, height: D.screen.height, alignment: .topLeading)
        .clipShape(RoundedRectangle(cornerRadius: rounded ? D.screenRadius : 0, style: .continuous))
    }

    private func piece<C: View>(dissolveAfter delay: Double, @ViewBuilder _ content: () -> C) -> some View {
        content()
            .background(paper)
            .opacity(dissolve ? 0 : 1)
            .animation(.easeInOut(duration: 0.6).delay(dissolve ? delay : 0), value: dissolve)
    }
}

/// A pen scribble in a 48 by 16 box, stretched over its frame.
private struct Scribble: Shape {
    let path: String

    func path(in rect: CGRect) -> Path {
        Path(SVGPath.parse(path)).applying(CGAffineTransform(scaleX: rect.width / 48, y: rect.height / 16))
    }
}

/// The friends' paper calendars thrown onto the phone one by one, quicker and
/// quicker, into a messy pile that lies there until they square up (PaperStack).
struct PaperStack: View {
    let thrown: Int
    let landed: Int
    let squared: Bool
    let month: Int64
    let items: [MonthItem]

    var body: some View {
        ZStack {
            ForEach(Array(D.friends.enumerated()), id: \.offset) { k, f in
                if k < thrown {
                    ThrownPaper(k: k, landed: landed, squared: squared) {
                        PaperCalendar(month: month, items: items, who: f.id, title: f.name, color: f.color)
                    }
                    // Only there from its throw, outside the stage: never faded in.
                    .transition(.identity)
                }
            }
        }
        .frame(width: D.screen.width, height: D.screen.height)
    }
}

/// One paper calendar flying in from outside the phone to land crooked on
/// the pile, a little past its spot and back; knocked by later ones; squared,
/// straight and exactly over the screen.
private struct ThrownPaper<Content: View>: View {
    let k: Int
    let landed: Int
    let squared: Bool
    @ViewBuilder let content: () -> Content

    @State private var thrown = false

    private struct Pose {
        var x: Double = 0
        var y: Double = -90
        var rotate: Double = 0
        var scale: Double = 1.24
    }

    var body: some View {
        let side: Double = k % 2 == 0 ? 1 : -1
        let fly = D.throwsAt[k].fly
        let lie = sheetTilt(k + 1)
        let tilt = (rotate: lie.rotate * 0.8, x: lie.x * 1.6, y: lie.y)
        let from = side * Double(D.screen.width) * 1.75
        let knock = jostle(k, landed)
        content()
            .clipShape(RoundedRectangle(cornerRadius: squared ? D.screenRadius : 10, style: .continuous))
            .shadow(color: .black.opacity(0.42), radius: 20, y: 18)
            .rotationEffect(.degrees(squared ? 0 : knock.rotate))
            .offset(x: squared ? 0 : knock.x)
            .animation(.interpolatingSpring(stiffness: 300, damping: 20), value: landed)
            .keyframeAnimator(initialValue: Pose(x: from, rotate: side * 16), trigger: thrown) { view, pose in
                view
                    .scaleEffect(squared ? 1 : pose.scale)
                    .rotationEffect(.degrees(squared ? 0 : pose.rotate))
                    .offset(x: squared ? 0 : pose.x, y: squared ? 0 : pose.y)
            } keyframes: { _ in
                let total = fly + D.hit
                let a = fly
                let b = (total - fly) * 0.5
                // FLIGHT_EASE: slow off the hand, fast through the air, slow into the
                // landing; then a little past its spot and back.
                let fling = UnitCurve.bezier(startControlPoint: UnitPoint(x: 0.55, y: 0), endControlPoint: UnitPoint(x: 0.15, y: 1))
                KeyframeTrack(\.x) {
                    LinearKeyframe(from, duration: 0)
                    LinearKeyframe(tilt.x - side * 12, duration: a, timingCurve: fling)
                    LinearKeyframe(tilt.x + side * 3, duration: b, timingCurve: .easeOut)
                    LinearKeyframe(tilt.x, duration: b, timingCurve: .easeInOut)
                }
                KeyframeTrack(\.y) {
                    LinearKeyframe(-90, duration: 0)
                    LinearKeyframe(tilt.y + 7, duration: a, timingCurve: fling)
                    LinearKeyframe(tilt.y - 4, duration: b, timingCurve: .easeOut)
                    LinearKeyframe(tilt.y, duration: b, timingCurve: .easeInOut)
                }
                KeyframeTrack(\.rotate) {
                    LinearKeyframe(side * 16, duration: 0)
                    LinearKeyframe(tilt.rotate - side * 2, duration: a, timingCurve: fling)
                    LinearKeyframe(tilt.rotate + side * 0.5, duration: b, timingCurve: .easeOut)
                    LinearKeyframe(tilt.rotate, duration: b, timingCurve: .easeInOut)
                }
                KeyframeTrack(\.scale) {
                    LinearKeyframe(1.24, duration: 0)
                    LinearKeyframe(0.98, duration: a, timingCurve: fling)
                    LinearKeyframe(1.008, duration: b, timingCurve: .easeOut)
                    LinearKeyframe(1, duration: b, timingCurve: .easeInOut)
                }
            }
            .animation(.interpolatingSpring(stiffness: 240, damping: 28), value: squared)
            .onAppear { thrown = true }
    }
}
