import CasyAPI
import CasyCore
import CasyUI
import SwiftUI

/// A vote's screen in Aftaler once you have answered (#199), as the web's
/// VoteScreen: its dates as a stack, everyone's face (those still to answer
/// apart at the end), and each date as a row with the faces of those who can,
/// the most yeses at the top, a tap opening who said what. Your own answer is
/// at each row's end, changed with a tap. Only when no date can win does the
/// suggester choose, with "Vælg" on each. Then the time left, the
/// suggester's deadline and "Afgør nu", the place and note, and reporting,
/// cancelling or leaving last. Søg igen hands over to the page's own vote
/// screen, where it lives with Planlæg.
struct VoteScreen: View {
    let eventId: String
    let leave: (LeavingProfile) -> Void

    private let model = EventsModel.shared
    @Environment(\.closeSheet) private var closeSheet
    @Environment(\.dismiss) private var dismiss
    @State private var openId: String?
    @State private var asking: Asking?
    @State private var picking = false
    @State private var reporting = false
    @State private var working: String?
    @State private var reminded = false
    @State private var failure: String?

    private enum Asking: Hashable { case exit, settle }

    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    var body: some View {
        if let event = model.events?.first(where: { $0.id == eventId }), event.status == .pending, isVote(event) {
            content(event)
        } else {
            // Decided, cancelled or left: back to the list, where it now stands.
            Color.clear.task { dismiss() }
        }
    }

