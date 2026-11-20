import CasyAPI
import CasyCore
import CasyUI
import SwiftUI
import UIKit

/// What formatHeadline puts under a date: "19:00 til 22:00", a trip's times, a holiday's days.
extension CasyStrings {
    static var headlineWords: HeadlineWords {
        HeadlineWords(
            timeRange: { CasyStrings.timeRange($0, $1) },
            tripTimes: { CasyStrings.tripTimes($0, $1) },
            days: { days($0) })
    }
}

/// What the day view under a vote's card shows of it (the web's VoteView,
/// #176): the vote's dates, the one on screen lit, your answers stamped on
/// them, and how much of the screen the card covers along the bottom.
struct VoteView: Equatable {
    struct Slot: Equatable {
        let id: String
        let start: Int64
        let end: Int64
    }

    let eventId: String
    let label: String
    let dates: [Slot]
    var current: Slot?
    var answers: [String: EventResponse]
    var clear: CGFloat
}

/// Which way a card leaves: its answer, or back to a date before.
enum CardExit: Equatable {
    case answer(EventResponse)
    case back
}

/// Answering a vote's dates one at a time (#74), the web's useVoteDeck: each
/// answer is saved as it is given, and the next date doesn't wait for it; a
/// failed save takes it back and says so (`error`). Back steps to a date
/// before, to change an answer. A no to the date already decided moves it for
/// everyone, so it is asked first (`confirmMove`), as is a yes to a date that
/// runs into something critical of yours (`confirmClash`, #114).
@MainActor @Observable
final class VoteDeck {
    let eventId: String
    /// One "now" for the whole visit, so a date beginning mid-swipe doesn't
    /// reshuffle the stack under the thumb.
    let now: Int64
    let dates: [CandidateDate]
    private let opened: SuggestedEvent
    /// Answers given here, shown before (and regardless of) the server's reply.
    private(set) var given: [String: EventResponse] = [:]
    private(set) var index: Int
    private(set) var exit: CardExit = .answer(.accepted)
    private(set) var error: String?
    var confirmMove = false
    /// A yes (or maybe) to a date that runs into something critical of yours,
    /// waiting for its "Ja alligevel".
    var confirmClash: EventResponse?
    /// The warning whose event is said ("Vis mig"), by its key.
    var shownClash: String?
    /// How to swipe is said until this phone's first answer, then never again (#161).
    let hintSeen: Bool
    /// Opened on a vote already answered (Aftaler's row, a push): from its
    /// first date, to look again or change an answer, and no thanks after.
    let startedDone: Bool
    private var saving: Task<Void, Never>?

    static let hintKey = "casy-swipe-hint-seen"

    init(_ event: SuggestedEvent, now: Int64 = Native.now) {
        eventId = event.id
        opened = event
        self.now = now
        let dates = upcomingDates(event, now: now)
        self.dates = dates
        var seen = UserDefaults.standard.bool(forKey: Self.hintKey)
        #if DEBUG
            // A test starts as a first visit, as the web's does with its storage empty.
            if TestLaunch.isActive { seen = false }
        #endif
        hintSeen = seen
        let first = firstUnanswered(event, now: now)
        let open = event.status == .pending || event.status == .scheduled
        startedDone = (first == -1 || !open) && !dates.isEmpty
        index = startedDone ? 0 : (first == -1 ? dates.count : first)
    }

    /// The vote as it is now, the server's latest.
    var event: SuggestedEvent { EventsModel.shared.events?.first { $0.id == eventId } ?? opened }

    private var you: String? { event.invitees.first { $0.isYou }?.profileId }

    /// Nothing answered yet on this visit.
    var givenNone: Bool { given.isEmpty }

    func answerOf(_ date: CandidateDate) -> EventResponse? {
        given[date.id] ?? you.flatMap { date.answers[$0] }
    }

    /// Called off (or out of dates) while answering: the cards left can't be
    /// answered any more. A decided vote can still be: a change of heart about
    /// its date moves it.
    var done: Bool {
        index >= dates.count || (event.status != .pending && event.status != .scheduled)
    }

    var current: CandidateDate? { done ? nil : dates[index] }

    /// The date as the server has it now, for the faces' answers.
    func latest(_ date: CandidateDate) -> CandidateDate {
        event.candidates.first { $0.id == date.id } ?? date
    }

