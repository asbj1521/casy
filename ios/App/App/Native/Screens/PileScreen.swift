import CasyAPI
import CasyCore
import CasyUI
import SwiftUI
import UIKit

/// One date in the list, with what was checked about it (the web's CheckedDate).
struct CheckedDate: Identifiable, Equatable {
    var id: String { date.slot.start }
    let date: FoundDate
    /// Its local day: the green circle it comes out of.
    let day: Int64
    let chosen: Bool
    /// What was checked and found, in order; `notable` when it counts against the date.
    let checks: [(found: String, notable: Bool)]
    let facts: RankedFacts

    static func == (a: CheckedDate, b: CheckedDate) -> Bool {
        a.id == b.id && a.chosen == b.chosen && a.facts == b.facts && a.checks.map(\.found) == b.checks.map(\.found)
    }
}

/// A friend's calendar on the pile: its busy time as bars in their colour, no words.
struct PileFriend: Identifiable, Equatable {
    var id: String { profileId }
    let profileId: String
    let name: String
    let color: String
    let items: [MonthItem]
    /// Searched before (a vote searched again, #240): on the pile already,
    /// under the ones thrown now.
    var placed = false
    /// The month laid out with these items, once (PileMonth.weeks): not again on every redraw.
    var weeks: [HomeWeek] = []
}

/// What the pile shows: the month (the first date's), the months the list
/// reaches into, the days free for everyone, and whose calendars are thrown.
struct PileLayers: Equatable {
    let month: Int64
    let months: [Int64]
    let shine: Set<Int64>
    let friends: [PileFriend]
    let yours: [MonthItem]
    /// Your month and an empty one, laid out once, as each friend's is.
    var yourWeeks: [HomeWeek] = []
    var emptyWeeks: [HomeWeek] = []
    /// The month as My calendar draws it (HomeModel): your events in their calendars'
    /// colours with their names, the vote's dates, today. The web throws the
    /// calendars onto the home page's own month; nil when it isn't there to borrow.
    var homeWeeks: [HomeWeek]?
    /// Every month the list reaches into, with everyone's busy time together (the web's
    /// SharedCalendar): what the pile becomes as the dates are lifted out of it.
    var sharedWeeks: [[HomeWeek]] = []
}

/// Where a row comes from as it is lifted out: its date's green circle, as a move and a
/// squeeze of the row (the web's Flight); `circle` false: from a little below, faded.
struct RowFlight: Equatable {
    var dx: CGFloat, dy: CGFloat, sx: CGFloat, sy: CGFloat
    var circle: Bool
}

/// A week as the pile draws it: its line, its numbers, its lanes (WeekPicture).
let pileWeekHeight: CGFloat = 1 + 40 + CGFloat(monthLanes) * monthLanePoints + monthMorePoints
/// The shared calendar's band over its weeks: the month's name and the weekdays, as
/// tall as My calendar's header holds them (its title 45.5, its weekdays 30).
let pileBandHeight: CGFloat = 75.5

/// Apple Calendar's colours, a friend each, in the group's order.
private let friendColors = [
    "0, 122, 255", "52, 199, 89", "175, 82, 222", "255, 149, 0", "255, 45, 85", "90, 200, 250", "162, 132, 94",
    "88, 86, 214",
]
/// Your own busy time under the pile.
private let yoursColor = "142, 142, 147"
/// The most dates in the list.
private let listMax = 8
/// The pause as each date turns into its row.
private let arrivalPause: Duration = .milliseconds(320)

/// The paper pile (#126, #282), natively: your month, and each friend's
/// calendar thrown onto it from the left, then the right, faster each time,
/// landing with a skid and a hop that knocks the ones under it. Pressed down,
/// the days free for everyone light up, and fly up into a list; each date is
/// checked in turn and ranked, the ones the vote offers ticked. Then the one
/// button that sends them, and "Ret planen" back to the sheet.
@MainActor @Observable
final class PileModel {
    static let shared = PileModel()

    enum Phase: Int, Comparable {
        case landing, pressed, revealed, lifted, ranking, done
        static func < (a: Phase, b: Phase) -> Bool { a.rawValue < b.rawValue }
    }

    private(set) var phase: Phase = .landing
    private(set) var landed = 0
    private(set) var layers: PileLayers?
    /// Where My calendar's month is on the screen, the calendars thrown onto it there (as
    /// the web's): the home page scrolled to it first. Nil: the pile draws its own month.
    private(set) var onHome: CGRect?
    /// The native home page is under the pile (known at once, before its month is found):
    /// the close button goes in its month title's row from the first frame.
    private(set) var overHome = false
    private(set) var timeline = pileTimeline(0, start: PileTiming.inPlace)
    /// The throw's clock running: only once the pile has been drawn (`drawn`). Its first
    /// drawing took half a second, and a throw already timed was over by then.
    private(set) var throwing = false
    /// The dates in the list; nil until worked out, or when there is none.
    private(set) var dates: [CheckedDate]?
    /// The dates have been worked out (there may be none).
    private(set) var ready = false
    private(set) var arrived: Set<String> = []
    /// How far the shared calendar has scrolled, lifting each date out (the web's `scroll`).
    private(set) var scroll: CGFloat = 0
    /// Where each row came from, set the moment its date is lifted out.
    private(set) var flights: [String: RowFlight] = [:]
    /// The pile's weeks on the screen (its first week's top, its width): where the shared
    /// calendar lies and its green circles are.
    var weeksFrame: CGRect?
    /// Each row's place on the screen, read as it is laid out (not drawn from: no redraw).
    @ObservationIgnored var rowFrames: [String: CGRect] = [:]
    private(set) var taken: Set<Int64> = []
    private(set) var checked = 0
    private(set) var widen: [WidenOption] = []
    /// Why there is nothing to show, if there isn't.
    private(set) var waiting: String?
    private(set) var sending = false
    private(set) var flying = false
    var failure: String?

    private var run: Task<Void, Never>?
    private var pool: [FoundDate] = []
    private var scores: [String: Double] = [:]
    private var counted = 0
    /// What the event is likely to cause (#113), asked as the pile starts.
    private var profile: EventImpact?
    private let zone = appTimeZone
    private var plan: PlanModel { PlanModel.shared }

    var priority: String { plan.extras.priority }

    /// Nothing on it: called before the pile is shown again, so its first frame is never
    /// the last pile (already lying there, over a dark screen) until `start` clears it.
    func reset() {
        run?.cancel()
        phase = .landing
        landed = 0
        layers = nil
        onHome = nil
        overHome = NativeHome.on && HomeModel.shared.page.shown
        scroll = 0
        flights = [:]
        weeksFrame = nil
        rowFrames = [:]
        throwing = false
        dates = nil
        ready = false
        arrived = []
        taken = []
        checked = 0
        widen = []
        waiting = nil
        sending = false
        flying = false
        failure = nil
    }

    /// From the top: the calendars thrown, pressed, the dates lifted and checked.
    func start() {
        reset()
        let still = UIAccessibility.isReduceMotionEnabled
        run = Task {
            guard let found = await plan.waitForSearch(), let people = plan.people, !people.participants.isEmpty
            else {
                waiting =
                    plan.busyFailed
                    ? CasyStrings.pileBusyFailed : plan.busy == nil ? CasyStrings.pileBusyLoading : CasyStrings.pileNoCalendars
                phase = .done
                return
            }
            await prepare(found, people.participants)
            guard !Task.isCancelled else { return }
            if still {
                arrived = Set(dates?.map(\.id) ?? [])
                checked = dates?.count ?? 0
                phase = .done
                return
            }
            await Self.drawn()
            throwing = true
            await throwThem()
            guard !Task.isCancelled else { return }
            await lift()
        }
    }

    func stop() { run?.cancel() }

    /// Two frames on the screen from now: a display tick only comes once the main
    /// thread is free to draw, so by then whatever was just put on screen is drawn.
    static func drawn(_ frames: Int = 2) async {
        for _ in 0..<frames {
            await withCheckedContinuation { (done: CheckedContinuation<Void, Never>) in
                FrameTick.once { done.resume() }
            }
        }
    }

    /// The pool, the scores, the list and the layers, worked out off the main thread.
    private func prepare(_ found: MultiDayResult, _ participants: [Participant]) async {
        let search = plan.search
        let extraSearches = plan.extraSearches
        let window = plan.searchWindow
        let extras = plan.extras
        let now = Native.now
        let zone = zone
        // The event's profile (#113) is asked for alongside, never waited for here:
        // it only ranks the dates, so the calendars are thrown at once, as the web's
        // (waiting first held the pile back for up to 2.5 s before anything moved).
        let profileAsked = Task { await fetchProfile() }
        guard let slot = found.slot else {
            widen = await plan.widenings()
            ready = true
            var laid = Self.layers(participants, search, window, [], you: plan.you, before: plan.again?.before, zone)
            laid.homeWeeks = await Self.homeMonth(laid.month)
            onHome = await Self.scrollHome(to: laid.month)
            layers = laid
            timeline = pileTimeline(thrownCount, start: PileTiming.inPlace)
            return
        }
        let first = FoundDate(slot: slot, conflicts: found.conflicts, absent: found.absent)
        let you = plan.you
        let before = plan.again?.before
        let waitingFor = !(plan.people?.waitingFor.isEmpty ?? true)
        // The pool, and the layers from the dates' starts alone, worked out off the main
        // thread (a third of a second that froze the screen), so they are thrown at once.
        let worked = await Task.detached(priority: .userInitiated) {
            let pool = findPoolAcross(
                participants, [search] + extraSearches,
                CandidateOptions(
                    first: first, end: window.end, count: extras.dateCount, now: now,
                    everyTime: !extraSearches.isEmpty), zone)
            let preliminary = Self.checked(
                first, pool, participants, search, window: window, extras: extras, scores: [:], counted: 0, profile: nil,
                you: you, waitingFor: waitingFor, now: now, everyTime: !extraSearches.isEmpty)
            let layers = Self.layers(
                participants, search, window, preliminary.map(\.date.slot.start), you: you, before: before, zone)
            return (pool, layers)
        }.value
        pool = worked.0
        var laid = worked.1
        laid.homeWeeks = await Self.homeMonth(laid.month)
        onHome = await Self.scrollHome(to: laid.month)
        layers = laid
        timeline = pileTimeline(thrownCount, start: PileTiming.inPlace)
        // How well each date suits the group (#119), asked while the calendars are thrown,
        // once the profile is in (it says what the event does to the night before).
        Task {
            profile = await profileAsked.value
            let profile = profile
            await score(first)
            let pool = pool
            let scores = scores
            let counted = counted
            dates = await Task.detached(priority: .userInitiated) {
                Self.checked(
                    first, pool, participants, search, window: window, extras: extras, scores: scores, counted: counted,
                    profile: profile, you: you, waitingFor: waitingFor, now: now, everyTime: !extraSearches.isEmpty)
            }.value
            ready = true
        }
    }