    private func content(_ event: SuggestedEvent) -> some View {
        let now = Native.now
        let mine = event.createdBy.isYou
        let stage = voteStage(event, now: now)
        let dates = upcomingDates(event, now: now)
        let missing = stillToAnswer(event, now: now)
        let total = event.invitees.count
        let halfIn = (total - missing.count) * 2 >= total
        let mustChoose = stage == .choose
        let marked = mustChoose ? bestPick(event, now: now) : halfIn ? leader(event, now: now) : nil
        let ranked = Self.ranked(event, dates)
        let sharedTime = Self.sharedTime(event, dates)
        return List {
            Section {
                header(event, dates: dates, sharedTime: sharedTime, waiting: mustChoose ? 0 : missing.count)
            }
            .listRowBackground(Color.clear)
            Section {
                PeopleRow(
                    invitees: event.invitees, suggesterId: event.createdBy.id,
                    standing: { p in dates.allSatisfy { $0.answers[p.profileId] != nil } ? "accepted" : "none" },
                    optional: event.settings.people?.optional ?? [], split: true)
            } footer: {
                if mustChoose {
                    Text(mine ? CasyStrings.eventsChooseNow : CasyStrings.eventsWaitingForChoice(event.createdBy.name))
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.foreground.color)
                }
            }
            Section {
                ForEach(ranked, id: \.date.id) { item in
                    dateRow(event, item.date, item.n, marked: item.date.id == marked?.id, mustChoose: mustChoose,
                            canChoose: mustChoose && mine, label: dateLabel(event, item.date, sharedTime: sharedTime))
                }
            } footer: {
                if !mustChoose && !missing.isEmpty {
                    if let answerBy = event.answerBy, let end = parseInstant(answerBy) {
                        Countdown(until: end)
                    } else {
                        Text(CasyStrings.voteDeadlineUntilAll)
                    }
                }
            }
            .animation(.snappy, value: ranked.map { $0.date.id })
            if let failure { Notice(failure, tone: .error, bare: true) }
            if mine && !mustChoose {
                deadlineSection(event)
            }
            if event.place != nil || event.note != nil {
                Section { PlaceNoteView(event: event) }
            }
            Section {
                // Searching again is Planlæg's, still the page's: its own vote screen there.
                Button {
                    leave(.webScreen("/?events=\(event.id)"))
                } label: {
                    ListRow(CasyStrings.searchAgain, systemImage: "arrow.clockwise").contentShape(Rectangle())
                }
                if !mine {
                    Button {
                        reporting = true
                    } label: {
                        ListRow(CasyStrings.reportEvent, systemImage: "flag").contentShape(Rectangle())
                    }
                }
                Button {
                    asking = .exit
                } label: {
                    ListRow(
                        mine ? CasyStrings.eventsCancelEvent : CasyStrings.eventsLeaveEvent,
                        systemImage: "rectangle.portrait.and.arrow.right", tone: .danger)
                        .contentShape(Rectangle())
                }
                .accessibilityIdentifier("vote.exit")
            }
        }
        .disabled(working != nil)
        .casyPushedBar(event.group.name, close: CasyStrings.done, action: closeSheet)
        .refreshable { await model.load() }
        .confirmationDialog(
            asking == .settle
                ? CasyStrings.voteDeadlineSettleAsk
                : mine ? CasyStrings.eventsCancelConfirm : CasyStrings.eventsLeaveConfirm,
            isPresented: Binding(get: { asking != nil }, set: { if !$0 { asking = nil } }),
            titleVisibility: .visible, presenting: asking
        ) { asked in
            if asked == .settle {
                Button(CasyStrings.voteDeadlineSettleNow) {
                    run("settle") {
                        try await model.change(CasyStrings.eventsSettleFailed) {
                            try await $0.settleVote(event.id, errorMessage: CasyStrings.eventsSettleFailed)
                        }
                    }
                }
                Button(CasyStrings.cancel, role: .cancel) {}
            } else {
                Button(mine ? CasyStrings.eventsCancelEvent : CasyStrings.eventsLeaveEvent, role: .destructive) {
                    run("exit") { try await mine ? model.cancel(event.id) : model.leave(event.id) }
                }
                Button(mine ? CasyStrings.eventsKeepIt : CasyStrings.eventsStayIn, role: .cancel) {}
            }
        }
        .sheet(isPresented: $reporting) {
            ReportSheet(event: event).nativeSheetLook(NativePreferences.shared)
        }
        .sheet(isPresented: $picking) {
            DeadlineSheet(hasDeadline: event.answerBy != nil) { days in
                picking = false
                run("deadline") {
                    try await model.change(CasyStrings.eventsDeadlineFailed) {
                        try await $0.setVoteDeadline(event.id, days: days, errorMessage: CasyStrings.eventsDeadlineFailed)
                    }
                }
            }
            .nativeSheetLook(NativePreferences.shared)
            .presentationDetents([.medium])
        }
    }

    struct RankedDate {
        let date: CandidateDate
        let n: Tally
    }

    /// Most yeses first, then most "rather not", then soonest.
    private static func ranked(_ event: SuggestedEvent, _ dates: [CandidateDate]) -> [RankedDate] {
        let rows = dates.map { RankedDate(date: $0, n: tally($0, event)) }
        let order = rows.indices.sorted { a, b in
            let (x, y) = (rows[a].n, rows[b].n)
            if x.accepted != y.accepted { return x.accepted > y.accepted }
            if x.maybe != y.maybe { return x.maybe > y.maybe }
            return a < b
        }
        return order.map { rows[$0] }
    }

    /// A meeting's time, said once at the top when every date shares it.
    private static func sharedTime(_ event: SuggestedEvent, _ dates: [CandidateDate]) -> String? {
        guard event.settings.kind == .single, let first = dates.first else { return nil }
        let clock = { (d: CandidateDate) in "\(formatTime(d.start))-\(formatTime(d.end))" }
        return dates.allSatisfy({ clock($0) == clock(first) }) ? clock(first) : nil
    }

    private func dateLabel(_ event: SuggestedEvent, _ d: CandidateDate, sharedTime: String?) -> String {
        sharedTime != nil
            ? formatDate(d.start, lang)
            : formatEventDate(event.settings.kind, start: d.start, end: d.end, lang)
    }

    private func header(_ event: SuggestedEvent, dates: [CandidateDate], sharedTime: String?, waiting: Int) -> some View {
        HStack(spacing: 16) {
            DateTile(start: dates.first.flatMap { parseInstant($0.start) }, more: max(0, dates.count - 1), size: .hero)
                .padding(.trailing, 8)
                .padding(.top, 8)
            VStack(alignment: .leading, spacing: 2) {
                Text(CasyStrings.eventTitle(event.title)).font(.headline).lineLimit(2)
                if let sharedTime {
                    Text(sharedTime)
                        .font(.subheadline.monospacedDigit())
                        .foregroundStyle(Theme.mutedForeground.color)
                }
            }
            Spacer(minLength: 0)
            // The suggester nudges those the vote waits for, once a day.
            if event.createdBy.isYou && waiting > 0 {
                remindButton(event, waiting: waiting)
            }
        }
    }

    private func remindButton(_ event: SuggestedEvent, waiting: Int) -> some View {
        let last = event.remindedAt.flatMap(parseInstant)
        let done = reminded || (last.map { Native.now - $0 < 86_400_000 } ?? false)
        return GlassButton(
            systemImage: done ? "bell.badge" : "bell", size: .small, busy: working == "remind"
        ) {
            run("remind") {
                try await model.change(CasyStrings.eventsRemindFailed) {
                    try await $0.remindVoters(event.id, errorMessage: CasyStrings.eventsRemindFailed).events
                }
                reminded = true
            }
        } label: {
            Text(done ? CasyStrings.remindDone : CasyStrings.remindButton(waiting))
        }
        .disabled(done)
    }

    @ViewBuilder private func dateRow(
        _ event: SuggestedEvent, _ d: CandidateDate, _ n: Tally, marked: Bool, mustChoose: Bool,
        canChoose: Bool, label: String
    ) -> some View {
        let you = event.invitees.first(where: \.isYou)?.profileId
        let isOpen = openId == d.id
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 12) {
                Button {
                    withAnimation(.snappy) { openId = isOpen ? nil : d.id }
                } label: {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 4) {
                            if marked {
                                Image(systemName: "checkmark")
                                    .font(.footnote.weight(.heavy))
                                    .foregroundStyle(Theme.primary.color)
                                    .accessibilityLabel(mustChoose ? CasyStrings.eventsBestPick : CasyStrings.eventsAhead)
                            }
                            Text(label).font(.subheadline.weight(.medium)).lineLimit(1)
                            Image(systemName: "chevron.down")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(Theme.mutedForeground.color)
                                .rotationEffect(.degrees(isOpen ? 180 : 0))
                                .accessibilityHidden(true)
                        }
                        if !isOpen { DateFaces(date: d, invitees: event.invitees, tally: n) }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityValue(isOpen ? "open" : "")
                if let you {
                    YourAnswer(yours: d.answers[you], label: label) { response in
                        run(d.id) { try await model.answer(event.id, dateId: d.id, response) }
                    }
                }
                if canChoose {
                    Button(CasyStrings.eventsChoose) {
                        run(d.id) {
                            try await model.change(CasyStrings.eventsChooseFailed) {
                                try await $0.chooseDate(event.id, dateId: d.id, errorMessage: CasyStrings.eventsChooseFailed)
                            }
                        }
                    }
                    .buttonStyle(.borderless)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.primary.color)
                }
            }
            if isOpen { DateVoters(date: d, invitees: event.invitees).padding(.top, 10) }
        }
        .padding(.vertical, 4)
    }

    private func deadlineSection(_ event: SuggestedEvent) -> some View {
        Section {
            Button {
                picking = true
            } label: {
                ListRow(
                    CasyStrings.voteDeadlineLabel, systemImage: "hourglass",
                    value: event.answerBy.map {
                        CasyStrings.voteDeadlineAt(formatLongDate($0, lang), formatTime($0))
                    } ?? CasyStrings.voteDeadlineNone)
                    .contentShape(Rectangle())
            }
            Button {
                asking = .settle
            } label: {
                ListRow(CasyStrings.voteDeadlineSettleNow, tone: .primary).contentShape(Rectangle())
            }
            // Its words are the question's button's too.
            .accessibilityIdentifier("vote.settle")
        }
    }

    private func run(_ what: String, _ action: @escaping () async throws -> Void) {
        working = what
        failure = nil
        Task {
            defer { working = nil }
            do { try await action() } catch { failure = error.localizedDescription }
        }
    }
}