    /// What the date runs into among your important events (#114): the
    /// event's profile on that date against the page's labelled events.
    func clashes(_ date: CandidateDate) -> [ImportantClash] {
        let mine = HomeModel.shared.page.important
        guard !mine.isEmpty else { return [] }
        let impact = impactOn(event.impact, start: date.start, end: date.end, event.settings, appTimeZone)
        return importantClashes(impact, mine, appTimeZone)
    }

    func answer(_ response: EventResponse, confirmed: Bool = false) {
        guard let current else { return }
        let risky = response != .declined && clashes(current).contains { $0.severity == "critical" }
        if risky && !confirmed {
            confirmClash = response
            return
        }
        confirmClash = nil
        UserDefaults.standard.set(true, forKey: Self.hintKey)
        let movesDate =
            event.status == .scheduled && event.currentDate?.id == current.id && response == .declined
        if movesDate && !confirmed {
            confirmMove = true
            return
        }
        confirmMove = false
        shownClash = nil
        error = nil
        exit = .answer(response)
        given[current.id] = response
        index += 1
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        save(current.id, response)
    }

    func back(_ to: Int? = nil) {
        let to = to ?? index - 1
        guard to >= 0 else { return }
        confirmMove = false
        confirmClash = nil
        shownClash = nil
        exit = .back
        index = to
    }

    /// One after another, in the order given, while the cards move on: each
    /// reply is the whole list of events as it stood, and sent side by side an
    /// earlier reply could arrive after a later one and put back an older picture.
    private func save(_ dateId: String, _ response: EventResponse) {
        let before = saving
        saving = Task {
            await before?.value
            do {
                let outcome = try await EventsModel.shared.answer(eventId, dateId: dateId, response)
                if outcome == "scheduled" { UINotificationFeedbackGenerator().notificationOccurred(.success) }
            } catch {
                given[dateId] = nil
                self.error = error.localizedDescription
                await EventsModel.shared.load()
            }
        }
    }

    var view: VoteView {
        VoteView(
            eventId: eventId, label: CasyStrings.eventTitle(event.title),
            dates: dates.map { VoteView.Slot(id: $0.id, start: instantOrZero($0.start), end: instantOrZero($0.end)) },
            current: current.map { VoteView.Slot(id: $0.id, start: instantOrZero($0.start), end: instantOrZero($0.end)) },
            answers: Dictionary(uniqueKeysWithValues: dates.compactMap { d in answerOf(d).map { (d.id, $0) } }),
            clear: 0)
    }
}

// MARK: - The panel

/// Answering a vote on the home page (#172), over the day view (#176), the
/// web's HomeVote: along the bottom on glass, the vote's title and group with
/// back and Færdig, a segment per date, the card and the three answers. After
/// the last answer a short thanks, then back to the month (`close`); Færdig
/// goes back there too, the rest left for later (`later`).
struct HomeVotePanel: View {
    let deck: VoteDeck
    /// Every date answered and the thanks said: back to the month.
    let close: () -> Void
    /// Færdig: back to the month, the vote put away until the app is next opened (#241).
    let later: () -> Void
    /// How much of the screen it covers, for the day view to keep clear.
    let onClear: (CGFloat) -> Void
    /// A finger on the calendar folds it down to the card alone, so the day
    /// is nearly all in sight (the web's `folded`); a tap on the card unfolds it.
    var folded = false
    var onUnfold: () -> Void = {}

    @Environment(\.colorScheme) private var scheme
    /// Cards on their way out, each flying the way it was answered.
    @State private var leaving: [Leaving] = []