    /// My calendar's own month, laid out: read first if the home page hasn't yet (Planlæg
    /// opened straight away), never waited for long; nil if it can't be had.
    private static func homeMonth(_ month: Int64) async -> [HomeWeek]? {
        let home = HomeModel.shared
        if home.months.isEmpty {
            let read = Task { await home.load() }
            let timeout = Task {
                try? await Task.sleep(for: .seconds(1.5))
                read.cancel()
            }
            await read.value
            timeout.cancel()
            // Laid out off the main thread just after it is read.
            for _ in 0..<20 where home.months.isEmpty { try? await Task.sleep(for: .milliseconds(25)) }
        }
        return home.months.first { $0.id == month }?.weeks
    }

    /// The native home page under the pile scrolled to the month, and where that month's
    /// weeks then are on the screen; nil if it isn't the home page under it, or the weeks
    /// can't all be found (the pile then draws its own month).
    private static func scrollHome(to month: Int64) async -> CGRect? {
        let home = HomeModel.shared
        guard NativeHome.on, home.page.shown, let weeks = home.months.first(where: { $0.id == month })?.weeks
        else { return nil }
        home.focus = month
        func measured() -> CGRect? {
            var all: CGRect?
            for week in weeks {
                guard let row = HomeFrames.shared.rows[HomeFrames.key(month, week.id)] else { return nil }
                all = all.map { $0.union(row.frame) } ?? row.frame
            }
            return all
        }
        // Until the scroll has settled: the same place twice in a row.
        var last: CGRect?
        for _ in 0..<30 {
            try? await Task.sleep(for: .milliseconds(50))
            let now = measured()
            if let now, let last, abs(now.minY - last.minY) < 0.5, home.focus == nil { return now }
            last = now
        }
        return last
    }

    /// The event's profile, only for someone who said yes to the AI; never waited for long.
    private func fetchProfile() async -> EventImpact? {
        guard plan.activeGroup != nil, await aiContentAllowed(), let api = await Native.api() else { return nil }
        let event = EventToProfile(
            plan.search, title: plan.sentTitle, place: plan.extras.place, note: plan.extras.note)
        let asked = Task { try await api.profileEvent(event) }
        let timeout = Task {
            try? await Task.sleep(for: .seconds(2.5))
            asked.cancel()
        }
        defer { timeout.cancel() }
        return try? await asked.value
    }

    private func score(_ first: FoundDate) async {
        guard let group = plan.activeGroup, let api = await Native.api() else { return }
        let all = [first] + pool
        let search = plan.search
        let asked = Task {
            try await api.rankDates(
                groupId: group.id, settings: search, profile: profile,
                dates: all.map { SentDate(start: $0.slot.start, end: $0.slot.end, answer: nil) })
        }
        // Never waited for long: the dates go without the scores rather than late.
        let timeout = Task {
            try? await Task.sleep(for: .seconds(2.5))
            asked.cancel()
        }
        if let answer = try? await asked.value, answer.scores.count == all.count {
            scores = Dictionary(uniqueKeysWithValues: zip(all.map(\.slot.start), answer.scores))
            counted = answer.counted
        }
        timeout.cancel()
    }

    /// The calendars thrown one after another, the thud as each lands; pressed; revealed.
    /// The calendars on the pile already (a vote searched again, #240).
    var placedCount: Int { layers?.friends.filter(\.placed).count ?? 0 }
    /// Those thrown now.
    private var thrownCount: Int { (layers?.friends.count ?? 0) - placedCount }
    /// Every calendar down so far, those already there first.
    var landedNow: Int { placedCount + landed }

    private func throwThem() async {
        let t0 = Date()
        func until(_ seconds: Double) async {
            let left = seconds - Date().timeIntervalSince(t0)
            if left > 0 { try? await Task.sleep(for: .milliseconds(Int(left * 1000))) }
        }
        for (k, land) in timeline.lands.enumerated() {
            await until(land.at + land.duration)
            guard !Task.isCancelled else { return }
            withAnimation(.spring(response: 0.3, dampingFraction: 0.5)) { landed = k + 1 }
            UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
        }
        await until(timeline.pressAt)
        guard !Task.isCancelled else { return }
        withAnimation(.spring(response: 0.45, dampingFraction: 0.8)) { phase = .pressed }
        UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
        await until(timeline.revealAt)
        guard !Task.isCancelled else { return }
        withAnimation(.easeOut(duration: 0.5)) { phase = .revealed }
        await until(timeline.liftAt)
        // The scores are asked meanwhile; the lift waits briefly for them.
        while !ready && !Task.isCancelled { try? await Task.sleep(for: .milliseconds(80)) }
    }

    /// The dates fly up into the list, one after another; then each is checked and ranked.
    private func lift() async {
        withAnimation(.easeOut(duration: 0.4)) { phase = .lifted }
        guard let dates, !dates.isEmpty else {
            withAnimation { phase = .done }
            return
        }
        try? await Task.sleep(for: .milliseconds(250))
        // The dates in their order: the shared calendar scrolls up until the next one's
        // green circle is level with its empty row, stops, and the circle turns into the
        // row (the web's DateList). One already level or past turns at once; one with no
        // circle (someone gives something up for it) rises from below.
        for item in dates {
            guard !Task.isCancelled else { return }
            let row = rowFrames[item.id]
            var circle = circle(of: item.day)
            if let row, let c = circle {
                let gap = c.midY - row.midY
                if gap > 1 {
                    let seconds = min(1.1, max(0.25, Double(gap) / 900))
                    withAnimation(.easeInOut(duration: seconds)) { scroll += gap }
                    let ticks = Task { await tick(over: gap, seconds: seconds) }
                    try? await Task.sleep(for: .milliseconds(Int(seconds * 1000)))
                    ticks.cancel()
                    guard !Task.isCancelled else { return }
                    circle = self.circle(of: item.day)
                }
            }
            flights[item.id] =
                if let row, let c = circle {
                    RowFlight(
                        dx: c.minX - row.minX, dy: c.minY - row.minY, sx: c.width / row.width,
                        sy: c.height / row.height, circle: true)
                } else {
                    RowFlight(dx: 0, dy: 24, sx: 1, sy: 1, circle: false)
                }
            // Drawn at its circle first, then it grows into its row.
            await Self.drawn(1)
            withAnimation(.timingCurve(0.3, 0.9, 0.3, 1, duration: 0.55)) {
                arrived.insert(item.id)
                taken.insert(item.day)
            }
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            try? await Task.sleep(for: arrivalPause)
        }
        withAnimation(.easeOut(duration: 0.4)) { phase = .ranking }
        let times = checkTimes(dates.count)
        let t0 = Date()
        for (i, at) in times.enumerated() {
            let left = at - Date().timeIntervalSince(t0)
            if left > 0 { try? await Task.sleep(for: .milliseconds(Int(left * 1000))) }
            guard !Task.isCancelled else { return }
            withAnimation(.spring(response: 0.38, dampingFraction: 0.72)) { checked = i + 1 }
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        }
        try? await Task.sleep(for: .milliseconds(Int(PileTiming.ranked * 1000)))
        guard !Task.isCancelled else { return }
        withAnimation(.easeOut(duration: 0.3)) { phase = .done }
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }

    /// A date's green circle on the screen, in the shared calendar as scrolled now; nil if
    /// it has none (not lit) or the pile isn't laid out.
    private func circle(of day: Int64) -> CGRect? {
        guard let frame = weeksFrame, let layers, layers.shine.contains(day),
            let m = layers.months.firstIndex(of: startOfMonth(day, zone)), m < layers.sharedWeeks.count,
            let w = layers.sharedWeeks[m].firstIndex(where: { $0.days.contains { $0.date == day && $0.inMonth } }),
            let c = layers.sharedWeeks[m][w].days.firstIndex(where: { $0.date == day })
        else { return nil }
        let before = layers.sharedWeeks[..<m].reduce(0) { $0 + $1.count }
        let column = frame.width / 7
        // The number's 32 point circle sits in the middle of its 40 point row, under the week's line.
        let top = frame.minY + CGFloat(before + w) * pileWeekHeight - scroll + 1 + 4
        return CGRect(x: frame.minX + column * CGFloat(c) + (column - 32) / 2, y: top, width: 32, height: 32)
    }

    /// A light tick for every 70 points the calendar scrolls, like a wheel's detents.
    private func tick(over distance: CGFloat, seconds: Double) async {
        let count = Int(distance / 70)
        guard count > 0 else { return }
        let ticker = UISelectionFeedbackGenerator()
        for _ in 0..<count {
            try? await Task.sleep(for: .milliseconds(Int(seconds * 1000) / (count + 1)))
            if Task.isCancelled { return }
            ticker.selectionChanged()
        }
    }

