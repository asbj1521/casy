import CasyAPI
import CasyCore
import CasyUI
import SwiftUI

/// Every event you were asked about (#199), shared by the Aftaler sheet and
/// its screens: changes made here go to the page too (`dataChanged`).
@MainActor @Observable
final class EventsModel {
    static let shared = EventsModel()

    private(set) var events: [SuggestedEvent]?
    private(set) var failure: String?
    private var deciding: Task<Void, Never>?
    /// Asks the page to write the phone's calendar (the bridge sets it).
    var writeOnPhone: (() async -> Void)?

    func reset() {
        events = nil
        failure = nil
        deciding?.cancel()
    }

    private static var now: Int64 { Native.now }

    var groups: PhoneEventGroups? { events.map { phoneEventGroups($0, now: Self.now) } }

    func load() async {
        guard let api = await Native.api() else {
            failure = CasyStrings.eventsLoadFailed
            return
        }
        do {
            show(try await api.events(errorMessage: CasyStrings.eventsLoadFailed))
            failure = nil
        } catch {
            failure = CasyStrings.eventsLoadFailed
        }
    }

    func show(_ events: [SuggestedEvent]) {
        self.events = events
        askWhileDeciding()
        // The agreed dates still to come: their day slices read ahead, so each opens drawn.
        let now = Self.now
        DayOfCalendar.readAhead(
            Set(
                events.compactMap { e -> Int64? in
                    guard e.status == .scheduled, let date = e.currentDate, let end = parseInstant(date.end), end > now,
                        let start = parseInstant(date.start)
                    else { return nil }
                    return startOfDay(start, appTimeZone)
                }))
    }

    /// A vote everyone has answered, with a date nobody declined, is decided by
    /// the database the moment the last answer arrives (#74): ask a few times
    /// in quick succession until the decided date is here (useDecidingRefresh).
    private func askWhileDeciding() {
        guard (events ?? []).contains(where: Self.isDeciding), deciding == nil else { return }
        deciding = Task {
            defer { deciding = nil }
            for _ in 0..<6 {
                try? await Task.sleep(for: .milliseconds(1500))
                if Task.isCancelled { return }
                guard let api = await Native.api(), let fresh = try? await api.events() else { continue }
                events = fresh
                if !fresh.contains(where: Self.isDeciding) { return }
            }
        }
    }

    /// A vote everyone has answered with a date nobody declined: the database decides it now.
    private static func isDeciding(_ event: SuggestedEvent) -> Bool {
        event.status == .pending && isVote(event) && allAnswered(event, now: now) && leader(event, now: now) != nil
    }

    func cancel(_ id: String) async throws {
        guard let api = await Native.api() else { throw APIError.failed(status: 401, message: CasyStrings.eventsCancelFailed) }
        show(try await api.cancelEvent(id, errorMessage: CasyStrings.eventsCancelFailed))
        ProfileModel.shared.onChange?()
        LivePulse.shared.touched()
    }

    /// Your answer on one date; for an agreed vote, a no moves it for everyone (#74).
    /// Answers the outcome: "scheduled" when it settled the vote, "moved" when it moved the date.
    @discardableResult
    func answer(_ id: String, dateId: String, _ response: EventResponse) async throws -> String {
        guard let api = await Native.api() else { throw APIError.failed(status: 401, message: CasyStrings.eventsAnswerFailed) }
        let answer = try await api.answerDate(id, dateId: dateId, response: response, errorMessage: CasyStrings.eventsAnswerFailed)
        show(answer.events)
        ProfileModel.shared.onChange?()
        LivePulse.shared.touched()
        return answer.outcome
    }