    /// How long "Tak" stays before the card goes.
    static let thanks: Duration = .milliseconds(1600)

    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    var body: some View {
        GeometryReader { screen in
            let short = screen.size.height + screen.safeAreaInsets.top + screen.safeAreaInsets.bottom <= 700
            // h-[min(34dvh,14.75rem)], short:h-[11rem].
            let height = short ? 176 : min((screen.size.height + screen.safeAreaInsets.top + screen.safeAreaInsets.bottom) * 0.34, 236)
            let glass = UnevenRoundedRectangle(topLeadingRadius: 28, topTrailingRadius: 28, style: .continuous)
            VStack(spacing: 0) {
                Spacer(minLength: 0)
                panel(cardHeight: height, short: short)
                    .padding(.horizontal, 16)
                    .padding(.top, 12)
                    .padding(.bottom, 8)
                    .background {
                        // The glass behind it all, gone while it is folded down to the card.
                        GeometryReader { box in
                            glass.fill(.clear)
                                .casyGlass(in: glass)
                                .offset(y: isFolded ? box.size.height / 4 : 0)
                                .opacity(isFolded ? 0 : 1)
                        }
                        .ignoresSafeArea(edges: .bottom)
                    }
                    .onGeometryChange(for: CGFloat.self) { $0.size.height + screen.safeAreaInsets.bottom } action: {
                        onClear($0)
                    }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("vote.panel")
        .task(id: deck.done) {
            // All answered: a moment of thanks, then the plain month.
            guard deck.done, !deck.startedDone else { return }
            // The last date answered just now: the moment to offer
            // notifications about the outcome (#139), which the page decides.
            HomeModel.shared.onAction?("answered", nil)
            try? await Task.sleep(for: Self.thanks)
            if !Task.isCancelled { close() }
        }
        .askFirst(
            AskWords(message: CasyStrings.voteMoveConfirm, confirm: CasyStrings.voteMoveYes, cancel: CasyStrings.voteMoveKeep),
            isPresented: Binding(get: { deck.confirmMove }, set: { deck.confirmMove = $0 })
        ) { deck.answer(.declined, confirmed: true) }
        .askFirst(
            AskWords(message: CasyStrings.clashConfirm, confirm: CasyStrings.clashConfirmYes, cancel: CasyStrings.clashConfirmNo),
            isPresented: Binding(get: { deck.confirmClash != nil }, set: { if !$0 { deck.confirmClash = nil } })
        ) { if let response = deck.confirmClash { deck.answer(response, confirmed: true) } }
    }

    /// Folded only while there is a card to swipe and nothing to ask.
    private var isFolded: Bool { folded && !deck.done && !deck.confirmMove && deck.confirmClash == nil }

    @ViewBuilder private func panel(cardHeight: CGFloat, short: Bool) -> some View {
        VStack(spacing: 0) {
            VStack(spacing: 0) {
                titleRow
                segments.padding(.top, 8)
            }
            .collapsed(isFolded)
            if deck.done || deck.current == nil {
                thanks.frame(height: cardHeight)
            } else if let current = deck.current {
                cards(current)
                    .frame(height: cardHeight)
                    .padding(.top, isFolded ? 0 : short ? 8 : 12)
                    // A tap on the folded card, not a swipe, unfolds it.
                    .simultaneousGesture(TapGesture().onEnded { if isFolded { onUnfold() } }, including: isFolded ? .all : .subviews)
                    // Folded, the card alone: still a way to put it away without answering.
                    .overlay(alignment: .topTrailing) {
                        if isFolded {
                            Button(action: later) {
                                Text(CasyStrings.voteLater)
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundStyle(Theme.primary.color)
                                    .padding(.horizontal, 16)
                                    .frame(minHeight: 44)
                                    .casyGlass()
                            }
                            .buttonStyle(.plain)
                            .offset(y: -56)
                            .transition(.opacity)
                            .accessibilityIdentifier("vote.later")
                        }
                    }
                VStack(spacing: 0) {
                    AnswerButtons(tight: short) { deck.answer($0) }
                    if !deck.hintSeen && deck.index == 0 && deck.givenNone {
                        Text(CasyStrings.voteHint)
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.mutedForeground.color)
                            .multilineTextAlignment(.center)
                            .cssLineHeight(16, size: 12)
                            .padding(.horizontal, 8)
                            .padding(.bottom, 4)
                    }
                }
                .collapsed(isFolded)
            }
            if let error = deck.error {
                Notice(error, tone: .error).padding(.top, 4)
            }
        }
    }

    /// The title (17 bold) over the group (13 muted), back (a 20 point
    /// rotate-ccw in amber, 36 round, faded when there is no date before),
    /// Færdig (15 semibold, orange).
    private var titleRow: some View {
        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 0) {
                Text(verbatim: CasyStrings.eventTitle(deck.event.title))
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(Theme.foreground.color)
                    .lineLimit(1)
                    .frame(height: 25.5)
                Text(verbatim: deck.event.group.name)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.mutedForeground.color)
                    .lineLimit(1)
                    .frame(height: 19.5)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Button { withAnimation(.snappy) { deck.back() } } label: {
                LucideIcon("rotate-ccw", size: 20)
                    .foregroundStyle(Theme.amber600.color)
                    .frame(width: 36, height: 36)
                    .contentShape(Circle())
            }
            .disabled(deck.index == 0 || deck.done)
            .opacity(deck.index == 0 || deck.done ? 0.3 : 1)
            .accessibilityLabel(CasyStrings.votePrevious)
            .accessibilityIdentifier("vote.back")
            Button(action: later) {
                Text(CasyStrings.voteDone)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.primary.color)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .contentShape(Rectangle())
            }
            .accessibilityIdentifier("vote.done")
        }
        .buttonStyle(.plain)
    }

    /// One 6 point capsule per date, 4 apart: the one on screen in the text's
    /// colour, answered in its answer's colour, still to come in the secondary.
    private var segments: some View {
        HStack(spacing: 4) {
            ForEach(Array(deck.dates.enumerated()), id: \.element.id) { i, d in
                Button { withAnimation(.snappy) { deck.back(i) } } label: {
                    Capsule()
                        .fill(segmentColor(i, d))
                        .frame(height: 6)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .padding(.vertical, -8)
                .accessibilityLabel(CasyStrings.voteDateOf(i + 1, deck.dates.count))
            }
        }
        .animation(.easeInOut(duration: 0.15), value: deck.index)
    }

    private func segmentColor(_ i: Int, _ d: CandidateDate) -> Color {
        if i == deck.index { return Theme.foreground.color }
        switch deck.answerOf(d) {
        case .accepted: return Theme.emerald500.color
        case .maybe: return Theme.amber400.color
        case .declined: return Theme.rose400.color
        case nil: return Theme.secondary.color
        }
    }

    /// "Tak, du har svaret" (20 bold) and who is still to answer (15 muted).
    private var thanks: some View {
        VStack(spacing: 4) {
            Text(CasyStrings.voteDoneTitle)
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(Theme.foreground.color)
            let waiting = stillToAnswer(deck.event, now: deck.now)
            if !waiting.isEmpty {
                Text(CasyStrings.voteWaitingFor(nameList(waiting, lang)))
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.mutedForeground.color)
            }
        }
        .multilineTextAlignment(.center)
        .padding(.horizontal, 24)
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("vote.thanks")
    }

    /// The next date waiting underneath, so the stack reads as a stack, the
    /// one on top following the thumb, and the ones answered flying off.
    private func cards(_ current: CandidateDate) -> some View {
        let next = deck.index + 1 < deck.dates.count ? deck.dates[deck.index + 1] : nil
        return ZStack {
            if let next {
                face(next, position: deck.index + 2)
                    .offset(y: 8)
                    .scaleEffect(0.96)
                    .opacity(0.6)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }
            SwipeCard(entering: deck.exit) { response, from in
                leaving.append(Leaving(date: current, position: deck.index + 1, exit: .answer(response), from: from))
                deck.answer(response)
            } content: {
                face(current, position: deck.index + 1)
            }
            .id(current.id)
            ForEach(leaving) { card in
                LeavingCard(card: card) { leaving.removeAll { $0.id == card.id } } content: {
                    face(card.date, position: card.position)
                }
            }
        }
        .onChange(of: deck.index) { old, new in
            // Answered by a button: the card flies off the way it was answered.
            if new == old + 1, case .answer(let response) = deck.exit,
                !leaving.contains(where: { $0.date.id == deck.dates[old].id })
            {
                leaving.append(Leaving(date: deck.dates[old], position: old + 1, exit: .answer(response), from: .zero))
            }
        }
    }

    private func face(_ date: CandidateDate, position: Int) -> some View {
        let current = date.id == deck.current?.id
        return VoteCardFace(
            event: deck.event, date: deck.latest(date), position: position, total: deck.dates.count,
            yours: deck.answerOf(date), clashes: deck.clashes(date), shownClash: current ? deck.shownClash : nil,
            onShowClash: current ? { deck.shownClash = $0 } : nil)
    }
}

