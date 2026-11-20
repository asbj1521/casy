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
/// cancelling or leaving last. Søg igen (#240, #264) loosens the vote's own
/// plan in a sheet, with any of the group it left out, and Find dato lays the
/// paper pile; it closes back onto the vote.
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
    /// Its group, for searching it again with those it left out.
    @State private var group: CasyAPI.Group?
    @State private var pickingMissing = false
    @State private var picked: Set<String> = []
    /// The vote's plan, loosened before it is searched again (#264).
    @State private var loosening = false
    /// On to the pile: the plan stays the vote's.
    @State private var finding = false
    @State private var planPath: [PlanPage] = []

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
        // The web's VoteScreen (#281): the hero stack with what and when and
        // Påmind (8 below the bar), the faces 20 under, the dates as a
        // CardList, the deadline right under them, the time left, the place
        // and note, then searching again, reporting and leaving, 32 apart.
        return ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header(event, dates: dates, sharedTime: sharedTime, waiting: mustChoose ? 0 : missing.count)
                    .padding(.top, 8)
                PeopleRow(
                    invitees: event.invitees, suggesterId: event.createdBy.id,
                    standing: { p in dates.allSatisfy { $0.answers[p.profileId] != nil } ? "accepted" : "none" },
                    optional: event.settings.people?.optional ?? [], split: true
                )
                .padding(.top, 20)
                if mustChoose {
                    Text(mine ? CasyStrings.eventsChooseNow : CasyStrings.eventsWaitingForChoice(event.createdBy.name))
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(Theme.foreground.color)
                        .padding(.top, 16)
                }
                CardList {
                    ForEach(Array(ranked.enumerated()), id: \.element.date.id) { i, item in
                        dateRow(event, item.date, item.n, marked: item.date.id == marked?.id, mustChoose: mustChoose,
                                canChoose: mustChoose && mine, label: dateLabel(event, item.date, sharedTime: sharedTime))
                            .overlay(alignment: .top) {
                                if i > 0 {
                                    Rectangle().fill(Theme.border.color).frame(height: 1).padding(.leading, 16)
                                }
                            }
                    }
                }
                .animation(.snappy, value: ranked.map { $0.date.id })
                if let failure { Notice(failure, tone: .error, bare: true).padding(.top, 8) }
                if mine && !mustChoose { deadlineList(event) }
                if !mustChoose && !missing.isEmpty {
                    Group {
                        if let answerBy = event.answerBy, let end = parseInstant(answerBy) {
                            Countdown(until: end)
                        } else {
                            Text(CasyStrings.voteDeadlineUntilAll)
                                .font(.system(size: 13))
                                .foregroundStyle(Theme.mutedForeground.color)
                        }
                    }
                    .padding(.horizontal, 4)
                    .padding(.top, 8)
                }
                if event.place != nil || event.note != nil {
                    PlaceNoteView(event: event).padding(.top, 24)
                }
                CardList(spaced: false) {
                    // Searching again (#240): any of the group it leaves out, or the same people.
                    let left = leftOut(event)
                    if !left.isEmpty {
                        Button {
                            picked = Set(left.map(\.profileId))
                            pickingMissing = true
                        } label: {
                            CardRow(CasyStrings.searchAgainMissing(left.count), icon: "user-plus", chevron: true)
                        }
                        .buttonStyle(.cardRow)
                        .accessibilityIdentifier("vote.missing")
                    }
                    Button {
                        loosen(event, add: [])
                    } label: {
                        CardRow(CasyStrings.searchAgain, icon: "refresh-cw")
                    }
                    .buttonStyle(.cardRow)
                    .disabled(group == nil)
                    .accessibilityIdentifier("vote.searchAgain")
                    if !mine {
                        Button {
                            reporting = true
                        } label: {
                            CardRow(CasyStrings.reportEvent, icon: "flag")
                        }
                        .buttonStyle(.cardRow)
                    }
                    Button {
                        asking = .exit
                    } label: {
                        CardRow(
                            mine ? CasyStrings.eventsCancelEvent : CasyStrings.eventsLeaveEvent, icon: "log-out",
                            tone: .danger)
                    }
                    .buttonStyle(.cardRow)
                    .accessibilityIdentifier("vote.exit")
                }
                .padding(.top, 32)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.bottom, 16)
        }
        .accessibilityIdentifier("vote.screen")
        .disabled(working != nil)
        .casyPushedBar(event.group.name, close: CasyStrings.done, action: closeSheet)
        .refreshable { await model.load() }
        .askFirst(
            isPresented: Binding(get: { asking != nil }, set: { if !$0 { asking = nil } }), presenting: asking,
            words: { asked in
                asked == .settle
                    ? AskWords(
                        message: CasyStrings.voteDeadlineSettleAsk, confirm: CasyStrings.voteDeadlineSettleNow,
                        danger: false)
                    : AskWords(
                        message: mine ? CasyStrings.eventsCancelConfirm : CasyStrings.eventsLeaveConfirm,
                        confirm: mine ? CasyStrings.eventsCancelEvent : CasyStrings.eventsLeaveEvent,
                        cancel: mine ? CasyStrings.eventsKeepIt : CasyStrings.eventsStayIn)
            }
        ) { asked in
            if asked == .settle {
                run("settle") {
                    try await model.change(CasyStrings.eventsSettleFailed) {
                        try await $0.settleVote(event.id, errorMessage: CasyStrings.eventsSettleFailed)
                    }
                }
            } else {
                run("exit") { try await mine ? model.cancel(event.id) : model.leave(event.id) }
            }
        }
        .task { await loadGroup(event) }
        .sheet(isPresented: $pickingMissing) {
            missingSheet(event).nativeSheetLook(NativePreferences.shared)
        }
        .sheet(isPresented: $loosening, onDismiss: { if !finding { PlanModel.shared.endAgain() } }) {
            NavigationStack(path: $planPath) {
                PlanScreen(
                    leave: leave,
                    onFind: {
                        finding = true
                        leave(.findDates)
                    }, path: $planPath)
            }
            .environment(\.closeSheet) { loosening = false }
            .nativeSheetLook(NativePreferences.shared)
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

    // MARK: Searching it again (#240)

    /// The members of its group it leaves out.
    private func leftOut(_ event: SuggestedEvent) -> [GroupMember] {
        let invited = Set(event.invitees.map(\.profileId))
        return group?.members.filter { !invited.contains($0.profileId) } ?? []
    }

    private func loadGroup(_ event: SuggestedEvent) async {
        guard group == nil, let api = await Native.api() else { return }
        group = try? await api.groups(errorMessage: CasyStrings.groupsLoadFailed).first { $0.id == event.group.id }
    }

    /// The vote's plan, with those `add`ed, in a sheet to loosen before the pile.
    private func loosen(_ event: SuggestedEvent, add: [String]) {
        guard let group else { return }
        pickingMissing = false
        finding = false
        planPath = []
        PlanModel.shared.begin(again: event, add: add, group: group)
        loosening = true
    }

    /// "Tilføj til afstemningen": those it left out, all ticked, then Søg igen.
    private func missingSheet(_ event: SuggestedEvent) -> some View {
        let left = leftOut(event)
        return NavigationStack {
            ScrollView {
                CardList(spaced: false) {
                    ForEach(Array(left.enumerated()), id: \.element.profileId) { i, m in
                        PickRow(
                            label: m.name, picked: picked.contains(m.profileId),
                            action: {
                                if picked.contains(m.profileId) { picked.remove(m.profileId) } else { picked.insert(m.profileId) }
                            }
                        ) {
                            Avatar(name: m.name, index: i, size: .row, url: m.avatarUrl.flatMap(URL.init(string:)))
                        }
                    }
                }
                .padding(.horizontal, 16)
            }
            .casySheetBar(CasyStrings.searchAgainPickTitle, close: CasyStrings.cancel) { pickingMissing = false }
            .safeAreaInset(edge: .bottom) {
                FlowButton(action: {
                    let add = left.map(\.profileId).filter { picked.contains($0) }
                    pickingMissing = false
                    // The picker goes before the plan's sheet comes.
                    Task {
                        try? await Task.sleep(for: .milliseconds(450))
                        loosen(event, add: add)
                    }
                }) { Text(CasyStrings.searchAgain) }
                .disabled(picked.isEmpty)
                .accessibilityIdentifier("vote.addAndSearch")
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
            }
        }
        .presentationDetents([.medium, .large])
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
            VStack(alignment: .leading, spacing: 0) {
                Text(CasyStrings.eventTitle(event.title))
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Theme.foreground.color)
                    .lineLimit(1)
                    .cssLineHeight(25.5, size: 17)
                if let sharedTime {
                    Text(sharedTime)
                        .font(.system(size: 15).monospacedDigit())
                        .foregroundStyle(Theme.mutedForeground.color)
                        .lineLimit(1)
                        .fixedSize()
                        .cssLineHeight(22.5, size: 15)
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
        return GlassButton(size: .small, busy: working == "remind") {
            run("remind") {
                try await model.change(CasyStrings.eventsRemindFailed) {
                    try await $0.remindVoters(event.id, errorMessage: CasyStrings.eventsRemindFailed).events
                }
                reminded = true
            }
        } label: {
            // The web's GlassButton "sm": the bell (16), the words, never wrapped.
            HStack(spacing: 8) {
                LucideIcon(done ? "bell-ring" : "bell", size: 16)
                Text(done ? CasyStrings.remindDone : CasyStrings.remindButton(waiting))
                    .font(.system(size: 15, weight: .semibold))
                    .lineLimit(1)
                    .fixedSize()
            }
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
                                LucideIcon("check", size: 16, stroke: 3)
                                    .foregroundStyle(Theme.primary.color)
                                    .accessibilityLabel(mustChoose ? CasyStrings.eventsBestPick : CasyStrings.eventsAhead)
                            }
                            Text(label)
                                .font(.system(size: 15, weight: .medium))
                                .foregroundStyle(Theme.foreground.color)
                                .lineLimit(1)
                                .cssLineHeight(22.5, size: 15)
                            LucideIcon("chevron-down", size: 16)
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
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.primary.color)
                }
            }
            .padding(.vertical, 10)
            .frame(minHeight: 52)
            if isOpen { DateVoters(date: d, invitees: event.invitees).padding(.bottom, 12) }
        }
        .padding(.horizontal, 16)
    }

    /// The suggester's deadline and settling now, right under the dates (the web's PhoneVoteDeadline).
    private func deadlineList(_ event: SuggestedEvent) -> some View {
        CardList {
            Button {
                picking = true
            } label: {
                CardRow(
                    CasyStrings.voteDeadlineLabel, icon: "hourglass",
                    value: event.answerBy.map {
                        CasyStrings.voteDeadlineAt(formatLongDate($0, lang), formatTime($0))
                    } ?? CasyStrings.voteDeadlineNone,
                    chevron: true)
            }
            .buttonStyle(.cardRow)
            Button {
                asking = .settle
            } label: {
                CardRow(CasyStrings.voteDeadlineSettleNow, tone: .primary)
            }
            .buttonStyle(.cardRow)
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
            circle("x", on: yours == .declined, fill: Theme.rose600.color) { answer(.declined) }
                .accessibilityLabel("\(CasyStrings.eventsICant): \(label)")
                .accessibilityAddTraits(yours == .declined ? .isSelected : [])
            circle("check", on: yours == .accepted, fill: Theme.emerald600.color, maybe: yours == .maybe) {
                answer(.accepted)
            }
                .accessibilityLabel("\(CasyStrings.eventsICan): \(label)")
                .accessibilityAddTraits(yours == .accepted || yours == .maybe ? .isSelected : [])
        }

    }

    /// The web's YourAnswer: 32 point circles 6 apart, lucide x and check
    /// (16, stroke 2.5); given, rose or emerald 600 with white; "rather not"
    /// amber 400 round amber 100 with an amber 700 tick.
    private func circle(
        _ icon: String, on: Bool, fill: Color, maybe: Bool = false, action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            LucideIcon(icon, size: 16, stroke: 2.5)
                .foregroundStyle(on ? .white : maybe ? Theme.amber700.color : Theme.mutedForeground.color)
                .frame(width: 32, height: 32)
                .background(Circle().fill(on ? fill : maybe ? Theme.amber100.color : Theme.card.color))
                .overlay(Circle().strokeBorder(on ? fill : maybe ? Theme.amber400.color : Theme.border.color))
                // 44 to touch, drawn 32 and 6 apart as the web's.
                .contentShape(Rectangle().inset(by: -6))
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
            // The web's: lucide timer (14), 13 muted, the time left semibold.
            HStack(spacing: 6) {
                LucideIcon("timer", size: 14).accessibilityHidden(true)
                Text(CasyStrings.eventsSettlesIn)
                Text(formatCountdown(until - now))
                    .font(.system(size: 13, weight: .semibold).monospacedDigit())
                    .foregroundStyle(Theme.foreground.color)
            }
            .font(.system(size: 13))
            .foregroundStyle(Theme.mutedForeground.color)
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

    /// The web's PlaceNote, read only: 4 apart, 14 point text, each line led
    /// by a 16 point icon 2 down and 6 before it, the place's pin in orange,
    /// the note (a sticky note) muted.
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let place = event.place {
                line("map-pin", place, tint: Theme.primary.color, text: Theme.foreground.color)
                    .accessibilityLabel("\(CasyStrings.eventPlace): \(place)")
            }
            if let note = event.note {
                line("sticky-note", note, tint: Theme.mutedForeground.color, text: Theme.mutedForeground.color)
                    .accessibilityLabel("\(CasyStrings.eventNote): \(note)")
            }
        }
    }

    private func line(_ icon: String, _ words: String, tint: Color, text: Color) -> some View {
        HStack(alignment: .top, spacing: 6) {
            LucideIcon(icon, size: 16).foregroundStyle(tint).padding(.top, 2)
            Text(verbatim: words)
                .font(.system(size: 14))
                .foregroundStyle(text)
                .cssLineHeight(20, size: 14)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .ignore)
    }
}