    /// Into your primary calendar; one on this phone is written by the page
    /// right after, and the list is fetched again once it is in.
    func addToCalendar(_ id: String, choosing calendarId: String? = nil) async throws {
        guard let api = await Native.api() else { throw APIError.failed(status: 401, message: CasyStrings.addToCalendarFailed) }
        do {
            if let calendarId {
                _ = try await api.setPrimaryCalendar(calendarId, errorMessage: CasyStrings.addToCalendarSetPrimaryFailed)
            }
            let events = try await api.addToMyCalendar(id, errorMessage: CasyStrings.addToCalendarFailed)
            show(events)
            ProfileModel.shared.onChange?()
        LivePulse.shared.touched()
            let mine = events.first { $0.id == id }?.myCalendar
            if mine?.state == "adding", mine?.onPhone == true, let writeOnPhone {
                await writeOnPhone()
                await load()
            }
        } catch {
            // A failure still changed something (it is waiting to be added now).
            await load()
            throw error
        }
    }

    /// One of the vote's own changes (choose, deadline, settle, remind), then the list as it is now.
    func change(_ failure: String, _ action: (EdgeFunctions) async throws -> [SuggestedEvent]) async throws {
        guard let api = await Native.api() else { throw APIError.failed(status: 401, message: failure) }
        show(try await action(api))
        ProfileModel.shared.onChange?()
        LivePulse.shared.touched()
    }

    func leave(_ id: String) async throws {
        guard let api = await Native.api() else { throw APIError.failed(status: 401, message: CasyStrings.eventsLeaveFailed) }
        show(try await api.leaveEvent(id, errorMessage: CasyStrings.eventsLeaveFailed))
        ProfileModel.shared.onChange?()
        LivePulse.shared.touched()
    }
}

/// The Aftaler sheet opened by itself, from the home page's Aftaler button.
struct EventsSheet: View {
    let preferences: NativePreferences
    let onDone: () -> Void
    let leave: (LeavingProfile) -> Void
    /// Opened on this vote (back from searching it again, #240), or an agreed event
    /// (its chip in the day view, #202).
    var vote: String?
    @State private var path: [String] = []

    var body: some View {
        NavigationStack(path: $path) {
            EventsScreen(leave: leave)
                .navigationDestination(for: String.self) { id in
                    // An agreed event opens as one; a vote as its vote.
                    if EventsModel.shared.events?.first(where: { $0.id == id })?.status == .scheduled {
                        DatedScreen(eventId: id, leave: leave)
                    } else {
                        VoteScreen(eventId: id, leave: leave)
                    }
                }
        }
        .onAppear { if let vote, path.isEmpty { path = [vote] } }
        .environment(\.closeSheet, onDone)
        .nativeSheetLook(preferences)
    }
}

/// Aftaler (#199), as the web's EventsSheet on a phone, drawn as the web
/// draws it (#281): what needs you now, what is to come, and what is over,
/// as CasyUI's CardLists (the first 16 below the bar), each row its date as
/// a tile, its name and its group. A vote to answer goes to answering it on
/// the home page; a row to come slides left (the web's SwipeReveal) to
/// cancel your own event, asked first, or leave anyone else's.
struct EventsScreen: View {
    let leave: (LeavingProfile) -> Void

