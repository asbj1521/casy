import CasyAPI
import CasyCore
import CasyUI
import SwiftUI
import UIKit

/// The events decided since this phone last looked (the web's useHomeVotes,
/// #172): each is said once, over the month, then flies into its day. On a
/// first visit everything already decided counts as seen.
@MainActor
enum AgreedSeen {
    private static let key = "casy-decided-seen"
    /// The test's agreed date has landed in this run: said once, as any other.
    private static var testLanded = false

    static func read() -> Set<String>? {
        guard let ids = UserDefaults.standard.stringArray(forKey: key) else { return nil }
        var seen = Set(ids)
        #if DEBUG
            // A test's agreed date is said however often it has been seen.
            if let fresh = TestLaunch.agreed, !testLanded { seen.remove(fresh) }
        #endif
        return seen
    }

    static func write(_ seen: Set<String>) {
        UserDefaults.standard.set(Array(seen), forKey: key)
    }

    /// The next one to say: decided, still to come, not seen here, soonest first.
    static func next(_ events: [SuggestedEvent]) -> SuggestedEvent? {
        let decided = sectionEvents(events, now: Native.now).scheduled
        var seen = read()
        if seen == nil {
            // Remembered whole, so a test's agreed date never leaks into later runs.
            var all = Set(decided.map(\.id))
            write(all)
            #if DEBUG
                if let fresh = TestLaunch.agreed { all.remove(fresh) }
            #endif
            seen = all
        }
        return decided.first { !(seen ?? []).contains($0.id) && $0.currentDate != nil }
    }

    static func mark(_ id: String) {
        testLanded = true
        var seen = read() ?? []
        seen.insert(id)
        write(seen)
    }
}

/// A date the group has agreed on, said before it flies into its day (the
/// web's AgreedCard, #172): the month blurred behind a glass card in the
/// middle of the screen, "ALLE HAR SVARET", the event and its date, who is
/// coming, Tilføj til min kalender and, once there is a primary calendar,
/// Tilføj automatisk. "Se den i kalenderen" closes it, with where the date
/// stood for its flight. A card in the middle on purpose: a moment of its own.
struct AgreedCard: View {
    let event: SuggestedEvent
    let done: (CGRect) -> Void

    @State private var shown = false
    @State private var dateFrame: CGRect = .zero
    @State private var savingAutoAdd = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var scheme
    private let calendars = CalendarsModel.shared

    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    var body: some View {
        let date = event.currentDate
        let headline = date.map {
            formatHeadline(
                event.settings.kind, vacationDays: event.settings.days ?? 0, start: $0.start, end: $0.end, lang,
                CasyStrings.headlineWords)
        }
        let going = event.invitees.filter { $0.response != .declined }
        ZStack {
            // bg-black/25 with the month blurred behind it.
            Rectangle().fill(.ultraThinMaterial).ignoresSafeArea()
            // Apple's thinnest blur is lighter than the web's in dark: darkened to match.
            Color.black.opacity(scheme == .dark ? 0.5 : 0.25).ignoresSafeArea()
            VStack(alignment: .leading, spacing: 0) {
                Text(CasyStrings.agreedEveryone.uppercased())
                    .accessibilityLabel(CasyStrings.agreedEveryone)
                    .font(.system(size: 12, weight: .bold))
                    .tracking(0.3)
                    .foregroundStyle(Theme.primary.color)
                    .frame(height: 16)
                Text(verbatim: CasyStrings.eventTitle(event.title))
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Theme.foreground.color)
                    .cssLineHeight(25.5, size: 17)
                    .padding(.top, 4)
                if let headline {
                    Text(verbatim: headline.lines.joined(separator: " "))
                        .font(.system(size: 28, weight: .heavy))
                        .tracking(-0.7)
                        .foregroundStyle(Theme.foreground.color)
                        .cssLineHeight(30.8, size: 28)
                        .fixedSize(horizontal: false, vertical: true)
                        .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { dateFrame = $0 }
                        .padding(.top, 4)
                    Text(verbatim: headline.time)
                        .font(.system(size: 17))
                        .foregroundStyle(Theme.foreground.color)
                        .cssLineHeight(25.5, size: 17)
                        .padding(.top, 4)
                }
                HStack(spacing: -8) {
                    ForEach(Array(going.enumerated()), id: \.element.profileId) { i, p in
                        Avatar(name: p.name, index: i, size: .small, url: p.avatarUrl.flatMap(URL.init(string:)))
                            .padding(2)
                            .background(Circle().fill(Theme.card.color))
                            .padding(-2)
                    }
                }
                .padding(.top, 12)
                AddToCalendar(event: event)
                    .padding(.horizontal, -16)
                    .padding(.bottom, -8)
                    .padding(.top, 16)
                if let primary = calendars.primary {
                    CardList(spaced: false) {
                        CardRow(CasyStrings.primaryAutoAdd, detail: CasyStrings.primaryAutoAddHelp, wrap: true) {
                            EmptyView()
                        } trailing: {
                            Toggle(
                                CasyStrings.primaryAutoAdd,
                                isOn: Binding(get: { primary.autoAdd }, set: { setAutoAdd($0) })
                            )
                            .labelsHidden()
                            .tint(Theme.primary.color)
                            .disabled(savingAutoAdd)
                        }
                        .accessibilityElement(children: .contain)
                    }
                    .padding(.top, 12)
                }
                FlowButton(kind: .quiet, action: { done(dateFrame) }) { Text(CasyStrings.agreedShow) }
                    .accessibilityIdentifier("agreed.show")
                    .padding(.top, 16)
            }
            .padding(20)
            .frame(maxWidth: 384, alignment: .leading)
            .background { StillGlass(shape: RoundedRectangle(cornerRadius: 28, style: .continuous)) }
            .padding(.horizontal, 20)
            // Spring in: from 85 %, 24 lower, faded (stiffness 380, damping 26).
            .scaleEffect(shown || reduceMotion ? 1 : 0.85)
            .offset(y: shown || reduceMotion ? 0 : 24)
            .opacity(shown ? 1 : 0)
        }
        .opacity(shown ? 1 : 0)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("agreed.card")
        .accessibilityAddTraits(.isModal)
        .task { if !calendars.primaryKnown { await calendars.loadAccounts() } }
        .onAppear {
            withAnimation(.interpolatingSpring(stiffness: 380, damping: 26)) { shown = true }
        }
    }

    private func setAutoAdd(_ on: Bool) {
        savingAutoAdd = true
        Task {
            defer { savingAutoAdd = false }
            try? await calendars.setAutoAdd(on)
        }
    }
}

