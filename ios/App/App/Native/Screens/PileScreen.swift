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
}

/// What the pile shows: the month (the first date's), the months the list
/// reaches into, the days free for everyone, and whose calendars are thrown.
struct PileLayers: Equatable {
    let month: Int64
    let months: [Int64]
    let shine: Set<Int64>
    let friends: [PileFriend]
    let yours: [MonthItem]
}

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
    private(set) var timeline = pileTimeline(0, start: PileTiming.inPlace)
    /// The dates in the list; nil until worked out, or when there is none.
    private(set) var dates: [CheckedDate]?
    /// The dates have been worked out (there may be none).
    private(set) var ready = false
    private(set) var arrived: Set<String> = []
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

    /// From the top: the calendars thrown, pressed, the dates lifted and checked.
    func start() {
        run?.cancel()
        phase = .landing
        landed = 0
        layers = nil
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
            await throwThem()
            guard !Task.isCancelled else { return }
            await lift()
        }
    }

    func stop() { run?.cancel() }

    /// The pool, the scores, the list and the layers, worked out off the main thread.
    private func prepare(_ found: MultiDayResult, _ participants: [Participant]) async {
        let search = plan.search
        let extraSearches = plan.extraSearches
        let window = plan.searchWindow
        let extras = plan.extras
        let now = Native.now
        let zone = zone
        profile = await fetchProfile()
        let profile = profile
        guard let slot = found.slot else {
            widen = await plan.widenings()
            ready = true
            layers = Self.layers(participants, search, window, [], you: plan.you, before: plan.again?.before, zone)
            timeline = pileTimeline(thrownCount, start: PileTiming.inPlace)
            return
        }
        let first = FoundDate(slot: slot, conflicts: found.conflicts, absent: found.absent)
        pool = await Task.detached(priority: .userInitiated) {
            findPoolAcross(
                participants, [search] + extraSearches,
                CandidateOptions(
                    first: first, end: window.end, count: extras.dateCount, profile: profile, now: now,
                    everyTime: !extraSearches.isEmpty), zone)
        }.value
        // The layers from the dates' starts alone, so they are thrown at once.
        let preliminary = Self.checked(
            first, pool, participants, search, window: window, extras: extras, scores: [:], counted: 0, profile: profile,
            you: plan.you, waitingFor: !(plan.people?.waitingFor.isEmpty ?? true), now: now,
            everyTime: !extraSearches.isEmpty)
        layers = Self.layers(
            participants, search, window, preliminary.map(\.date.slot.start), you: plan.you, before: plan.again?.before, zone)
        timeline = pileTimeline(thrownCount, start: PileTiming.inPlace)
        // How well each date suits the group (#119), asked while the calendars are thrown.
        Task {
            await score(first)
            dates = Self.checked(
                first, pool, participants, search, window: window, extras: extras, scores: scores, counted: counted, profile: profile,
                you: plan.you, waitingFor: !(plan.people?.waitingFor.isEmpty ?? true), now: now,
            everyTime: !extraSearches.isEmpty)
            ready = true
        }
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
        for item in dates {
            guard !Task.isCancelled else { return }
            withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) {
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
                placed: before?.contains(s.profileId) ?? false)
        }
        // Those on the pile already first, so the ones thrown now land on top.
        friends = friends.filter(\.placed) + friends.filter { !$0.placed }
        return PileLayers(
            month: first, months: months, shine: shine, friends: friends, yours: you.map { items($0) } ?? [])
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
                // The home page shows through until the pile is worked out (a moment).
                Theme.background.color.ignoresSafeArea()
                    .opacity(model.layers == nil && model.waiting == nil ? 0 : 1)
                    .animation(.easeOut(duration: 0.25), value: model.layers == nil)
                if let layers = model.layers {
                    PileTable(layers: layers, width: geo.size.width)
                        .padding(.top, 8)
                        .blur(radius: model.phase >= .ranking ? 3 : 0)
                        .opacity(model.phase >= .ranking ? 0.6 : 1)
                        .transition(.opacity)
                }
                if listing { list }
                closeButton
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
                arrived: model.arrived.contains(item.id), open: open == item.id, lang: lang
            ) {
                withAnimation(.easeInOut(duration: 0.25)) { open = open == item.id ? nil : item.id }
            }
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
    let open: Bool
    let lang: Lang
    let toggle: () -> Void

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
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        // The green of the circle it came out of, fading into glass.
        .background {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(Theme.emerald500.color)
                .opacity(arrived ? 0 : 1)
                .animation(.easeOut(duration: 0.35).delay(0.25), value: arrived)
        }
        .pileGlass(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .opacity(arrived ? 1 : 0)
        .scaleEffect(arrived ? 1 : 0.35, anchor: .center)
        .offset(y: arrived ? 0 : 40)
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

    private let model = PileModel.shared
    @Environment(\.colorScheme) private var scheme
    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }
    private var column: CGFloat { width / 7 }

    var body: some View {
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
            ZStack(alignment: .top) {
                PileMonth(
                    month: layers.month, items: layers.yours, color: { _ in yoursColor }, shine: [], width: width,
                    dark: scheme == .dark)
                ForEach(Array(layers.friends.enumerated()), id: \.element.id) { k, friend in
                    let t = k - model.placedCount
                    ThrownLayer(
                        k: k,
                        land: friend.placed
                            ? PileLand(at: 0, duration: 0)
                            : model.timeline.lands.indices.contains(t) ? model.timeline.lands[t] : PileLand(at: 0, duration: 0.3),
                        placed: friend.placed,
                        landed: model.landedNow, pressed: model.phase >= .pressed, revealed: model.phase >= .revealed,
                        alpha: layerAlpha(layers.friends.count), name: friend.name, color: friend.color, width: width
                    ) {
                        PileMonth(
                            month: layers.month, items: friend.items, color: { _ in friend.color }, shine: [],
                            width: width, dark: scheme == .dark, pressed: model.phase >= .pressed)
                    }
                }
                // What shines through: the days free for everyone.
                PileMonth(
                    month: layers.month, items: [], color: { _ in "" },
                    shine: layers.shine.subtracting(model.taken), width: width, dark: scheme == .dark, numbers: false
                )
                .opacity(model.phase >= .revealed ? 1 : 0)
                .scaleEffect(model.phase >= .revealed ? 1 : 0.98)
                .animation(.easeOut(duration: 0.5), value: model.phase >= .revealed)
            }
        }
        .padding(.top, 44)
        .accessibilityHidden(true)
        .allowsHitTesting(false)
    }
}