extension View {
    /// The web's Collapse: grown to its height when open, shrunk away and
    /// faded when not.
    func collapsed(_ shut: Bool) -> some View {
        fixedSize(horizontal: false, vertical: true)
            .frame(height: shut ? 0 : nil, alignment: .top)
            .opacity(shut ? 0 : 1)
            // Clipped only on the way shut: open, the buttons' shadows show.
            .clipShape(Rectangle().inset(by: shut ? 0 : -24))
            .allowsHitTesting(!shut)
            .accessibilityHidden(shut)
    }
}

/// A card answered, on its way off the screen.
struct Leaving: Identifiable {
    let id = UUID()
    let date: CandidateDate
    let position: Int
    let exit: CardExit
    /// Where the thumb let it go.
    let from: CGSize
}

/// SwipeCard's exit: off to the right for a yes, the left for a no, up for
/// rather not, each 0.35 s; with Reduce Motion it only fades.
private struct LeavingCard<Content: View>: View {
    let card: Leaving
    let gone: () -> Void
    @ViewBuilder let content: () -> Content

    @State private var away = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var target: (x: CGFloat, y: CGFloat, rotate: Double) {
        if reduceMotion { return (card.from.width, card.from.height, 0) }
        switch card.exit {
        case .answer(.accepted): return (640, card.from.height, 18)
        case .answer(.declined): return (-640, card.from.height, -18)
        case .answer(.maybe): return (card.from.width, -640, SwipeCard<Content>.tilt(card.from.width))
        case .back: return (0, 0, 0)
        }
    }