/// Glass that doesn't answer a touch itself, for a card of buttons: the
/// interactive kind took the buttons' taps.
private struct StillGlass<S: Shape>: View {
    let shape: S

    var body: some View {
        if #available(iOS 26, *) {
            Color.clear.glassEffect(.regular, in: shape)
        } else {
            shape.fill(.regularMaterial)
        }
    }
}

// MARK: - The flight

/// The date flying into its day (the web's flyIntoDay): a chip the size and
/// colour of the month's own, with the event's title, starts three times as
/// big where the date stood on the card and arcs down into its day over a
/// second, landing with a little overshoot; then a ring spreads from the
/// day's number, with a thud and a tick of success.
struct DateFlight: Identifiable, Equatable {
    let id = UUID()
    let label: String
    let from: CGRect
    /// The day's cell on the month.
    let cell: CGRect
}

struct FlyingDate: View {
    let flight: DateFlight
    let landed: () -> Void

    @Environment(\.colorScheme) private var scheme
    @State private var run = false
    @State private var ring = false

    /// Where the month draws a day's first chip: under its number.
    private var to: CGRect {
        CGRect(x: flight.cell.minX + 2, y: flight.cell.minY + 40, width: flight.cell.width - 4, height: 17)
    }

    private struct Pose {
        var x: CGFloat
        var y: CGFloat
        var scale: CGFloat = 3
        var opacity: Double = 0
    }