    /// The other choice of ranking (#234): the list re-ranks where it stands.
    func pick(priority: String) {
        plan.extras.priority = priority
        guard let found = plan.found, let slot = found.slot, let people = plan.people else { return }
        let first = FoundDate(slot: slot, conflicts: found.conflicts, absent: found.absent)
        withAnimation(.spring(response: 0.38, dampingFraction: 0.8)) {
            dates = Self.checked(
                first, pool, people.participants, plan.search, window: plan.searchWindow, extras: plan.extras,
                scores: scores, counted: counted, profile: profile, you: plan.you, waitingFor: !people.waitingFor.isEmpty,
                now: Native.now, everyTime: !plan.extraSearches.isEmpty)
            arrived = Set(dates?.map(\.id) ?? [])
            checked = dates?.count ?? 0
        }
    }

    /// A way to widen the search picked (#135): the new answer's dates lifted into the list.
    func pickWiden(_ option: WidenOption) {
        plan.apply(option)
        run?.cancel()
        run = Task {
            guard let found = await plan.waitForSearch(), let people = plan.people else { return }
            widen = []
            arrived = []
            taken = []
            flights = [:]
            scroll = 0
            checked = 0
            dates = nil
            ready = false
            await prepare(found, people.participants)
            while !ready && !Task.isCancelled { try? await Task.sleep(for: .milliseconds(80)) }
            if UIAccessibility.isReduceMotionEnabled {
                arrived = Set(dates?.map(\.id) ?? [])
                checked = dates?.count ?? 0
                phase = .done
            } else {
                await lift()
            }
        }
    }

    // MARK: Sending

    var chosen: [CheckedDate] { dates?.filter(\.chosen) ?? [] }
    var alone: Bool { (plan.activeGroup?.members.count ?? 0) <= 1 }
    var review: AnswerReview {
        reviewAnswer(plan.found, plan.search, you: plan.you, acceptedStart: plan.steps.accepted)
    }
    var canSend: Bool { plan.activeGroup != nil && !chosen.isEmpty && review.tone != "approve" && !sending }

    /// The vote's dates sent, each with your yes (#101); `onSent` once they have flown and the server has answered.
    func send(onSent: @escaping () -> Void) {
        guard let group = plan.activeGroup, canSend else { return }
        sending = true
        failure = nil
        let still = UIAccessibility.isReduceMotionEnabled
        if !still { withAnimation(.easeIn(duration: 0.5)) { flying = true } }
        Task {
            let flight = Task { if !still { try? await Task.sleep(for: .milliseconds(900)) } }
            do {
                guard let api = await Native.api() else {
                    throw APIError.failed(status: 401, message: CasyStrings.pileSuggestFailed)
                }
                let sent = chosen.map { SentDate(start: $0.date.slot.start, end: $0.date.slot.end) }
                if let again = plan.again {
                    // Searched again (#240): the vote gets the dates, everyone answering anew.
                    EventsModel.shared.show(
                        try await api.searchVoteAgain(
                            again.eventId, add: again.add, settings: plan.search, dates: sent,
                            errorMessage: CasyStrings.searchAgainFailed))
                } else {
                    let answer = try await api.suggestEvent(
                        groupId: group.id, title: plan.sentTitle, settings: plan.search, dates: sent,
                        place: plan.extras.place, note: plan.extras.note, answerDays: plan.extras.answerDays,
                        impact: profile, errorMessage: CasyStrings.pileSuggestFailed)
                    EventsModel.shared.show(answer.events)
                }
                await flight.value
                sending = false
                onSent()
            } catch {
                // Not sent after all: the list comes back, with the reason under it.
                flight.cancel()
                withAnimation { flying = false }
                sending = false
                failure = error.localizedDescription
            }
        }
    }

    // MARK: Working it out

    /// The dates in the list (the web's PileScreen `dates`): those a vote offers
    /// by either ranking, and others that work, up to eight, soonest first, each
    /// with what was checked about it.
    nonisolated static func checked(
        _ first: FoundDate, _ pool: [FoundDate], _ participants: [Participant], _ search: EventSettings,
        window: (start: String, end: String), extras: EventExtras, scores: [String: Double], counted: Int,
        profile: EventImpact?, you: String?, waitingFor: Bool, now: Int64, everyTime: Bool = false
    ) -> [CheckedDate] {
        let zone = appTimeZone
        let lang: Lang = CasyStrings.language == "en" ? .en : .da
        func rank(_ priority: String) -> RankedDates {
            rankFromPool(
                pool, participants, search,
                CandidateOptions(
                    first: first, end: window.end, count: extras.dateCount, scores: scores, profile: profile, now: now,
                    priority: priority, everyTime: everyTime),
                zone)
        }
        let ranked = rank(extras.priority)
        let other = rank(extras.priority == "soon" ? "hassle" : "soon")
        var either: [FoundDate] = []
        for d in ranked.chosen + other.chosen where !either.contains(where: { $0.slot.start == d.slot.start }) {
            either.append(d)
        }
        let others = ranked.pool.filter { d in
            !either.contains { $0.slot.start == d.slot.start } && d.conflicts.isEmpty
                && !bigOnNewYearsDay(profile, start: d.slot.start, end: d.slot.end, search, zone)
        }
        let listed = (either + others.prefix(max(0, listMax - either.count))).sorted {
            (parseInstant($0.slot.start) ?? 0) < (parseInstant($1.slot.start) ?? 0)
        }
        let groupSize = peopleForSearch(participants, search.people).searched.count
        let nameOf = { (id: String) in participants.first { $0.profileId == id }?.name ?? "" }
        func names(_ list: [String]) -> String { nameList(list, lang) }
        let comfortWords = ComfortWords(
            you: CasyStrings.pileComfortYou, tightBefore: { CasyStrings.pileComfort("tightBefore", $0) },
            tightAfter: { CasyStrings.pileComfort("tightAfter", $0) }, squeezed: { CasyStrings.pileComfort("squeezed", $0) },
            earlyAfterLate: { CasyStrings.pileComfort("earlyAfterLate", $0) },
            schoolNight: CasyStrings.pileComfort("schoolNight"), afterDark: CasyStrings.pileComfort("afterDark"),
            familyDay: CasyStrings.pileComfort("familyDay"), longWeekend: CasyStrings.pileComfort("longWeekend"),
            soon: CasyStrings.pileComfort("soon"), farAhead: CasyStrings.pileComfort("farAhead"))
        let backToBack = BackToBackWords(
            you: CasyStrings.edgeBackYou, oneYou: CasyStrings.edgeBackOneYou, one: { CasyStrings.edgeBackOne($0) },
            many: { CasyStrings.edgeBackMany($0) })
        let early = EarlyMorningWords(
            you: CasyStrings.edgeEarlyYou, oneYou: { CasyStrings.edgeEarlyOneYou($0) },
            one: { CasyStrings.edgeEarlyOne($0, $1) }, many: { CasyStrings.edgeEarlyMany($0) })

        return listed.map { date in
            let start = date.slot.start
            let isChosen = ranked.chosen.contains { $0.slot.start == start }
            let warnings: [EdgeWarning]? =
                search.kind == .single
                ? edgeWarnings(
                    participants, start: start, end: date.slot.end, zone, you: you, lang, backToBack: backToBack,
                    earlyMorning: early, newYearsDay: CasyStrings.edgeNewYearsDay)
                : nil
            let absent = date.absent ?? []
            let poolIndex = ranked.pool.firstIndex { $0.slot.start == start }
            let comfort = poolIndex.map { ranked.comfort[$0] }
            let notes = comfortNotes(
                comfort?.penalties ?? [], nameOf: nameOf, you: you, lang, comfortWords, warnings: warnings)
            var checks: [(String, Bool)] = []
            checks.append(
                absent.isEmpty
                    ? (waitingFor ? CasyStrings.pileAllCanWithCalendar(groupSize) : CasyStrings.pileAllCan(groupSize), false)
                    : (CasyStrings.pileCant(names(absent.map(\.name))), true))
            if counted > 0, let score = scores[start] {
                checks.append((CasyStrings.pileMatchScore(Int(score.rounded())), score < 85))
            }
            if let warnings {
                checks.append(
                    warnings.isEmpty
                        ? (CasyStrings.pileEdgesClear, false) : (warnings.map(\.text).joined(separator: " "), true))
            }
            checks += notes.map { ($0.text, $0.notable) }
            checks.append(
                date.conflicts.isEmpty
                    ? (CasyStrings.pileNoSkips, false)
                    : search.kind == .single
                        ? (CasyStrings.pileNeedSkip(names(date.conflicts.map(\.name))), true)
                        : (CasyStrings.pileNeedTimeOff(names(date.conflicts.map(\.name))), true))
            checks.append((isChosen ? CasyStrings.pilePicked : CasyStrings.pileNotPicked, false))
            let pickedAt = ranked.byPick.firstIndex { $0.slot.start == start }
            return CheckedDate(
                date: date, day: startOfDay(parseInstant(start) ?? 0, zone), chosen: isChosen,
                checks: checks.map { (found: $0.0, notable: $0.1) },
                facts: RankedFacts(
                    pickedAt: pickedAt, conflicts: date.conflicts.count + absent.count, cost: comfort?.cost ?? 0,
                    warnings: warnings?.count ?? 0, start: parseInstant(start) ?? 0))
        }
    }