    var body: some View {
        let target = self.target
        let start = SwipeCard<Content>.tilt(card.from.width)
        content()
            .offset(x: away ? target.x : card.from.width, y: away ? target.y : card.from.height)
            .rotationEffect(.degrees(away ? target.rotate : start))
            .opacity(away ? 0 : 1)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
            .onAppear {
                withAnimation(.easeOut(duration: reduceMotion ? 0.15 : 0.35)) { away = true } completion: { gone() }
            }
    }
}

/// The card on top, the web's SwipeCard: it follows the thumb and tilts (14°
/// at 240 points), stamped with the answer it is heading for, and a drag past
/// 110 points (with a little of its speed) answers it. It comes in from
/// under the stack (scale 0.96, 8 down, 60 %) on the web's spring.
struct SwipeCard<Content: View>: View {
    let entering: CardExit
    let onAnswer: (EventResponse, CGSize) -> Void
    @ViewBuilder let content: () -> Content

    @State private var drag: CGSize = .zero
    @State private var settled = false
    @State private var heading: EventResponse?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    static var answerAt: CGFloat { 110 }

    static func tilt(_ x: CGFloat) -> Double { Double(max(-240, min(240, x)) / 240 * 14) }

    static func zone(_ x: CGFloat, _ y: CGFloat) -> EventResponse? {
        x > answerAt ? .accepted : x < -answerAt ? .declined : y < -answerAt && abs(x) < answerAt ? .maybe : nil
    }

    /// How much of a stamp shows: from 24 points to the answer's line.
    private func ramp(_ v: CGFloat) -> Double { Double(min(1, max(0, (v - 24) / (Self.answerAt - 24)))) }

    var body: some View {
        content()
            .overlay(alignment: .topLeading) {
                stamp(CasyStrings.voteCan, color: Theme.emerald500.color, text: Theme.emerald600.color)
                    .rotationEffect(.degrees(-12))
                    .padding(.leading, 20).padding(.top, 24)
                    .opacity(ramp(drag.width))
            }
            .overlay(alignment: .topTrailing) {
                stamp(CasyStrings.voteCant, color: Theme.rose500.color, text: Theme.rose600.color)
                    .rotationEffect(.degrees(12))
                    .padding(.trailing, 20).padding(.top, 24)
                    .opacity(ramp(-drag.width))
            }
            .overlay(alignment: .bottom) {
                stamp(CasyStrings.voteRather, color: Theme.amber500.color, text: Theme.amber600.color)
                    .padding(.bottom, 24)
                    .opacity(ramp(-drag.height))
            }
            .offset(drag)
            .rotationEffect(.degrees(reduceMotion ? 0 : Self.tilt(drag.width)))
            .scaleEffect(settled ? 1 : 0.96)
            .offset(y: settled ? 0 : 8)
            .opacity(settled ? 1 : 0.6)
            .gesture(
                DragGesture(minimumDistance: 4)
                    .onChanged { value in
                        // The web's dragElastic: 0.85, loosely under the thumb.
                        drag = CGSize(width: value.translation.width * 0.85, height: value.translation.height * 0.85)
                        let now = Self.zone(drag.width, drag.height)
                        if let now, now != heading { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
                        heading = now
                    }
                    .onEnded { value in
                        heading = nil
                        // A flick counts as much as a long drag.
                        let answer = Self.zone(
                            drag.width + value.velocity.width * 0.15, drag.height + value.velocity.height * 0.15)
                        if let answer {
                            onAnswer(answer, drag)
                        } else {
                            withAnimation(Self.spring) { drag = .zero }
                        }
                    }
            )
            .onAppear {
                if entering == .back || reduceMotion {
                    withAnimation(.easeOut(duration: 0.15)) { settled = true }
                } else {
                    withAnimation(Self.spring) { settled = true }
                }
            }
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("vote.card")
    }

    /// The web's spring: damping 26, stiffness 300.
    static var spring: Animation { .interpolatingSpring(stiffness: 300, damping: 26) }

    /// 24 extrabold, uppercase, tracked, in a 3 point ring rounded 8.
    private func stamp(_ word: String, color: Color, text: Color) -> some View {
        Text(verbatim: word.uppercased())
            .font(.system(size: 24, weight: .heavy))
            .tracking(0.6)
            .foregroundStyle(text)
            .padding(.horizontal, 8)
            .padding(.vertical, 2)
            .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(color, lineWidth: 3))
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }
}