    var body: some View {
        let dx = flight.from.midX - to.midX
        let dy = flight.from.midY - to.midY
        let lift = min(160, abs(dy) / 2.5)
        let rgb = casyRGB
        ZStack(alignment: .topLeading) {
            Text(verbatim: flight.label)
                .font(.system(size: 11, weight: .semibold))
                .lineLimit(1)
                .truncationMode(.tail)
                .padding(.horizontal, 4)
                .frame(width: to.width, height: to.height, alignment: .leading)
                .foregroundStyle(Color(rgb: CasyCore.shade(rgb, dark: scheme == .dark)))
                .background(Color(rgb: CasyCore.tint(rgb, dark: scheme == .dark)), in: RoundedRectangle(cornerRadius: 4))
                .shadow(color: .black.opacity(0.35), radius: 15, y: 10)
                .keyframeAnimator(initialValue: Pose(x: dx, y: dy), trigger: run) { chip, pose in
                    chip.scaleEffect(pose.scale).offset(x: pose.x, y: pose.y).opacity(pose.opacity)
                } keyframes: { _ in
                    // The web's offsets on its eased second, as times.
                    KeyframeTrack(\.opacity) {
                        LinearKeyframe(1, duration: 0.04)
                        LinearKeyframe(1, duration: 0.96)
                    }
                    KeyframeTrack(\.x) {
                        LinearKeyframe(dx, duration: 0.04)
                        CubicKeyframe(dx * 0.4, duration: 0.16)
                        CubicKeyframe(0, duration: 0.25)
                        LinearKeyframe(0, duration: 0.55)
                    }
                    KeyframeTrack(\.y) {
                        LinearKeyframe(dy, duration: 0.04)
                        CubicKeyframe(dy * 0.4 - lift, duration: 0.16)
                        CubicKeyframe(0, duration: 0.25)
                        LinearKeyframe(0, duration: 0.55)
                    }
                    KeyframeTrack(\.scale) {
                        LinearKeyframe(3, duration: 0.04)
                        CubicKeyframe(1.8, duration: 0.16)
                        CubicKeyframe(0.82, duration: 0.25)
                        CubicKeyframe(1.12, duration: 0.15)
                        CubicKeyframe(1, duration: 0.4)
                    }
                }
                .offset(x: to.minX, y: to.minY)
            // The ring spreading from the day's number as it lands.
            Circle()
                .strokeBorder(Color(rgb: CasyCore.shade(rgb, dark: scheme == .dark)), lineWidth: 3)
                .frame(width: 32, height: 32)
                .scaleEffect(ring ? 3.2 : 1)
                .opacity(ring ? 0 : 0.9)
                .offset(x: flight.cell.midX - 16, y: flight.cell.minY + 20 - 16)
                .opacity(ring ? 1 : 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .ignoresSafeArea()
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .task {
            run = true
            try? await Task.sleep(for: .milliseconds(1000))
            UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
            withAnimation(.timingCurve(0.2, 0.8, 0.2, 1, duration: 0.7)) { ring = true }
            landed()
            try? await Task.sleep(for: .milliseconds(120))
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        }
    }

    /// Casy's orange, as the month's calendar colours are written (CASY_RGB).
    private var casyRGB: String { "234, 88, 12" }
}

// MARK: - The confetti

/// A burst of confetti for the moment a date lands (the web's Celebration):
/// 36 pieces of Casy's colours from a third of the way down the screen, up
/// and out, then falling a little, as paper does, over 1.6 s. Nothing with
/// Reduce Motion: the words say it.
struct Celebration: View {
    private struct Piece {
        let x: CGFloat
        let y: CGFloat
        let rotate: Double
        let delay: Double
        let color: Color
        let round: Bool
    }

    private static let colors: [Color] = [
        Color(red: 233 / 255, green: 86 / 255, blue: 12 / 255),
        Color(red: 53 / 255, green: 151 / 255, blue: 102 / 255),
        Color(red: 245 / 255, green: 159 / 255, blue: 10 / 255),
        Color(red: 13 / 255, green: 162 / 255, blue: 231 / 255),
    ]

    @State private var pieces: [Piece] = (0..<36).map { i in
        let angle = Double(i) / 36 * .pi * 2 + Double.random(in: 0..<0.4)
        let distance = 120 + Double.random(in: 0..<160)
        return Piece(
            x: cos(angle) * distance, y: sin(angle) * distance * 0.7 + 140,
            rotate: Double.random(in: -360..<360), delay: Double.random(in: 0..<0.12),
            color: colors[i % colors.count], round: i % 3 == 0)
    }
    @State private var flying = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { box in
            if !reduceMotion {
                ZStack {
                    ForEach(Array(pieces.enumerated()), id: \.offset) { _, p in
                        RoundedRectangle(cornerRadius: p.round ? 4 : 2)
                            .fill(p.color)
                            .frame(width: p.round ? 8 : 6, height: p.round ? 8 : 12)
                            .scaleEffect(flying ? 1 : 0.6)
                            .rotationEffect(.degrees(flying ? p.rotate : 0))
                            .offset(x: flying ? p.x : 0, y: flying ? p.y : 0)
                            .opacity(flying ? 0 : 1)
                            .animation(.timingCurve(0.15, 0.7, 0.4, 1, duration: 1.6).delay(p.delay), value: flying)
                    }
                }
                .position(x: box.size.width / 2, y: box.size.height / 3)
            }
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .onAppear { flying = true }
    }
}