/// One friend's calendar, tossed onto the pile (the web's ThrownLayer): from
/// high above to the side, falling faster into the hit, a skid, a hop, and
/// settling crooked; knocked a little by each one landing after it; pressed
/// straight; its name gone once the free days light up.
private struct ThrownLayer<Content: View>: View {
    let k: Int
    let land: PileLand
    /// On the pile already (#240): lying as it landed, never thrown.
    var placed = false
    let landed: Int
    let pressed: Bool
    let revealed: Bool
    let alpha: Double
    let name: String
    let color: String
    let width: CGFloat
    @ViewBuilder let content: () -> Content

    @State private var thrown = false

    private struct Pose {
        var x: Double = 0
        var y: Double = 0
        var rotate: Double = 0
        var scale: Double = 1
        var opacity: Double = 0
    }

    var body: some View {
        let tilt = sheetTilt(k + 1)
        let side = throwSide(k)
        let from = side * Double(width) * 0.55
        let total = land.duration + PileTiming.impact
        let hit = land.duration / total
        let knock = jostle(k, landed)
        ZStack(alignment: .topTrailing) {
            content()
            HStack(spacing: 6) {
                Circle().fill(Color(rgb: color)).frame(width: 8, height: 8)
                Text(name).font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.foreground.color)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .pileGlass(Capsule())
            .padding(.trailing, 12)
            .padding(.top, 16)
            .opacity(revealed ? 0 : 1)
            .animation(.easeOut(duration: 0.3), value: revealed)
        }
        .background(Theme.card.color.opacity(alpha), in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 28, style: .continuous).strokeBorder(Color.white.opacity(0.5), lineWidth: 1)
        }
        .shadow(color: .black.opacity(revealed ? 0 : 0.18), radius: 16, y: 10)
        .offset(x: pressed ? 0 : knock.x)
        .rotationEffect(.degrees(pressed ? 0 : knock.rotate))
        .animation(.spring(response: 0.25, dampingFraction: pressed ? 0.9 : 0.4), value: landed)
        .keyframeAnimator(initialValue: Pose(), trigger: thrown) { view, pose in
            view
                .offset(x: pressed ? 0 : pose.x, y: pressed ? 0 : pose.y)
                .rotationEffect(.degrees(pressed ? 0 : pose.rotate), anchor: UnitPoint(x: 0.5, y: 0.35))
                .scaleEffect(pressed ? 1 : pose.scale)
                .opacity(thrown ? pose.opacity : 0)
        } keyframes: { _ in
            let a = total * hit
            let b = total * (1 - hit) * 0.4
            let c = total * (1 - hit) * 0.6
            // On the pile already (#240): every key its resting pose, so it never moves.
            let at = { (moving: Double, rest: Double) in placed ? rest : moving }
            KeyframeTrack(\.x) {
                LinearKeyframe(at(from, tilt.x), duration: 0)
                CubicKeyframe(at(tilt.x - side * 7, tilt.x), duration: a)
                CubicKeyframe(at(tilt.x + side * 2, tilt.x), duration: b)
                CubicKeyframe(tilt.x, duration: c)
            }
            KeyframeTrack(\.y) {
                LinearKeyframe(at(-150, tilt.y), duration: 0)
                CubicKeyframe(at(tilt.y + 3, tilt.y), duration: a)
                CubicKeyframe(at(tilt.y - 8, tilt.y), duration: b)
                CubicKeyframe(tilt.y, duration: c)
            }
            KeyframeTrack(\.rotate) {
                LinearKeyframe(at(side * -14, tilt.rotate), duration: 0)
                CubicKeyframe(at(tilt.rotate - side * 1.5, tilt.rotate), duration: a)
                CubicKeyframe(at(tilt.rotate + side * 0.6, tilt.rotate), duration: b)
                CubicKeyframe(tilt.rotate, duration: c)
            }
            KeyframeTrack(\.scale) {
                LinearKeyframe(at(1.6, 1), duration: 0)
                CubicKeyframe(at(0.975, 1), duration: a)
                CubicKeyframe(at(1.012, 1), duration: b)
                CubicKeyframe(1, duration: c)
            }
            KeyframeTrack(\.opacity) {
                LinearKeyframe(at(0, 1), duration: 0)
                LinearKeyframe(1, duration: a * 0.12)
                LinearKeyframe(1, duration: total - a * 0.12)
            }
        }
        .animation(.spring(response: 0.45, dampingFraction: 0.85), value: pressed)
        .task {
            try? await Task.sleep(for: .milliseconds(Int(land.at * 1000)))
            thrown = true
        }
    }
}