/// The three answers as buttons, the web's AnswerButtons: can't (64, rose),
/// rather not (48, 8 lower, amber), can (64, emerald), each round on the
/// card's colour with a 2 point ring and a shadow, its word under it (11
/// medium, muted), 24 apart, 12 above and under; smaller on a short phone.
struct AnswerButtons: View {
    var tight = false
    let onAnswer: (EventResponse) -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 24) {
            button(.declined, icon: "x", size: tight ? 56 : 64, iconSize: 32, ring: Theme.rose200.color,
                   tone: Theme.rose600.color, word: CasyStrings.voteCant)
            button(.maybe, icon: "face-neutral", size: tight ? 44 : 48, iconSize: 24, ring: Theme.amber200.color,
                   tone: Theme.amber600.color, word: CasyStrings.voteRather)
                .padding(.top, tight ? 4 : 8)
            button(.accepted, icon: "check", size: tight ? 56 : 64, iconSize: 32, ring: Theme.emerald200.color,
                   tone: Theme.emerald600.color, word: CasyStrings.voteCan)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, tight ? 8 : 12)
    }

    private func button(
        _ response: EventResponse, icon: String, size: CGFloat, iconSize: CGFloat, ring: Color, tone: Color, word: String
    ) -> some View {
        VStack(spacing: 4) {
            Button { onAnswer(response) } label: {
                LucideIcon(icon, size: iconSize, stroke: 2.5)
                    .foregroundStyle(tone)
                    .frame(width: size, height: size)
                    .background(Circle().fill(Theme.card.color))
                    .overlay(Circle().strokeBorder(ring, lineWidth: 2))
                    .compositingGroup()
                    .shadow(color: .black.opacity(0.1), radius: 3, y: 3)
                    .contentShape(Circle())
            }
            .buttonStyle(AnswerPress())
            .accessibilityLabel(CasyStrings.voteAnswerLong(response.rawValue))
            .accessibilityIdentifier("vote.\(response.rawValue)")
            Text(word)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Theme.mutedForeground.color)
                .accessibilityHidden(true)
        }
    }
}

/// `active:scale-90`.
private struct AnswerPress: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.9 : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

// MARK: - The card

/// What a card says, the web's CardFace in its compact form: "DATO 1 AF 3"
/// (12 bold, uppercase, orange) with how well it suits the group, the date
/// (22 extrabold, tight), the time and how soon, what you have then, the
/// place and note; along the bottom what you answered and one line of the
/// others' faces, each with their answer as a badge. A card rounded 24 with
/// a 1 point border and a soft shadow, 16 inside.
struct VoteCardFace: View {
    let event: SuggestedEvent
    let date: CandidateDate
    let position: Int
    let total: Int
    let yours: EventResponse?
    /// What the date runs into among your important events (#114).
    var clashes: [ImportantClash] = []
    /// The warning whose event is said, by its key.
    var shownClash: String?
    /// "Vis mig" on the card in front only.
    var onShowClash: ((String?) -> Void)?