/// Your answer to one date, a cross and a tick: filled for the one you gave;
/// "can, but rather not" shows as an amber tick.
private struct YourAnswer: View {
    let yours: EventResponse?
    let label: String
    let answer: (EventResponse) -> Void

    var body: some View {
        HStack(spacing: 6) {
            circle("xmark", on: yours == .declined, fill: Theme.red600.color) { answer(.declined) }
                .accessibilityLabel("\(CasyStrings.eventsICant): \(label)")
                .accessibilityAddTraits(yours == .declined ? .isSelected : [])
            circle(
                "checkmark", on: yours == .accepted || yours == .maybe,
                fill: yours == .maybe ? Theme.amber700.color : Theme.emerald700.color
            ) { answer(.accepted) }
                .accessibilityLabel("\(CasyStrings.eventsICan): \(label)")
                .accessibilityAddTraits(yours == .accepted || yours == .maybe ? .isSelected : [])
        }
    }

    private func circle(_ icon: String, on: Bool, fill: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(on ? .white : Theme.mutedForeground.color)
                .frame(width: 32, height: 32)
                .background(Circle().fill(on ? fill : Theme.card.color))
                .overlay(Circle().strokeBorder(on ? fill : Theme.border.color))
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.borderless)
    }
}

/// Who can on one date: the faces of those who can, overlapping, then those
/// who would rather not, paler; the numbers for VoiceOver.
private struct DateFaces: View {
    let date: CandidateDate
    let invitees: [EventInvitee]
    let tally: Tally

    private static let most = 7