    /// The month in the pile (the one holding most of the dates), the months
    /// after it up to the last date, the days free for everyone, and each
    /// friend's busy time over them as bars.
    nonisolated static func layers(
        _ participants: [Participant], _ search: EventSettings, _ window: (start: String, end: String),
        _ starts: [String], you: String?, before: [String]? = nil, _ zone: String
    ) -> PileLayers {
        let today = Native.now
        let windowEnd = parseInstant(CasyCore.searchWindow(now: today, zone).end) ?? 0
        let m = candidateMonth(Array(starts.prefix(1)), fallback: window.start, zone)
        let first = wallTime(m.year, m.month, 1, 0, zone)
        let last = starts.last.map { startOfMonth(parseInstant($0) ?? 0, zone) } ?? first
        var months: [Int64] = []
        var month = first
        while month <= max(first, last) {
            months.append(month)
            month = startOfMonth(month, zone, 1)
        }
        var shine: Set<Int64> = []
        var sheets: [PileSheet] = []
        for mo in months {
            let local = localDate(mo, zone)
            let built = buildPile(
                participants, search, you: you, year: local.year, month: local.month, timeZone: zone, todayMs: today,
                windowEndMs: windowEnd, window: window)
            if mo == first { sheets = built.sheets }
            for (i, free) in built.through.enumerated() where free { shine.insert(addDays(mo, i, zone)) }
        }
        let from = addDays(first, -7, zone)
        let to = addDays(startOfMonth(last, zone, 1), 7, zone)
        func items(_ id: String) -> [MonthItem] {
            (participants.first { $0.profileId == id }?.busy ?? [])
                .filter { $0.holiday != true }
                .map { MonthItem(calendarId: id, start: parseInstant($0.start) ?? 0, end: parseInstant($0.end) ?? 0, label: "") }
                .filter { $0.end > from && $0.start < to }
        }
        var friends = sheets.filter { !$0.isYou }.enumerated().map { k, s in
            PileFriend(
                profileId: s.profileId, name: s.name, color: friendColors[k % friendColors.count], items: items(s.profileId),
                placed: before?.contains(s.profileId) ?? false, weeks: PileMonth.weeks(first, items(s.profileId)))
        }
        // Those on the pile already first, so the ones thrown now land on top.
        friends = friends.filter(\.placed) + friends.filter { !$0.placed }
        let yours = you.map { items($0) } ?? []
        let everyone = friends.flatMap(\.items)
        return PileLayers(
            month: first, months: months, shine: shine, friends: friends, yours: yours,
            yourWeeks: PileMonth.weeks(first, yours), emptyWeeks: PileMonth.weeks(first, []),
            sharedWeeks: months.map { PileMonth.weeks($0, everyone) })
    }
}

// MARK: - The screen

struct PileScreen: View {
    let onChange: () -> Void
    let onClose: () -> Void
    let onSent: () -> Void

    private let model = PileModel.shared
    @Environment(\.colorScheme) private var scheme
    @State private var open: String?
    @State private var priorityOpen = false
    /// A vote searched again: everyone votes anew, said before sending (#240).
    @State private var warning = false

    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }
    private var listing: Bool { model.phase >= .lifted }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .top) {
                // The home page shows through until the pile is worked out (a moment); thrown
                // onto My calendar's own month, it stays, buttons and all, as on the web.
                Theme.background.color.ignoresSafeArea()
                    .opacity((model.layers == nil || model.onHome != nil) && model.waiting == nil ? 0 : 1)
                    .animation(.easeOut(duration: 0.25), value: model.layers == nil)
                if let layers = model.layers {
                    Group {
                        if let month = model.onHome {
                            let origin = geo.frame(in: .global).origin
                            PileTable(layers: layers, width: month.width, onHome: true)
                                .offset(x: month.minX - origin.x, y: month.minY - origin.y)
                                .frame(width: geo.size.width, height: geo.size.height, alignment: .topLeading)
                        } else {
                            PileTable(layers: layers, width: geo.size.width)
                                .padding(.top, 8)
                                .transition(.opacity)
                        }
                    }
                    // Once the dates lift, the pile is one calendar (the shared one, below).
                    .opacity(listing ? 0 : 1)
                    .animation(.easeOut(duration: 0.3), value: listing)
                    if listing, let weeks = model.weeksFrame {
                        let origin = geo.frame(in: .global).origin
                        SharedCalendar(
                            layers: layers, weeks: weeks, scroll: model.scroll, taken: model.taken,
                            room: geo.size.height + geo.safeAreaInsets.bottom - (weeks.minY - origin.y - pileBandHeight)
                        )
                        .offset(x: weeks.minX - origin.x, y: weeks.minY - origin.y - pileBandHeight)
                        .frame(width: geo.size.width, height: geo.size.height, alignment: .topLeading)
                        .transition(.opacity.animation(.easeOut(duration: 0.25)))
                    }
                }
                if let month = model.onHome {
                    // Over the home page's header as the dates lift (the web's top band),
                    // over everything once they are ranked.
                    let origin = geo.frame(in: .global).origin
                    Theme.background.color.opacity(0.5)
                        .frame(height: max(0, month.minY - origin.y - pileBandHeight) + geo.safeAreaInsets.top)
                        .frame(maxHeight: .infinity, alignment: .top)
                        .ignoresSafeArea()
                        .opacity(listing && model.phase < .ranking ? 1 : 0)
                        .animation(.easeOut(duration: 0.4), value: listing)
                        .allowsHitTesting(false)
                }
                // Behind the list once the dates are ranked, the pile softened (the web's
                // bg-background/50): a plain layer over it. Blurring the pile itself was
                // worked out afresh on every frame the rows moved, and they stuttered.
                Theme.background.color.opacity(0.5)
                    .ignoresSafeArea()
                    .opacity(model.phase >= .ranking ? 1 : 0)
                    .animation(.easeOut(duration: 0.4), value: model.phase >= .ranking)
                    .allowsHitTesting(false)
                if listing { list }
                if model.overHome {
                    // In the month title's row, clear of the home page's buttons: under its
                    // toolbar's row (8 + 40 + 4), in the middle of the title's 45.5.
                    closeButton.offset(y: 52 + 45.5 / 2 - 18 - 4)
                } else {
                    closeButton
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("pile.screen")
        .task { model.start() }
        .onDisappear { model.stop() }
    }

    private var closeButton: some View {
        HStack {
            Spacer()
            Button(action: onClose) {
                LucideIcon("x", size: 20)
                    .foregroundStyle(Theme.foreground.color)
                    .frame(width: 36, height: 36)
                    .pileGlass(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(CasyStrings.pileClose)
            .accessibilityIdentifier("pile.close")
            .opacity(model.flying ? 0 : 1)
        }
        .padding(.horizontal, 12)
        .padding(.top, 4)
    }

    // MARK: The list

    private var list: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    header
                    if model.phase == .done, model.dates?.isEmpty == false { priorityRow }
                    if let waiting = model.waiting {
                        Text(waiting)
                            .font(.system(size: 15))
                            .foregroundStyle(Theme.foreground.color)
                            .padding(16)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .pileGlass(RoundedRectangle(cornerRadius: 22, style: .continuous))
                    } else if let dates = model.dates, !dates.isEmpty {
                        rows(dates)
                    } else if model.phase == .done {
                        noDate
                    }
                }
                .padding(.horizontal, 12)
                .padding(.top, 56)
                .padding(.bottom, 12)
            }
            .scrollBounceBehavior(.basedOnSize)
            if model.phase == .done { panel }
        }
        // As the web's: the buttons 12 from the screen's bottom edge.
        .ignoresSafeArea(.container, edges: .bottom)
    }

    @ViewBuilder private var header: some View {
        HStack {
            Spacer()
            if model.phase == .done, let dates = model.dates, !dates.isEmpty {
                let n = dates.filter(\.chosen).count
                Text(PlanModel.shared.again == nil ? CasyStrings.pileRanked(n) : CasyStrings.pileRankedNew(n))
                    .font(.system(size: 18, weight: .heavy))
                    .tracking(-0.4)
                    .foregroundStyle(Theme.foreground.color)
                    .transition(.opacity)
            } else if model.phase < .done {
                HStack(spacing: 8) {
                    ProgressView().controlSize(.mini).tint(Theme.primary.color)
                    Text(PlanModel.shared.again == nil ? CasyStrings.pileReviewing : CasyStrings.pileReviewingNew)
                        .font(.system(size: 13, weight: .medium))
                }
                .foregroundStyle(Theme.foreground.color)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .pileGlass(Capsule())
            }
        }
        .frame(minHeight: 36)
        .padding(.horizontal, 4)
        // On the home page the close button is in this row: the words end before it.
        .padding(.trailing, model.overHome ? 40 : 0)
    }

    private var priorityRow: some View {
        Button { priorityOpen = true } label: {
            HStack(spacing: 12) {
                Text(CasyStrings.pilePriorityLabel)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Theme.foreground.color)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text(CasyStrings.pilePriority(model.priority))
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.primary.color)
                LucideIcon("chevron-down", size: 16).foregroundStyle(Theme.mutedForeground.color)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .contentShape(Rectangle())
            .pileGlass(RoundedRectangle(cornerRadius: 22, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("pile.priority")
        .popover(isPresented: $priorityOpen, attachmentAnchor: .rect(.bounds), arrowEdge: .top) {
            CardList(spaced: false) {
                ForEach(["hassle", "soon"], id: \.self) { choice in
                    PickRow(CasyStrings.pilePriority(choice), picked: model.priority == choice) {
                        model.pick(priority: choice)
                        priorityOpen = false
                    }
                }
            }
            .padding(8)
            .frame(width: 300)
            .presentationCompactAdaptation(.popover)
        }
    }

    private func rows(_ dates: [CheckedDate]) -> some View {
        let order = rankOrder(dates.map(\.facts), priority: model.priority)
        let shown = liveOrder(order, checked: model.checked, offered: dates.map(\.chosen)).map { dates[$0] }
        return ForEach(Array(shown.enumerated()), id: \.element.id) { place, item in
            let at = dates.firstIndex(of: item) ?? 0
            DateRow(
                item: item, rank: (order.firstIndex(of: at) ?? 0) + 1, at: at, checked: model.checked,
                ranking: model.phase == .ranking, done: model.phase == .done,
                meeting: PlanModel.shared.search.kind == .single, kind: PlanModel.shared.search.kind,
                arrived: model.arrived.contains(item.id), flight: model.flights[item.id], open: open == item.id,
                lang: lang
            ) {
                withAnimation(.easeInOut(duration: 0.25)) { open = open == item.id ? nil : item.id }
            }
            // Where it is laid out (outside its own flight), for its date to scroll level with.
            .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { model.rowFrames[item.id] = $0 }
            // Sent: the ones not sent swipe off to the right, the ones sent fly down into Aftaler.
            .offset(
                x: model.flying ? (item.chosen ? -120 : 500) : 0,
                y: model.flying && item.chosen ? 900 : 0
            )
            .scaleEffect(model.flying && item.chosen ? 0.3 : 1, anchor: .bottomLeading)
            .opacity(model.flying ? 0 : 1)
            .animation(.easeIn(duration: 0.55).delay(Double(place) * 0.05), value: model.flying)
        }
    }

    private var noDate: some View {
        VStack(alignment: .leading, spacing: 8) {
            if model.widen.isEmpty {
                Text(CasyStrings.pileNoneThrough)
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.foreground.color)
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .pileGlass(RoundedRectangle(cornerRadius: 22, style: .continuous))
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    Text(CasyStrings.widenTitle)
                        .font(.system(size: 15))
                        .foregroundStyle(Theme.foreground.color)
                        .padding(.horizontal, 4)
                    ForEach(Array(model.widen.enumerated()), id: \.offset) { _, option in
                        Button { model.pickWiden(option) } label: {
                            HStack(spacing: 12) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(widenLabel(option))
                                        .font(.system(size: 15, weight: .semibold))
                                        .foregroundStyle(Theme.foreground.color)
                                    Text(widenWhen(option))
                                        .font(.system(size: 14))
                                        .foregroundStyle(Theme.mutedForeground.color)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                LucideIcon("chevron-right", size: 16).foregroundStyle(Theme.mutedForeground.color)
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                            .background(Theme.background.color.opacity(0.6), in: RoundedRectangle(cornerRadius: 12))
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("pile.widen")
                    }
                }
                .padding(12)
                .pileGlass(RoundedRectangle(cornerRadius: 22, style: .continuous))
            }
        }
    }

    private func widenLabel(_ option: WidenOption) -> String {
        let w = option.widening
        switch w.kind {
        case "time": return CasyStrings.widenTime(w.part ?? "any")
        case "days": return CasyStrings.widenDays
        case "startDay": return CasyStrings.widenStartDay
        case "shorter": return CasyStrings.widenShorter(CasyStrings.planLength(w.minutes ?? 0))
        case "fewerDays": return CasyStrings.widenShorter(CasyStrings.days(w.days ?? 0))
        case "months":
            let words = PeriodWords(
                any: "", one: { $0 }, range: { "\($0) - \($1)" }, day: { $0 }, until: { $0 })
            return CasyStrings.widenMonths(periodText(w.period, lang, words, now: Native.now))
        default: return CasyStrings.widenPeople(w.atLeast ?? 0, w.of ?? 0)
        }
    }

    private func widenWhen(_ option: WidenOption) -> String {
        let kind = settingsToSearch(option.settings).kind
        let when = capitalize(formatEventDate(kind, start: option.first.slot.start, end: option.first.slot.end, lang))
        let absent = option.first.absent ?? []
        return absent.isEmpty ? when : "\(when), \(CasyStrings.widenWithout(nameList(absent.map(\.name), lang)))"
    }

    // MARK: The buttons

    private var panel: some View {
        VStack(spacing: 8) {
            if let failure = model.failure {
                Text(failure).font(.system(size: 14)).foregroundStyle(Theme.red700.color)
            }
            if model.review.tone == "approve" && !model.alone {
                HStack(spacing: 12) {
                    Text(CasyStrings.pileHintAccept)
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.mutedForeground.color)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Button { PlanModel.shared.acceptOwnTimeOff() } label: {
                        Text(CasyStrings.pileAccept)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Theme.foreground.color)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .overlay { RoundedRectangle(cornerRadius: 8).strokeBorder(Theme.border.color) }
                    }
                    .buttonStyle(.plain)
                }
            }
            if model.alone {
                FlowButton(action: onChange) { Text(CasyStrings.pileInviteFriends) }
            } else if !model.chosen.isEmpty {
                // A vote searched again (#240) asks first: everyone votes anew.
                FlowButton(
                    busy: model.sending,
                    action: { if again { warning = true } else { model.send(onSent: onSent) } }
                ) {
                    Text(again ? CasyStrings.pileSendNew(model.chosen.count) : CasyStrings.pileSuggest(model.chosen.count))
                }
                .disabled(!model.canSend)
                .accessibilityIdentifier("pile.send")
            }
            FlowButton(kind: .quiet, action: onChange) { Text(CasyStrings.pileChange) }
                .accessibilityIdentifier("pile.change")
            if model.alone {
                Text(CasyStrings.pileOnlyYou)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.mutedForeground.color)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(12)
        .pileGlass(RoundedRectangle(cornerRadius: 26, style: .continuous))
        .padding(.horizontal, 12)
        .padding(.bottom, 12)
        .opacity(model.flying ? 0 : 1)
        .transition(.move(edge: .bottom).combined(with: .opacity))
        .askFirst(
            AskWords(
                message: "\(CasyStrings.searchAgainWarning): \(CasyStrings.searchAgainWarningText)",
                confirm: CasyStrings.pileSendNew(model.chosen.count), danger: false),
            isPresented: $warning
        ) { model.send(onSent: onSent) }
    }

    private var again: Bool { PlanModel.shared.again != nil }
}