/// A month as the home page draws it, as a picture: the weeks, each day's
/// number (green for a day free for everyone), and the bars under them.
struct PileMonth: View {
    let month: Int64
    let items: [MonthItem]
    let color: (String) -> String
    let shine: Set<Int64>
    let width: CGFloat
    let dark: Bool
    var pressed = false
    var numbers = true
    /// How much the lit days show: drawn in the same rows as the numbers, so
    /// they can never drift from their days while the month moves.
    var shineOpacity: Double = 1

    private var column: CGFloat { width / 7 }

    var body: some View {
        let weeks = Self.weeks(month, items)
        VStack(spacing: 0) {
            ForEach(Array(weeks.enumerated()), id: \.offset) { w, week in
                let middle = Double(weeks.count - 1) / 2
                let away = abs(Double(w) - middle)
                WeekPicture(
                    week: week, column: column, color: color, shine: shine, dark: dark, numbers: numbers,
                    shineOpacity: shineOpacity)
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
                                Text(verbatim: "\(day.dayOfMonth)")
                                    .font(.system(size: 18))
                                    .foregroundStyle(c >= 5 ? Theme.mutedForeground.color : Theme.foreground.color)
                                    .frame(width: 32, height: 32)
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
                ForEach(Array(week.layout.placed.enumerated()), id: \.offset) { _, p in bar(p) }
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
    /// The pile's glass: Apple's own on iOS 26, not taking taps itself.
    @ViewBuilder func pileGlass<S: Shape>(_ shape: S) -> some View {
        if #available(iOS 26, *) {
            glassEffect(.regular, in: shape)
        } else {
            background(.regularMaterial, in: shape)
        }
    }
}