    var body: some View {
        let can = invitees.filter { date.answers[$0.profileId] == .accepted }
            + invitees.filter { date.answers[$0.profileId] == .maybe }
        HStack(spacing: -6) {
            if can.isEmpty {
                Capsule().fill(Theme.secondary.color).frame(height: 6)
            }
            ForEach(Array(can.prefix(Self.most)), id: \.profileId) { p in
                Avatar(
                    name: p.name, index: invitees.firstIndex(of: p) ?? 0, size: .extraSmall,
                    url: p.avatarUrl.flatMap(URL.init(string:))
                )
                .overlay(Circle().strokeBorder(Theme.card.color, lineWidth: 2))
                .opacity(date.answers[p.profileId] == .maybe ? 0.45 : 1)
            }
            if can.count > Self.most {
                Text("+\(can.count - Self.most)")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(Theme.mutedForeground.color)
                    .padding(.leading, 10)
            }
        }
        .frame(height: 20)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            CasyStrings.eventsCanOnDate(tally.accepted + tally.maybe)
                + (tally.declined > 0 ? ", \(CasyStrings.eventsCantOnDate(tally.declined))" : ""))
    }
}

/// A date opened: everyone by what they answered, each face with its name.
private struct DateVoters: View {
    let date: CandidateDate
    let invitees: [EventInvitee]

    var body: some View {
        let groups = ["accepted", "maybe", "declined", "missing"].map { key in
            (key, invitees.filter { (date.answers[$0.profileId]?.rawValue ?? "missing") == key })
        }.filter { !$0.1.isEmpty }
        VStack(alignment: .leading, spacing: 12) {
            ForEach(groups, id: \.0) { key, people in
                VStack(alignment: .leading, spacing: 6) {
                    Text(CasyStrings.eventsVoters(key).uppercased())
                        .font(.caption.weight(.medium))
                        .foregroundStyle(Theme.mutedForeground.color)
                    FlowRow(people: people, invitees: invitees, faded: key == "missing")
                }
            }
        }
    }
}

private struct FlowRow: View {
    let people: [EventInvitee]
    let invitees: [EventInvitee]
    let faded: Bool

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(people, id: \.profileId) { p in
                    HStack(spacing: 6) {
                        Avatar(
                            name: p.name, index: invitees.firstIndex(of: p) ?? 0, size: .small,
                            url: p.avatarUrl.flatMap(URL.init(string:))
                        )
                        .opacity(faded ? 0.45 : 1)
                        Text(p.isYou ? CasyStrings.eventsYou : p.name).font(.footnote)
                    }
                    .accessibilityElement(children: .combine)
                }
            }
        }
    }
}

/// The time left until a vote is settled, ticking down each second.
private struct Countdown: View {
    let until: Int64
    /// How far the app's clock is from the phone's: none, unless a test fixed it.
    private let skew = Native.now - Int64(Date().timeIntervalSince1970 * 1000)

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let now = Int64(context.date.timeIntervalSince1970 * 1000) + skew
            HStack(spacing: 6) {
                Image(systemName: "timer").accessibilityHidden(true)
                Text(CasyStrings.eventsSettlesIn)
                Text(formatCountdown(until - now))
                    .font(.footnote.weight(.semibold).monospacedDigit())
                    .foregroundStyle(Theme.foreground.color)
            }
            .font(.footnote)
        }
    }
}

/// Ingen frist, or 1 to 7 days, as rows with a tick (`DeadlinePicker`).
private struct DeadlineSheet: View {
    let hasDeadline: Bool
    let pick: (Int?) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                ListPickRow(CasyStrings.voteDeadlineNone, isSelected: !hasDeadline) { pick(nil) }
                ForEach(1...7, id: \.self) { days in
                    ListPickRow(CasyStrings.days(days), isSelected: false) { pick(days) }
                }
            }
            .casySheetBar(CasyStrings.voteDeadlineLabel, close: CasyStrings.cancel) { dismiss() }
        }
    }
}

/// An event's place and note, shown as written.
struct PlaceNoteView: View {
    let event: SuggestedEvent

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let place = event.place {
                Label {
                    Text(place)
                } icon: {
                    Image(systemName: "mappin").foregroundStyle(Theme.primary.color)
                }
                .accessibilityLabel("\(CasyStrings.eventPlace): \(place)")
            }
            if let note = event.note {
                Label(note, systemImage: "note.text")
                    .foregroundStyle(Theme.mutedForeground.color)
                    .accessibilityLabel("\(CasyStrings.eventNote): \(note)")
            }
        }
        .font(.subheadline)
    }
}
