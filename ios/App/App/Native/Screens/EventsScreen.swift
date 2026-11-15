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
        guard let api = await Native.api() else { return }
        do {
            show(try await api.events(errorMessage: CasyStrings.eventsLoadFailed))
            failure = nil
        } catch {
            failure = CasyStrings.eventsLoadFailed
        }
    }

    private func show(_ events: [SuggestedEvent]) {
        self.events = events
        askWhileDeciding()
    }

    /// A vote everyone has answered, with a date nobody declined, is decided by
    /// the database the moment the last answer arrives (#74): ask a few times
    /// in quick succession until the decided date is here (useDecidingRefresh).
    private func askWhileDeciding() {
        let now = Self.now
        let waiting = (events ?? []).contains {
            $0.status == .pending && isVote($0) && allAnswered($0, now: now) && leader($0, now: now) != nil
        }
        guard waiting, deciding == nil else { return }
        deciding = Task {
            defer { deciding = nil }
            for _ in 0..<6 {
                try? await Task.sleep(for: .milliseconds(1500))
                if Task.isCancelled { return }
                guard let api = await Native.api(), let fresh = try? await api.events() else { continue }
                events = fresh
                if !fresh.contains(where: { $0.status == .pending && allAnswered($0, now: Self.now) }) { return }
            }
        }
    }

    func cancel(_ id: String) async throws {
        guard let api = await Native.api() else { throw APIError.failed(status: 401, message: CasyStrings.eventsCancelFailed) }
        show(try await api.cancelEvent(id, errorMessage: CasyStrings.eventsCancelFailed))
        ProfileModel.shared.onChange?()
    }

    /// Your answer on one date; for an agreed vote, a no moves it for everyone (#74).
    func answer(_ id: String, dateId: String, _ response: EventResponse) async throws {
        guard let api = await Native.api() else { throw APIError.failed(status: 401, message: CasyStrings.eventsAnswerFailed) }
        show(try await api.answerDate(id, dateId: dateId, response: response, errorMessage: CasyStrings.eventsAnswerFailed).events)
        ProfileModel.shared.onChange?()
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
    }

    func leave(_ id: String) async throws {
        guard let api = await Native.api() else { throw APIError.failed(status: 401, message: CasyStrings.eventsLeaveFailed) }
        show(try await api.leaveEvent(id, errorMessage: CasyStrings.eventsLeaveFailed))
        ProfileModel.shared.onChange?()
    }
}

/// The Aftaler sheet opened by itself, from the home page's Aftaler button.
struct EventsSheet: View {
    let preferences: NativePreferences
    let onDone: () -> Void
    let leave: (LeavingProfile) -> Void

    var body: some View {
        NavigationStack {
            EventsScreen(leave: leave)
        }
        .environment(\.closeSheet, onDone)
        .nativeSheetLook(preferences)
    }
}

/// Aftaler (#199), as the web's EventsSheet on a phone: what needs you now,
/// what is to come, and what is over, each row its date as a tile, its name
/// and its group. A vote to answer goes to answering it on the home page; an
/// event's own screen is still the page's.
struct EventsScreen: View {
    let leave: (LeavingProfile) -> Void

    private let model = EventsModel.shared
    @Environment(\.closeSheet) private var closeSheet
    @State private var cancelling: SuggestedEvent?
    @State private var failure: String?

    var body: some View {
        List {
            if viewerElsewhere {
                Label(CasyStrings.timeZoneNote, systemImage: "globe")
                    .font(.subheadline)
                    .foregroundStyle(Theme.mutedForeground.color)
                    .listRowBackground(Color.clear)
            }
            if let failure { Notice(failure, tone: .error, bare: true) }
            if let groups = model.groups {
                if groups.answer.isEmpty && groups.coming.isEmpty && groups.past.isEmpty {
                    empty
                } else {
                    section(CasyStrings.eventsGroupAnswer, groups.answer)
                    section(CasyStrings.eventsGroupComing, groups.coming)
                    section(CasyStrings.eventsGroupPast, groups.past, past: true)
                }
            } else if let failure = model.failure {
                Notice(failure, tone: .error, bare: true)
            } else {
                HStack(spacing: 8) {
                    ProgressView().controlSize(.small)
                    Text(CasyStrings.eventsLoading)
                        .font(.subheadline)
                        .foregroundStyle(Theme.mutedForeground.color)
                }
            }
        }
        .casySheetBar(CasyStrings.eventsTitle, close: CasyStrings.done, action: closeSheet)
        .task { await model.load() }
        .refreshable { await model.load() }
        .confirmationDialog(
            CasyStrings.eventsCancelConfirm,
            isPresented: Binding(get: { cancelling != nil }, set: { if !$0 { cancelling = nil } }),
            titleVisibility: .visible, presenting: cancelling
        ) { event in
            Button(CasyStrings.eventsCancelEvent, role: .destructive) {
                run { try await model.cancel(event.id) }
            }
            Button(CasyStrings.cancel, role: .cancel) {}
        }
    }