    private let model = EventsModel.shared
    @Environment(\.closeSheet) private var closeSheet
    @State private var cancelling: SuggestedEvent?
    @State private var failure: String?
    /// The row swiped open: one at a time, as on the web.
    @State private var swiped: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if viewerElsewhere {
                    Notice(CasyStrings.timeZoneNote, tone: .info, bare: true).padding(.bottom, 4)
                }
                if let failure { Notice(failure, tone: .error, bare: true).padding(.top, 16) }
                if let groups = model.groups {
                    if groups.answer.isEmpty && groups.coming.isEmpty && groups.past.isEmpty {
                        empty
                    } else {
                        if !groups.answer.isEmpty {
                            CardList(CasyStrings.eventsGroupAnswer, spaced: false) {
                                rows(groups.answer, answering: true)
                            }
                            .padding(.top, 16)
                        }
                        if !groups.coming.isEmpty {
                            CardList(CasyStrings.eventsGroupComing, spaced: !groups.answer.isEmpty) {
                                rows(groups.coming)
                            }
                            .padding(.top, groups.answer.isEmpty ? 16 : 0)
                        }
                        if !groups.past.isEmpty {
                            CardList(CasyStrings.eventsGroupPast) {
                                ForEach(groups.past, id: \.event.id) { s in
                                    row(s, past: true)
                                }
                            }
                        }
                    }
                } else if let failure = model.failure {
                    Notice(failure, tone: .error, bare: true).padding(.top, 16)
                } else {
                    HStack(spacing: 8) {
                        ProgressView().controlSize(.small)
                        Text(CasyStrings.eventsLoading)
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.mutedForeground.color)
                    }
                    .padding(.top, 16)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.bottom, 16)
        }
        .accessibilityIdentifier("events.list")
        .casySheetBar(CasyStrings.eventsTitle, close: CasyStrings.done, action: closeSheet)
        .task { await model.load() }
        .refreshable { await model.load() }
        .askFirst(
            isPresented: Binding(get: { cancelling != nil }, set: { if !$0 { cancelling = nil; swiped = nil } }),
            presenting: cancelling,
            words: { _ in
                // The web's list says Annuller here, its event screen Behold den.
                AskWords(message: CasyStrings.eventsCancelConfirm, confirm: CasyStrings.eventsCancelEvent)
            }
        ) { try await model.cancel($0.id) }
    }

    /// Whether this phone's clock isn't Danish time, so every time needs saying so.
    private var viewerElsewhere: Bool {
        let year = Calendar(identifier: .gregorian).component(.year, from: Date())
        return !sameClock(TimeZone.current.identifier, appTimeZone, year)
    }

    /// Rows to come or to answer: each opens its screen, and slides left to
    /// cancel (yours, asked first) or leave (anyone else's, at the press).
    private func rows(_ staged: [StagedEvent], answering: Bool = false) -> some View {
        ForEach(staged, id: \.event.id) { s in
            let mine = s.event.createdBy.isYou
            SwipeReveal(
                mine ? CasyStrings.eventsSwipeCancel : CasyStrings.eventsSwipeLeave,
                isOpen: Binding(
                    get: { swiped == s.event.id },
                    set: { open in swiped = open ? s.event.id : (swiped == s.event.id ? nil : swiped) }),
                onPress: {
                    if mine { cancelling = s.event } else { run { try await model.leave(s.event.id) } }
                }
            ) {
                if s.stage == .scheduled {
                    NavigationLink {
                        DatedScreen(eventId: s.event.id, leave: leave)
                    } label: {
                        row(s, cue: nil)
                    }
                    .buttonStyle(.cardRow)
                } else if s.stage == .voting {
                    NavigationLink {
                        VoteScreen(eventId: s.event.id, leave: leave)
                    } label: {
                        row(s, cue: cue(s, answering: answering))
                    }
                    .buttonStyle(.cardRow)
                } else {
                    Button {
                        open(s)
                    } label: {
                        row(s, cue: cue(s, answering: answering))
                    }
                    .buttonStyle(.cardRow)
                }
            }
        }
    }

    /// One event as the web's EventRow: the date tile, the name (15 medium,
    /// muted once over) and the group; at the end what a press does ("Svar",
    /// 15 semibold orange with its chevron) or the muted chevron, nothing
    /// for what is over.
    private func row(_ s: StagedEvent, cue: String? = nil, past: Bool = false) -> some View {
        CardRow(CasyStrings.eventTitle(s.event.title), detail: s.event.group.name, tone: past ? .muted : .standard) {
            EventRowTile(staged: s, past: past)
        } trailing: {
            if let cue {
                HStack(spacing: 0) {
                    Text(cue).font(.system(size: 15, weight: .semibold))
                    LucideIcon("chevron-right", size: 16)
                }
                .foregroundStyle(Theme.primary.color)
            } else if !past {
                LucideIcon("chevron-right", size: 16)
                    .foregroundStyle(Theme.mutedForeground.color.opacity(0.6))
                    .accessibilityHidden(true)
            }
        }
        .accessibilityElement(children: .combine)
    }

    /// What a press does, in Svar nu: answer, or (a vote in Svar nu that isn't
    /// yours to answer) choose its date.
    private func cue(_ s: StagedEvent, answering: Bool) -> String? {
        guard answering else { return nil }
        return s.stage == .toSwipe ? CasyStrings.eventsAnswerNow : CasyStrings.eventsChoose
    }

    /// A vote to answer is answered over the day view, still the page's.
    private func open(_ s: StagedEvent) {
        leave(.webScreen("/?vote=\(s.event.id)"))
    }

    /// Nothing yet, as the web's NoEvents on a phone: the icon (40), what it
    /// is (17 semibold), one line (15 muted), and the way to plan in glass.
    private var empty: some View {
        VStack(spacing: 0) {
            LucideIcon("calendar-check", size: 40).foregroundStyle(Theme.primary.color)
            Text(CasyStrings.eventsEmptyTitle)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Theme.foreground.color)
                .padding(.top, 12)
            Text(CasyStrings.eventsEmptyBody)
                .font(.system(size: 15))
                .foregroundStyle(Theme.mutedForeground.color)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 320)
                .padding(.top, 4)
            GlassButton {
                leave(.webScreen("/?plan"))
            } label: {
                HStack(spacing: 8) {
                    LucideIcon("calendar-search", size: 20)
                    Text(CasyStrings.eventsPlan)
                }
            }
            .padding(.top, 20)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 64)
    }

    private func run(_ action: @escaping () async throws -> Void) {
        failure = nil
        Task {
            do { try await action() } catch { failure = error.localizedDescription }
        }
    }
}