/// One date in the list: its place, the day and time, its mark, and once the
/// list is done what was found about it, opened by a tap.
private struct DateRow: View {
    let item: CheckedDate
    let rank: Int
    let at: Int
    let checked: Int
    let ranking: Bool
    let done: Bool
    let meeting: Bool
    let kind: EventKind
    let arrived: Bool
    /// Where it comes from as it is lifted out (its date's circle); nil: just there.
    let flight: RowFlight?
    let open: Bool
    let lang: Lang
    let toggle: () -> Void

    @Environment(\.colorScheme) private var scheme
    private var dark: Bool { scheme == .dark }

    private var status: String {
        at < checked ? (item.chosen ? "yes" : "no") : ranking && at == checked ? "checking" : "waiting"
    }
    private var label: String { capitalize(dayLabel(parseInstant(item.date.slot.start) ?? 0, lang)) }

    var body: some View {
        VStack(spacing: 0) {
            Button(action: toggle) {
                HStack(spacing: 12) {
                    ZStack {
                        if at < checked {
                            Text(verbatim: "\(rank)")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(item.chosen ? Color.white : Theme.mutedForeground.color)
                                .frame(width: 24, height: 24)
                                .background(item.chosen ? Theme.cta.color : Theme.secondary.color, in: Circle())
                                .transition(.scale(scale: 0.4).combined(with: .opacity))
                        } else {
                            Circle()
                                .strokeBorder(
                                    Theme.mutedForeground.color.opacity(0.25), style: StrokeStyle(lineWidth: 2, dash: [3, 3])
                                )
                                .frame(width: 24, height: 24)
                        }
                    }
                    VStack(alignment: .leading, spacing: 0) {
                        Text(label)
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(Theme.foreground.color)
                            .lineLimit(1)
                            .cssLineHeight(24, size: 16)
                        if meeting {
                            Text(verbatim: "\(formatTime(item.date.slot.start))-\(formatTime(item.date.slot.end))")
                                .font(.system(size: 13))
                                .foregroundStyle(Theme.mutedForeground.color)
                                .cssLineHeight(19.5, size: 13)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    mark.frame(width: 28, height: 28)
                    LucideIcon("chevron-down", size: 16)
                        .foregroundStyle(Theme.mutedForeground.color)
                        .rotationEffect(.degrees(open ? 180 : 0))
                        .opacity(done ? 1 : 0)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            // Its words come once it has grown out of its circle.
            .opacity(arrived || flight == nil ? 1 : 0)
            .animation(.easeOut(duration: 0.25).delay(arrived && flight?.circle == true ? 0.3 : 0), value: arrived)
            .disabled(!done)
            .accessibilityLabel(CasyStrings.pileDetails(label))
            .accessibilityIdentifier("pile.date")
            if open {
                VStack(alignment: .leading, spacing: 6) {
                    Text(formatEventDate(kind, start: item.date.slot.start, end: item.date.slot.end, lang))
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.foreground.color)
                    ForEach(Array(item.checks.enumerated()), id: \.offset) { _, check in
                        HStack(alignment: .top, spacing: 8) {
                            Circle().frame(width: 6, height: 6).padding(.top, 7)
                            Text(check.found).font(.system(size: 14)).fixedSize(horizontal: false, vertical: true)
                        }
                        .foregroundStyle(check.notable ? Theme.amber800.color : Theme.mutedForeground.color)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)
                .padding(.top, 10)
                .padding(.bottom, 12)
                .overlay(alignment: .top) { Rectangle().fill(Color.white.opacity(0.3)).frame(height: 1) }
                // Uncovered where it lies as the row grows (the web's Collapse), never slid
                // down through the date above it; it fades in under the growing edge.
                .transition(.opacity)
            }
        }
        // The row's own shape: the details show only inside it as it opens.
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        // The green of the circle it came out of, fading into glass.
        .background {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(Theme.emerald500.color)
                .opacity(arrived ? 0 : 1)
                .animation(.easeOut(duration: 0.35).delay(0.25), value: arrived)
        }
        // Frosted but still while the rows fly in and change places, Apple's glass once the
        // list is done (the web's glass-moving): eight live glass rows on the move over
        // the pile were redrawn every frame, and the ranking stuttered.
        .background { PileFrost(shape: RoundedRectangle(cornerRadius: 22, style: .continuous), dark: dark).opacity(done ? 0 : 1) }
        .pileGlass(RoundedRectangle(cornerRadius: 22, style: .continuous), on: done)
        // Out of its green circle and stretched into the row (the web's FLIP); unseen until then.
        .scaleEffect(x: arrived ? 1 : flight?.sx ?? 1, y: arrived ? 1 : flight?.sy ?? 1, anchor: .topLeading)
        .offset(x: arrived ? 0 : flight?.dx ?? 0, y: arrived ? 0 : flight?.dy ?? 24)
        .opacity(arrived || flight?.circle == true ? 1 : 0)
        .zIndex(ranking && at == checked - 1 ? 10 : 0)
    }

    @ViewBuilder private var mark: some View {
        switch status {
        case "checking":
            ProgressView().tint(Theme.primary.color)
        case "yes":
            LucideIcon("check", size: 20, stroke: 3)
                .foregroundStyle(Theme.primary.color)
                .transition(.scale.combined(with: .opacity))
                .accessibilityLabel(CasyStrings.pilePicked)
        case "no":
            EmptyView()
        default:
            Circle().fill(Theme.mutedForeground.color.opacity(0.3)).frame(width: 8, height: 8)
        }
    }
}

// MARK: - The pile itself

/// Your month, with each friend's calendar thrown onto it.
private struct PileTable: View {
    let layers: PileLayers
    let width: CGFloat
    /// Thrown onto My calendar's month under it: only the sheets and the lit days, laid
    /// over the home page's own weeks (its title, weekdays and month are the page's).
    var onHome = false

    private let model = PileModel.shared
    @Environment(\.colorScheme) private var scheme
    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }
    private var column: CGFloat { width / 7 }

    var body: some View {
        if onHome {
            stack(base: false)
                .accessibilityHidden(true)
                .allowsHitTesting(false)
        } else {
            own
        }
    }

    private var own: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(capitalize(monthName(layers.month, lang)))
                .font(.system(size: 30, weight: .bold))
                .tracking(-0.6)
                .foregroundStyle(Theme.foreground.color)
                .padding(.horizontal, 12)
                .padding(.vertical, 4)
            HStack(spacing: 0) {
                ForEach([1, 2, 3, 4, 5, 6, 0], id: \.self) { d in
                    Text(CasyStrings.planWeekdayShort(d))
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Theme.mutedForeground.color)
                        .frame(width: column)
                }
            }
            .padding(.bottom, 4)
            stack(base: true)
        }
        .padding(.top, 44)
        .accessibilityHidden(true)
        .allowsHitTesting(false)
    }