    /// Whether this phone's clock isn't Danish time, so every time needs saying so.
    private var viewerElsewhere: Bool {
        let year = Calendar(identifier: .gregorian).component(.year, from: Date())
        return !sameClock(TimeZone.current.identifier, appTimeZone, year)
    }

    @ViewBuilder private func section(_ title: String, _ staged: [StagedEvent], past: Bool = false) -> some View {
        if !staged.isEmpty {
            Section(title) {
                ForEach(staged, id: \.event.id) { s in
                    if past {
                        EventRow(staged: s, past: true)
                    } else {
                        Group {
                            if s.stage == .scheduled {
                                NavigationLink {
                                    DatedScreen(eventId: s.event.id, leave: leave)
                                } label: {
                                    EventRow(staged: s, cue: nil, chevron: false)
                                }
                            } else if s.stage == .voting {
                                NavigationLink {
                                    VoteScreen(eventId: s.event.id, leave: leave)
                                } label: {
                                    EventRow(staged: s, cue: cue(s), chevron: false)
                                }
                            } else {
                                Button {
                                    open(s)
                                } label: {
                                    EventRow(staged: s, cue: cue(s))
                                        .contentShape(Rectangle())
                                }
                            }
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            let mine = s.event.createdBy.isYou
                            Button(mine ? CasyStrings.eventsSwipeCancel : CasyStrings.eventsSwipeLeave) {
                                if mine { cancelling = s.event } else { run { try await model.leave(s.event.id) } }
                            }
                            .tint(Theme.red600.color)
                        }
                    }
                }
            }
        }
    }

    private func cue(_ s: StagedEvent) -> String? {
        switch s.stage {
        case .toSwipe: CasyStrings.eventsAnswerNow
        case .voting where needsYourChoice(s.event): CasyStrings.eventsChoose
        default: nil
        }
    }

    /// In Svar nu without a vote to answer: the suggester must choose a date.
    private func needsYourChoice(_ event: SuggestedEvent) -> Bool {
        model.groups?.answer.contains { $0.event.id == event.id } ?? false
    }

    /// A vote to answer is answered over the day view, still the page's.
    private func open(_ s: StagedEvent) {
        leave(.webScreen("/?vote=\(s.event.id)"))
    }

    /// Nothing yet: what it is, one line, and the way to plan.
    private var empty: some View {
        VStack(spacing: 8) {
            Image(systemName: "calendar.badge.checkmark")
                .font(.system(size: 40))
                .foregroundStyle(Theme.primary.color)
            Text(CasyStrings.eventsEmptyTitle).font(.headline)
            Text(CasyStrings.eventsEmptyBody)
                .font(.subheadline)
                .foregroundStyle(Theme.mutedForeground.color)
                .multilineTextAlignment(.center)
            GlassButton(systemImage: "calendar.badge.magnifyingglass") {
                leave(.webScreen("/?plan"))
            } label: {
                Text(CasyStrings.eventsPlan)
            }
            .padding(.top, 12)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 48)
        .listRowBackground(Color.clear)
    }

    private func run(_ action: @escaping () async throws -> Void) {
        failure = nil
        Task {
            do { try await action() } catch { failure = error.localizedDescription }
        }
    }
}

/// One event: its date as a tile, its name and its group; where it stands is
/// the tile and the group, not a sentence. `cue` is what a press does ("Svar").
struct EventRow: View {
    let staged: StagedEvent
    var cue: String?
    var past = false
    /// Its own chevron; off inside a NavigationLink, which draws one.
    var chevron = true

    private var start: Int64? {
        let event = staged.event
        if staged.stage == .voting || staged.stage == .toSwipe {
            let now = Native.now
            return upcomingDates(event, now: now).first.flatMap { parseInstant($0.start) }
        }
        return event.currentDate.flatMap { parseInstant($0.start) }
    }

    private var more: Int {
        guard staged.stage == .voting || staged.stage == .toSwipe else { return 0 }
        let now = Native.now
        return max(0, upcomingDates(staged.event, now: now).count - 1)
    }

    var body: some View {
        HStack(spacing: 12) {
            DateTile(start: start, more: more, past: past)
            VStack(alignment: .leading, spacing: 2) {
                Text(CasyStrings.eventTitle(staged.event.title))
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(past ? Theme.mutedForeground.color : Theme.foreground.color)
                    .lineLimit(1)
                Text(staged.event.group.name)
                    .font(.footnote)
                    .foregroundStyle(Theme.mutedForeground.color)
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            if let cue {
                HStack(spacing: 2) {
                    Text(cue).font(.subheadline.weight(.semibold))
                    Image(systemName: "chevron.right").font(.footnote.weight(.semibold))
                }
                .foregroundStyle(Theme.primary.color)
            } else if !past && chevron {
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.mutedForeground.color.opacity(0.6))
                    .accessibilityHidden(true)
            }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
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