/// A row's date tile: an agreed event's day, a vote's first date to come with
/// its other dates stacked behind it.
struct EventRowTile: View {
    let staged: StagedEvent
    var past = false

    var body: some View {
        let voting = staged.stage == .voting || staged.stage == .toSwipe
        let dates = voting ? upcomingDates(staged.event, now: Native.now) : []
        let start =
            voting
            ? dates.first.flatMap { parseInstant($0.start) }
            : staged.event.currentDate.flatMap { parseInstant($0.start) }
        DateTile(start: start, more: max(0, dates.count - 1), past: past)
    }
}

/// An event's day as Apple Calendar's icon draws one (#177): the weekday small
/// in orange over the day's number. A vote not yet decided is a little stack
/// of its dates, its first on top; one that is over is greyed.
struct DateTile: View {
    enum Size { case row, hero }

    let start: Int64?
    var more = 0
    var past = false
    var size = Size.row

    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }
    private var box: CGSize { size == .row ? CGSize(width: 40, height: 44) : CGSize(width: 56, height: 64) }
    private var radius: CGFloat { size == .row ? 12 : 16 }

    var body: some View {
        ZStack {
            if more > 1 { card.opacity(0.3).offset(x: 8, y: -8) }
            if more > 0 { card.opacity(0.6).offset(x: 4, y: -4) }
            card.overlay { face }
        }
        .frame(width: box.width, height: box.height)
        .accessibilityHidden(true)
    }

    private var card: some View {
        RoundedRectangle(cornerRadius: radius)
            .fill(Theme.card.color)
            .overlay(RoundedRectangle(cornerRadius: radius).strokeBorder(Theme.border.color))
            .frame(width: box.width, height: box.height)
    }

    @ViewBuilder private var face: some View {
        if let start {
            VStack(spacing: 0) {
                Text(weekdayShortName(start, lang).replacingOccurrences(of: ".", with: "").uppercased())
                    .font(.system(size: size == .row ? 9 : 11, weight: .bold))
                    .tracking(0.5)
                    .foregroundStyle(past ? Theme.mutedForeground.color : Theme.primary.color)
                Text("\(localDate(start, appTimeZone).day)")
                    .font(.system(size: size == .row ? 19 : 28, weight: .semibold).monospacedDigit())
                    .foregroundStyle(past ? Theme.mutedForeground.color : Theme.foreground.color)
            }
        } else if !past {
            // Over with no date: nothing to ask about (#215).
            Text("?")
                .font(.system(size: size == .row ? 19 : 28, weight: .semibold))
                .foregroundStyle(Theme.mutedForeground.color)
        }
    }
}

/// For the "Er du sikker?" sheet before cancelling one.
extension SuggestedEvent: @retroactive Identifiable {}