    /// The month under the pile (`base`), each calendar thrown onto it, and the lit days.
    private func stack(base: Bool) -> some View {
            ZStack(alignment: .top) {
                if !base {
                    Color.clear.frame(width: width, height: 1)
                } else if let home = layers.homeWeeks {
                    // My calendar's own month, as the web throws onto it.
                    PileMonth(
                        weeks: home, color: HomeModel.shared.color, shine: [], width: width, dark: scheme == .dark,
                        home: true)
                } else {
                    PileMonth(
                        weeks: layers.yourWeeks, color: { _ in yoursColor }, shine: [], width: width,
                        dark: scheme == .dark)
                }
                ForEach(Array(layers.friends.enumerated()), id: \.element.id) { k, friend in
                    let t = k - model.placedCount
                    ThrownLayer(
                        k: k,
                        land: friend.placed
                            ? PileLand(at: 0, duration: 0)
                            : model.timeline.lands.indices.contains(t) ? model.timeline.lands[t] : PileLand(at: 0, duration: 0.3),
                        placed: friend.placed,
                        go: model.throwing,
                        landed: model.landedNow, pressed: model.phase >= .pressed, revealed: model.phase >= .revealed,
                        alpha: layerAlpha(layers.friends.count), name: friend.name, color: friend.color, width: width
                    ) {
                        PileMonth(
                            weeks: friend.weeks, color: { _ in friend.color }, shine: [],
                            width: width, dark: scheme == .dark, pressed: model.phase >= .pressed)
                    }
                }
                // What shines through: the days free for everyone.
                PileMonth(
                    weeks: layers.emptyWeeks, color: { _ in "" },
                    shine: layers.shine.subtracting(model.taken), width: width, dark: scheme == .dark, numbers: false
                )
                .opacity(model.phase >= .revealed ? 1 : 0)
                .scaleEffect(model.phase >= .revealed ? 1 : 0.98)
                .animation(.easeOut(duration: 0.5), value: model.phase >= .revealed)
            }
            // Where its weeks are on the screen, for the shared calendar to take their place.
            .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { frame in
                if model.weeksFrame != frame { model.weeksFrame = frame }
            }
    }
}

/// The pile once pressed, as one calendar (the web's SharedCalendar): everyone's busy
/// time together over every month the listed dates are in, the free days lit, on the
/// sheets' glass. Moved by `scroll` alone (never by hand): the list scrolls it to lift
/// each date out. It grows out of the pile it takes over from: at first exactly the
/// pressed sheets' card, then its top rises into a band naming the month in view (over
/// My calendar's own name, which may be another month by then) and its bottom reaches
/// down the screen.
private struct SharedCalendar: View {
    let layers: PileLayers
    let weeks: CGRect
    let scroll: CGFloat
    let taken: Set<Int64>
    /// From its band's top to the screen's bottom edge.
    let room: CGFloat

    @State private var grown = 0.0

    var body: some View {
        SharedCard(layers: layers, weeks: weeks, scroll: scroll, taken: taken, room: room, grown: grown)
            .onAppear {
                withAnimation(.timingCurve(0.3, 0.9, 0.3, 1, duration: 0.6).delay(0.1)) { grown = 1 }
            }
            .accessibilityHidden(true)
            .allowsHitTesting(false)
    }
}

/// The shared calendar at `grown` (0: the pile's card, 1: band and all, to the bottom).
private struct SharedCard: View, Animatable {
    let layers: PileLayers
    let weeks: CGRect
    let scroll: CGFloat
    let taken: Set<Int64>
    let room: CGFloat
    var grown: Double

    var animatableData: Double {
        get { grown }
        set { grown = newValue }
    }

    @Environment(\.colorScheme) private var scheme
    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    /// The month whose first week has come up under the band.
    private var named: Int64 {
        var top = 0.0
        var current = layers.months.first ?? layers.month
        for (m, month) in layers.months.enumerated() where m < layers.sharedWeeks.count {
            if top <= Double(scroll) + 2 { current = month }
            top += Double(CGFloat(layers.sharedWeeks[m].count) * pileWeekHeight)
        }
        return current
    }

    var body: some View {
        let g = CGFloat(min(max(grown, 0), 1))
        let colors = Dictionary(layers.friends.map { ($0.profileId, $0.color) }, uniquingKeysWith: { a, _ in a })
        let shine = layers.shine.subtracting(taken)
        // The card: the sheets' own (their corners, edge and glass), growing.
        let top = pileBandHeight * (1 - g)
        let bottom = pileBandHeight + weeks.height + max(0, room - pileBandHeight - weeks.height) * g
        let corner = 28 * (1 - g)
        let shape = UnevenRoundedRectangle(
            topLeadingRadius: 28, bottomLeadingRadius: corner, bottomTrailingRadius: corner, topTrailingRadius: 28,
            style: .continuous)
        ZStack(alignment: .topLeading) {
            shape
                .fill(Theme.card.color.opacity(pileOpacity))
                .overlay { shape.strokeBorder(Color.white.opacity(0.5), lineWidth: 1) }
                .frame(width: weeks.width, height: bottom - top)
                .offset(y: top)
            // The weeks, where the pile's lay, scrolled within the card.
            VStack(spacing: 0) {
                ForEach(Array(layers.months.enumerated()), id: \.element) { m, _ in
                    if m < layers.sharedWeeks.count {
                        PileMonth(
                            weeks: layers.sharedWeeks[m], color: { colors[$0] ?? "" }, shine: shine, width: weeks.width,
                            dark: scheme == .dark)
                    }
                }
            }
            .offset(y: -scroll)
            .frame(width: weeks.width, height: max(0, bottom - pileBandHeight), alignment: .top)
            .clipShape(UnevenRoundedRectangle(bottomLeadingRadius: corner, bottomTrailingRadius: corner))
            .offset(y: pileBandHeight)
            band.opacity(Double(g)).frame(width: weeks.width, height: pileBandHeight, alignment: .bottomLeading)
        }
        .frame(width: weeks.width, alignment: .topLeading)
    }

    private var band: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(capitalize(monthName(named, lang)))
                .font(.system(size: 30, weight: .bold))
                .tracking(-0.75)
                .foregroundStyle(Theme.foreground.color)
                .lineLimit(1)
                // Ending before the list's own line and the close button, in the same row.
                .minimumScaleFactor(0.6)
                .frame(maxWidth: max(0, weeks.width - 250), alignment: .leading)
                .frame(height: 37.5)
                .padding(.horizontal, 12)
                .padding(.vertical, 4)
                .contentTransition(.numericText())
                .animation(.easeOut(duration: 0.2), value: named)
            HStack(spacing: 0) {
                ForEach(0..<7, id: \.self) { c in
                    let day = wallTime(2026, 0, 5 + c, 12, appTimeZone)
                    Text(verbatim: String(weekdayShortName(day, lang).prefix(1)).uppercased())
                        .frame(maxWidth: .infinity)
                        .foregroundStyle(c >= 5 ? Theme.mutedForeground.color : Theme.foreground.color)
                }
            }
            .font(.system(size: 12, weight: .medium))
            .frame(height: 24)
            .padding(.bottom, 6)
        }
    }
}