    /// How many faces fit their one line, before "+n".
    private static let faces = 7
    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    var body: some View {
        let headline = formatHeadline(
            event.settings.kind, vacationDays: event.settings.days ?? 0, start: date.start, end: date.end, lang,
            CasyStrings.headlineWords)
        let others = event.invitees.filter { !$0.isYou }
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Text(CasyStrings.voteDateOf(position, total).uppercased())
                    .accessibilityLabel(CasyStrings.voteDateOf(position, total))
                    .font(.system(size: 12, weight: .bold))
                    .tracking(0.3)
                    .foregroundStyle(Theme.primary.color)
                    .frame(height: 16)
                Spacer(minLength: 0)
                if let score = date.matchScore { match(Int(score.rounded())) }
            }
            Text(verbatim: headline.lines.joined(separator: " "))
                .font(.system(size: 22, weight: .heavy))
                .tracking(-0.55)
                .foregroundStyle(Theme.foreground.color)
                .cssLineHeight(24.2, size: 22)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 4)
            // In the card's fixed height whatever doesn't fit is cut off here,
            // so the faces always stay inside the card (#214).
            VStack(alignment: .leading, spacing: 0) {
                Text(verbatim: headline.time)
                    .font(.system(size: 17))
                    .foregroundStyle(Theme.foreground.color)
                    .cssLineHeight(25.5, size: 17)
                if let mine = yourTime(
                    event.settings.kind, start: date.start, end: date.end, lang, viewerZone: TimeZone.current.identifier)
                {
                    Text(CasyStrings.timeZoneYours(mine))
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.mutedForeground.color)
                }
                Text(CasyStrings.inDays(daysAway))
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.mutedForeground.color)
                    .cssLineHeight(20, size: 14)
                if let clash = HomeModel.shared.clash(start: instantOrZero(date.start), end: instantOrZero(date.end)) {
                    Text(CasyStrings.voteClash(clash.what, more: clash.more))
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Theme.rose700.color)
                        .cssLineHeight(20, size: 14)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 8)
                }
                ImportantClashLines(clashes: clashes, shown: shownClash, onShow: onShowClash)
                    .padding(.top, clashes.isEmpty ? 0 : 8)
                if event.place != nil || event.note != nil {
                    PlaceNoteView(event: event).padding(.top, 8)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .clipped()
            VStack(alignment: .leading, spacing: 0) {
                if let yours {
                    Text(CasyStrings.voteYouAnswered(CasyStrings.voteAnswerWord(yours.rawValue)))
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.foreground.color)
                        .cssLineHeight(20, size: 14)
                        .padding(.bottom, 8)
                }
                if !others.isEmpty {
                    HStack(spacing: 6) {
                        ForEach(Array(others.prefix(Self.faces).enumerated()), id: \.element.profileId) { i, p in
                            face(p, index: i + 1)
                        }
                        if others.count > Self.faces {
                            Text(verbatim: "+\(others.count - Self.faces)")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(Theme.mutedForeground.color)
                        }
                    }
                }
            }
            .padding(.top, 12)
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(RoundedRectangle(cornerRadius: 24, style: .continuous).fill(Theme.card.color))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).strokeBorder(Theme.border.color, lineWidth: 1))
        .compositingGroup()
        .shadow(color: .black.opacity(0.1), radius: 12, y: 10)
    }

    /// Days from today to the date's day, as the web's daysUntil.
    private var daysAway: Int {
        let today = localDate(startOfDay(Native.now, appTimeZone), appTimeZone)
        let day = localDate(startOfDay(instantOrZero(date.start), appTimeZone), appTimeZone)
        let a = DateComponents(calendar: Calendar(identifier: .gregorian), year: today.year, month: today.month + 1, day: today.day)
        let b = DateComponents(calendar: Calendar(identifier: .gregorian), year: day.year, month: day.month + 1, day: day.day)
        return Calendar(identifier: .gregorian).dateComponents([.day], from: a, to: b).day ?? 0
    }

    /// "Passer 90%": emerald from 85, amber from 60, else rose; 12 semibold.
    private func match(_ score: Int) -> some View {
        let (fill, text): (Color, Color) =
            score >= 85
            ? (Theme.emerald100.color, Theme.emerald800.color)
            : score >= 60 ? (Theme.amber100.color, Theme.amber800.color) : (Theme.rose100.color, Theme.rose800.color)
        return Text(CasyStrings.voteMatchScore(score))
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(text)
            .padding(.horizontal, 8)
            .padding(.vertical, 2)
            .background(fill, in: Capsule())
    }

    /// A 32 point face, faded until they answer, their answer as a 14 point
    /// badge in its colour at the corner with a 2 point ring of the card's.
    private func face(_ person: EventInvitee, index: Int) -> some View {
        let answer = date.answers[person.profileId]
        return Avatar(name: person.name, index: index, size: .medium, url: person.avatarUrl.flatMap(URL.init(string:)))
            .opacity(answer == nil ? 0.5 : 1)
            .overlay(alignment: .bottomTrailing) {
                AnswerBadge(answer: answer, size: 14)
                    .offset(x: 2, y: 2)
                    .opacity(answer == nil ? 0.5 : 1)
            }
            .accessibilityElement()
            .accessibilityLabel("\(person.name): \(CasyStrings.eventsAnswered(answer?.rawValue ?? "none"))")
    }
}