/// One friend's calendar, tossed onto the pile (the web's ThrownLayer): from
/// high above to the side, falling faster into the hit, a skid, a hop, and
/// settling crooked; knocked a little by each one landing after it; pressed
/// straight; its name gone once the free days light up. Its shadow on the
/// table (the web's) closes in and darkens as it comes down.
///
/// Moved as the welcome's thrown paper is: one number, 0 to 1 over the flight
/// and the hit, animated straight, and the pose worked out from it each frame
/// (`TossPose`). With keyframe animations the fall was never drawn: each sheet
/// appeared already lying where it landed.
private struct ThrownLayer<Content: View>: View {
    let k: Int
    let land: PileLand
    /// On the pile already (#240): lying as it landed, never thrown.
    var placed = false
    /// The throw's clock started (PileModel.throwing): drawn, so ready to move.
    let go: Bool
    let landed: Int
    let pressed: Bool
    let revealed: Bool
    let alpha: Double
    let name: String
    let color: String
    let width: CGFloat
    @ViewBuilder let content: () -> Content

    /// The throw, 0 to 1 over the fall and the hit; and pressed straight, 0 to 1.
    @State private var flight = 0.0
    @State private var press = 0.0
    @Environment(\.colorScheme) private var scheme
    private var dark: Bool { scheme == .dark }

    private var hit: Double { land.duration / (land.duration + PileTiming.impact) }

    var body: some View {
        let tilt = sheetTilt(k + 1)
        let side = throwSide(k)
        let from = side * Double(width) * 0.55
        let knock = jostle(k, landed)
        sheet
            .offset(x: pressed ? 0 : knock.x)
            .rotationEffect(.degrees(pressed ? 0 : knock.rotate))
            .animation(.spring(response: 0.25, dampingFraction: pressed ? 0.9 : 0.4), value: landed)
            .modifier(
                TossPose(
                    from: .init(x: from, y: -150, rotate: side * -14, scale: 1.6, opacity: 0),
                    past: .init(x: tilt.x - side * 7, y: tilt.y + 3, rotate: tilt.rotate - side * 1.5, scale: 0.975, opacity: 1),
                    back: .init(x: tilt.x + side * 2, y: tilt.y - 8, rotate: tilt.rotate + side * 0.6, scale: 1.012, opacity: 1),
                    rest: .init(x: tilt.x, y: tilt.y, rotate: tilt.rotate, scale: 1, opacity: 1),
                    straight: .init(x: 0, y: 0, rotate: 0, scale: 1, opacity: 1),
                    hit: hit, flight: flight, press: press, anchor: UnitPoint(x: 0.5, y: 0.35))
            )
            // The shadow on the table, faint and wide while the sheet is high. Behind the
            // sheet and exactly its size: side by side in a stack, the stretchable shadow
            // took all the room under the month, and the sheet sat in its middle, a week low.
            .background {
                PileShadow()
                    .modifier(
                        TossPose(
                            from: .init(x: from * 0.4, y: 50, rotate: side * -6, scale: 1.3, opacity: 0),
                            past: .init(x: tilt.x - side * 7, y: tilt.y + 12, rotate: tilt.rotate, scale: 0.99, opacity: 0.38),
                            back: .init(x: tilt.x + side * 2, y: tilt.y + 14, rotate: tilt.rotate, scale: 1.01, opacity: 0.3),
                            rest: .init(x: tilt.x, y: tilt.y + 12, rotate: tilt.rotate, scale: 1, opacity: 0.28),
                            straight: .init(x: 0, y: 12, rotate: 0, scale: 1, opacity: 0.28),
                            hit: hit, flight: flight, press: press, anchor: .center)
                    )
                    .opacity(revealed ? 0 : 1)
                    .animation(.easeOut(duration: 0.3), value: revealed)
            }
            .task(id: go) {
                guard go else { return }
                if placed {
                    flight = 1
                    return
                }
                // Started late by the animation clock itself, not a timer: a busy moment can't
                // bunch the first throws together and flatten their quickening.
                withAnimation(.linear(duration: land.duration + PileTiming.impact).delay(land.at)) { flight = 1 }
            }
            .onChange(of: pressed) { _, now in
                withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) { press = now ? 1 : 0 }
            }
    }

    private var sheet: some View {
        ZStack(alignment: .topTrailing) {
            content()
            HStack(spacing: 6) {
                Circle().fill(Color(rgb: color)).frame(width: 8, height: 8)
                Text(name).font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.foreground.color)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background { PileFrost(shape: Capsule(), dark: dark) }
            .padding(.trailing, 12)
            .padding(.top, 16)
            .opacity(revealed ? 0 : 1)
            .animation(.easeOut(duration: 0.3), value: revealed)
        }
        .background(Theme.card.color.opacity(alpha), in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 28, style: .continuous).strokeBorder(Color.white.opacity(0.5), lineWidth: 1)
        }
    }
}

/// The web's `glass` drawn still: its tint, its sheen from the top left corner and its
/// bright edge, for what moves. Apple's live glass on the name of a sheet that is
/// scaled, turned and faded as it flies swelled into a bubble far bigger than the
/// name; on the list's rows changing places it was redrawn every frame.
private struct PileFrost<S: InsettableShape>: View {
    let shape: S
    let dark: Bool

    var body: some View {
        shape
            .fill(dark ? Color(red: 32 / 255, green: 32 / 255, blue: 36 / 255).opacity(0.9) : Color.white.opacity(0.82))
            .overlay {
                shape.fill(
                    LinearGradient(
                        stops: [.init(color: .white.opacity(dark ? 0.08 : 0.5), location: 0), .init(color: .clear, location: 0.45)],
                        startPoint: .topLeading, endPoint: .bottomTrailing))
            }
            .overlay { shape.strokeBorder(Color.white.opacity(dark ? 0.16 : 0.85), lineWidth: 1) }
    }
}

/// A sheet's soft shadow on the table: blurred once into a picture, then only moved
/// and stretched (its edges kept, so the corners stay round). Blurred afresh each
/// frame, it held the whole fall still.
private struct PileShadow: View {
    /// How far the blur reaches past the sheet's edge, in points.
    static let reach: CGFloat = 50

    /// Drawn with Core Graphics' own shadow, at once: SwiftUI's ImageRenderer with a
    /// blur took seconds the first time, and the screen stayed blank meanwhile. A
    /// black rounded square drawn far outside the picture, its shadow cast into it.
    @MainActor private static let picture: UIImage? = {
        let scale: CGFloat = 2
        let side = (160 + 2 * reach) * scale
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let drawn = UIGraphicsImageRenderer(size: CGSize(width: side, height: side), format: format).image { context in
            let away: CGFloat = 10_000
            let square = CGRect(x: reach * scale, y: reach * scale - away, width: 160 * scale, height: 160 * scale)
            // The shadow's offset ignores the drawing's scale: in pixels, as everything here.
            context.cgContext.setShadow(offset: CGSize(width: 0, height: away), blur: 40 * scale, color: UIColor.black.cgColor)
            UIColor.black.setFill()
            UIBezierPath(roundedRect: square, cornerRadius: 28 * scale).fill()
        }
        return drawn.cgImage.map { UIImage(cgImage: $0, scale: scale, orientation: .up) }
    }()

    var body: some View {
        if let picture = Self.picture {
            // The corners and the blur around them stay as drawn; the middle stretches.
            let edge = Self.reach + 30
            Image(uiImage: picture)
                .resizable(capInsets: EdgeInsets(top: edge, leading: edge, bottom: edge, trailing: edge), resizingMode: .stretch)
                .padding(-Self.reach)
        }
    }
}

/// Where a thrown sheet (or its shadow) is: falling faster and faster into the hit
/// (the web's [0.55, 0, 1, 0.45]), the skid past its spot easing out, the hop back
/// easing in and out (PILE_TIMING's times: the hit, then 40 % and 60 % of the rest);
/// then from its crooked rest to straight as `press` goes to 1.
private struct TossPose: ViewModifier, Animatable {
    struct Pose {
        var x, y, rotate, scale, opacity: Double

        func to(_ o: Pose, _ t: Double) -> Pose {
            Pose(
                x: x + (o.x - x) * t, y: y + (o.y - y) * t, rotate: rotate + (o.rotate - rotate) * t,
                scale: scale + (o.scale - scale) * t, opacity: opacity + (o.opacity - opacity) * t)
        }
    }

    let from: Pose
    let past: Pose
    let back: Pose
    let rest: Pose
    let straight: Pose
    let hit: Double
    var flight: Double
    var press: Double
    let anchor: UnitPoint

    var animatableData: AnimatablePair<Double, Double> {
        get { AnimatablePair(flight, press) }
        set {
            flight = newValue.first
            press = newValue.second
        }
    }

    private static let fall = UnitCurve.bezier(startControlPoint: UnitPoint(x: 0.55, y: 0), endControlPoint: UnitPoint(x: 1, y: 0.45))

    func body(content: Content) -> some View {
        let t = min(max(flight, 0), 1)
        let skid = hit + (1 - hit) * 0.4
        let pose: Pose =
            t < hit
            ? from.to(past, Self.fall.value(at: t / max(hit, 0.0001)))
            : t < skid
                ? past.to(back, UnitCurve.easeOut.value(at: (t - hit) / max(skid - hit, 0.0001)))
                : back.to(rest, UnitCurve.easeInOut.value(at: (t - skid) / max(1 - skid, 0.0001)))
        let p = pose.to(straight, min(max(press, 0), 1))
        // Never quite 0 before its throw: drawn ahead, unseen, so the throw only moves it.
        content
            .scaleEffect(p.scale, anchor: anchor)
            .rotationEffect(.degrees(p.rotate), anchor: anchor)
            .offset(x: p.x, y: p.y)
            .opacity(t == 0 ? 0.002 : p.opacity)
    }
}