/// An answer as a round badge in its colour, the web's STAMP_TONE with
/// AnswerIcon in white: a check, a face, a cross, or a clock for none yet.
struct AnswerBadge: View {
    let answer: EventResponse?
    var size: CGFloat = 20
    var ring = true

    var body: some View {
        let (icon, fill): (String, Color) =
            switch answer {
            case .accepted: ("check", Theme.emerald500.color)
            case .maybe: ("face-neutral", Theme.amber400.color)
            case .declined: ("x", Theme.rose500.color)
            case nil: ("clock", Theme.zinc400.color)
            }
        ZStack {
            Circle().fill(fill)
            if ring { Circle().strokeBorder(Theme.card.color, lineWidth: 2).padding(-2) }
            LucideIcon(icon, size: size * (size <= 14 ? 10.0 / 14 : 0.6))
                .foregroundStyle(.white)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// What a date runs into among your important events (#114, the web's
/// ImportantClashes): said vaguely ("Det ligner, at du har en eksamen dagen
/// efter: ..."), critical in red, the rest in amber, the strongest two. "Vis
/// mig" says which event and when. Your own event, read on this phone;
/// nothing anyone else sees.
struct ImportantClashLines: View {
    let clashes: [ImportantClash]
    var shown: String?
    var onShow: ((String?) -> Void)?

    private static let most = 2
    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    var body: some View {
        if !clashes.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                // While one is said, it is the only one: a card has little room.
                ForEach(clashes.prefix(Self.most).filter { shown == nil || $0.key == shown }, id: \.key) { c in
                    line(c)
                }
            }
            .accessibilityIdentifier("vote.clashes")
        }
    }

    private func line(_ c: ImportantClash) -> some View {
        let open = shown == c.key
        let color = c.severity == "critical" ? Theme.red700.color : Theme.amber800.color
        var text = AttributedString(sentence(c))
        if onShow != nil {
            var link = AttributedString(open ? CasyStrings.clashHide : CasyStrings.clashShow)
            link.font = .system(size: 14, weight: .semibold)
            link.underlineStyle = .single
            text += AttributedString(" ") + link
        }
        let time = c.event.allDay ? nil : formatTime(isoString(c.event.start))
        return VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .top, spacing: 6) {
                LucideIcon("triangle-alert", size: 16).padding(.top, 2)
                Text(text)
                    .font(.system(size: 14, weight: .medium))
                    .cssLineHeight(20, size: 14)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .foregroundStyle(color)
            .contentShape(Rectangle())
            .onTapGesture { onShow?(open ? nil : c.key) }
            .accessibilityAction(named: open ? CasyStrings.clashHide : CasyStrings.clashShow) {
                onShow?(open ? nil : c.key)
            }
            if open {
                Text(CasyStrings.clashDetail(c.event.title, day: dayLabel(c.event.start, lang), time: time))
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.foreground.color)
                    .padding(.leading, 22)
                    .transition(.opacity)
            }
        }
        .animation(.easeOut(duration: 0.2), value: open)
    }

    /// The web's clashSentence.
    private func sentence(_ c: ImportantClash) -> String {
        let avoid = c.avoid.map(CasyStrings.clashAvoid)
        let list =
            avoid.count <= 1
            ? (avoid.first ?? "") : "\(avoid.dropLast().joined(separator: ", ")) \(CasyStrings.clashAnd) \(avoid.last!)"
        return CasyStrings.clashSentence(
            c.kind, what: CasyStrings.clashKind(c.event.label.kind), when: CasyStrings.clashWhen(c.daysAfter), avoid: list)
    }
}