/// A month as the home page draws it, as a picture: the weeks, each day's
/// number (green for a day free for everyone), and the bars under them.
struct PileMonth: View {
    /// The month laid out (`PileMonth.weeks`), worked out once by whoever holds it.
    let weeks: [HomeWeek]
    let color: (String) -> String
    let shine: Set<Int64>
    let width: CGFloat
    let dark: Bool
    var pressed = false
    var numbers = true
    /// How much the lit days show: drawn in the same rows as the numbers, so
    /// they can never drift from their days while the month moves.
    var shineOpacity: Double = 1
    /// Drawn as My calendar draws it: the items as named chips, today in orange.
    var home = false

    private var column: CGFloat { width / 7 }

    init(
        weeks: [HomeWeek], color: @escaping (String) -> String, shine: Set<Int64>, width: CGFloat, dark: Bool,
        pressed: Bool = false, numbers: Bool = true, shineOpacity: Double = 1, home: Bool = false
    ) {
        self.weeks = weeks
        self.color = color
        self.shine = shine
        self.width = width
        self.dark = dark
        self.pressed = pressed
        self.numbers = numbers
        self.shineOpacity = shineOpacity
        self.home = home
    }

    /// A month laid out as it is made (the welcome's few): the pile lays its own out once.
    init(
        month: Int64, items: [MonthItem], color: @escaping (String) -> String, shine: Set<Int64>, width: CGFloat,
        dark: Bool, pressed: Bool = false, numbers: Bool = true, shineOpacity: Double = 1
    ) {
        self.init(
            weeks: Self.weeks(month, items), color: color, shine: shine, width: width, dark: dark, pressed: pressed,
            numbers: numbers, shineOpacity: shineOpacity)
    }

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(weeks.enumerated()), id: \.offset) { w, week in
                let middle = Double(weeks.count - 1) / 2
                let away = abs(Double(w) - middle)
                WeekPicture(
                    week: week, column: column, color: color, shine: shine, dark: dark, numbers: numbers,
                    shineOpacity: shineOpacity, home: home)
                    .keyframeAnimator(initialValue: 0.0, trigger: pressed) { view, y in
                        view.offset(y: y)
                    } keyframes: { _ in
                        KeyframeTrack {
                            LinearKeyframe(0, duration: max(away * 0.08, 0.01))
                            CubicKeyframe(pressed ? 5 * (1 - away / (middle + 1)) : 0, duration: 0.27)
                            CubicKeyframe(0, duration: 0.28)
                        }
                    }
            }
        }
        .frame(width: width)
    }

    static func weeks(_ month: Int64, _ items: [MonthItem]) -> [HomeWeek] {
        let local = localDate(month, appTimeZone)
        let layout = monthLayout(local.year, local.month, appTimeZone)
        return layout.weeks.enumerated().map { w, week in
            let days = week.map(\.date)
            return HomeWeek(
                id: days[0], days: week, number: layout.weekNumbers[w],
                layout: layoutWeek(items, days: days, weekEnd: addDays(days[6], 1, appTimeZone), lanes: monthLanes))
        }
    }
}

struct WeekPicture: View {
    let week: HomeWeek
    let column: CGFloat
    let color: (String) -> String
    let shine: Set<Int64>
    let dark: Bool
    let numbers: Bool
    var shineOpacity: Double = 1
    /// As My calendar's WeekRow: named chips, the "+2" of what doesn't fit, today in orange.
    var home = false

    private var first: Int { week.days.firstIndex(where: \.inMonth) ?? 0 }
    private var last: Int { week.days.lastIndex(where: \.inMonth) ?? 6 }

    var body: some View {
        VStack(spacing: 0) {
            Rectangle().fill(Theme.border.color.opacity(numbers ? 0.7 : 0)).frame(height: 1)
            HStack(spacing: 0) {
                ForEach(Array(week.days.enumerated()), id: \.offset) { c, day in
                    ZStack {
                        if day.inMonth {
                            if numbers {
                                let today = home && day.date == startOfDay(Native.now, appTimeZone)
                                Text(verbatim: "\(day.dayOfMonth)")
                                    .font(.system(size: 18, weight: today ? .semibold : .regular))
                                    .foregroundStyle(
                                        today ? .white : c >= 5 ? Theme.mutedForeground.color : Theme.foreground.color)
                                    .frame(width: 32, height: 32)
                                    .background(today ? Theme.cta.color : .clear, in: Circle())
                            }
                            if shine.contains(day.date) {
                                Text(verbatim: "\(day.dayOfMonth)")
                                    .font(.system(size: 18, weight: .semibold))
                                    .foregroundStyle(Color.white)
                                    .frame(width: 32, height: 32)
                                    .background {
                                        Circle()
                                            .fill(Theme.emerald500.color)
                                            .shadow(color: Theme.emerald500.color.opacity(0.7), radius: 7)
                                    }
                                    .opacity(shineOpacity)
                                    .animation(.easeOut(duration: 0.6), value: shineOpacity)
                            }
                        }
                    }
                    .frame(width: column, height: 40)
                }
            }
            ZStack(alignment: .topLeading) {
                ForEach(Array(week.layout.placed.enumerated()), id: \.offset) { _, p in
                    if home { chip(p) } else { bar(p) }
                }
                if home {
                    ForEach(0..<7, id: \.self) { c in
                        if week.layout.hidden[c] > 0 && week.days[c].inMonth {
                            Text(verbatim: "+\(week.layout.hidden[c])")
                                .font(.system(size: 10))
                                .foregroundStyle(Theme.mutedForeground.color)
                                .frame(width: column)
                                .offset(x: column * CGFloat(c), y: CGFloat(monthLanes) * monthLanePoints)
                        }
                    }
                }
            }
            .frame(width: column * 7, height: CGFloat(monthLanes) * monthLanePoints + monthMorePoints, alignment: .topLeading)
            .clipped()
        }
        // The week's number in its corner, as the web's MonthLayer.
        .overlay(alignment: .topLeading) {
            if numbers {
                Text(verbatim: "\(week.number)")
                    .font(.system(size: 10).monospacedDigit())
                    .foregroundStyle(Theme.mutedForeground.color)
                    .padding(.leading, 4)
                    .padding(.top, 3)
            }
        }
    }

    /// An item as My calendar's chip (HomeScreen's WeekRow): its name on its calendar's tint.
    @ViewBuilder private func chip(_ p: PlacedItem) -> some View {
        let from = max(p.from, first)
        let to = min(p.to, last)
        if from <= to {
            let before = p.continuesBefore || from > p.from
            let after = p.continuesAfter || to < p.to
            let left = column * CGFloat(from) + (before ? 0 : 2)
            let width = column * CGFloat(to - from + 1) - (before ? 0 : 2) - (after ? 0 : 2)
            let shape = UnevenRoundedRectangle(
                topLeadingRadius: before ? 0 : 4, bottomLeadingRadius: before ? 0 : 4,
                bottomTrailingRadius: after ? 0 : 4, topTrailingRadius: after ? 0 : 4)
            let pencil = p.item.pencil == true
            let rgb = color(p.item.calendarId)
            Text(verbatim: p.item.label)
                .font(.system(size: 11, weight: .semibold))
                .lineLimit(1)
                .frame(height: 16)
                .padding(.horizontal, pencil ? 5 : 4)
                .padding(.top, pencil ? 1 : 0)
                .frame(width: max(0, width), height: monthLanePoints - 3, alignment: .topLeading)
                .foregroundStyle(pencil ? Theme.primary.color : Color(rgb: CasyCore.shade(rgb, dark: dark)))
                .background {
                    if pencil {
                        shape.fill(Theme.primary.color.opacity(0.1))
                            .overlay(shape.strokeBorder(Theme.primary.color, style: StrokeStyle(lineWidth: 1, dash: [3, 2])))
                    } else {
                        shape.fill(Color(rgb: CasyCore.tint(rgb, dark: dark)))
                    }
                }
                .offset(x: left, y: CGFloat(p.lane) * monthLanePoints)
        }
    }

    @ViewBuilder private func bar(_ p: PlacedItem) -> some View {
        let from = max(p.from, first)
        let to = min(p.to, last)
        if from <= to {
            let before = p.continuesBefore || from > p.from
            let after = p.continuesAfter || to < p.to
            let left = column * CGFloat(from) + (before ? 0 : 2)
            let width = column * CGFloat(to - from + 1) - (before ? 0 : 2) - (after ? 0 : 2)
            let shape = UnevenRoundedRectangle(
                topLeadingRadius: before ? 0 : 4, bottomLeadingRadius: before ? 0 : 4,
                bottomTrailingRadius: after ? 0 : 4, topTrailingRadius: after ? 0 : 4)
            shape.fill(Color(rgb: CasyCore.tint(color(p.item.calendarId), dark: dark)))
                .frame(width: max(0, width), height: monthLanePoints - 3)
                .offset(x: left, y: CGFloat(p.lane) * monthLanePoints)
        }
    }
}

extension View {
    /// The pile's glass: Apple's own on iOS 26, not taking taps itself; `on` false: none (yet).
    @ViewBuilder func pileGlass<S: Shape>(_ shape: S, on: Bool = true) -> some View {
        if #available(iOS 26, *) {
            glassEffect(on ? .regular : .identity, in: shape)
        } else {
            background(.regularMaterial.opacity(on ? 1 : 0), in: shape)
        }
    }
}

/// One display frame, then `action` (`PileModel.drawn`).
@MainActor
private final class FrameTick: NSObject {
    private var link: CADisplayLink?
    private let action: () -> Void
    private static var live: Set<FrameTick> = []

    private init(_ action: @escaping () -> Void) { self.action = action }

    static func once(_ action: @escaping () -> Void) {
        let tick = FrameTick(action)
        live.insert(tick)
        let link = CADisplayLink(target: tick, selector: #selector(fire))
        tick.link = link
        link.add(to: .main, forMode: .common)
    }

    @objc private func fire() {
        link?.invalidate()
        link = nil
        Self.live.remove(self)
        action()
    }
}
