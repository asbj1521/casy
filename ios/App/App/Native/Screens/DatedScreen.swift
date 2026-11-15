import CasyAPI
import CasyCore
import CasyUI
import SwiftUI

/// An agreed event's screen in Aftaler (#199), as the web's DatedScreen:
/// its date as a tile with the time beside it, everyone's face with where
/// they stand, its place and note, and what you can do last, as rows: say
/// you can't after all (an agreed vote, moving it for everyone), report it,
/// cancel or leave, each asked first. Tilføj til min kalender is pinned along
/// the bottom.
struct DatedScreen: View {
    let eventId: String
    let leave: (LeavingProfile) -> Void

    private let model = EventsModel.shared
    @Environment(\.closeSheet) private var closeSheet
    @Environment(\.dismiss) private var dismiss
    @State private var asking: Asking?
    @State private var reporting = false
    @State private var working = false
    @State private var failure: String?

    private enum Asking: Hashable { case exit, backOut }

    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    var body: some View {
        if let event = model.events?.first(where: { $0.id == eventId }), event.status == .scheduled,
            let date = event.currentDate
        {
            content(event, date)
        } else {
            // Cancelled, left or moved: back to the list.
            Color.clear.task { dismiss() }
        }
    }

    private func content(_ event: SuggestedEvent, _ date: EventDate) -> some View {
        let mine = event.createdBy.isYou
        return List {
            Section {
                header(event, date)
            }
            .listRowBackground(Color.clear)
            if let start = parseInstant(date.start), let end = parseInstant(date.end) {
                Section {
                    DaySlice(start: start, end: end, label: CasyStrings.eventTitle(event.title)) { day in
                        leave(.webScreen("/?day=\(dayKey(day, appTimeZone))"))
                    }
                }
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
            }
            Section {
                PeopleRow(
                    invitees: event.invitees, suggesterId: event.createdBy.id,
                    standing: { $0.response?.rawValue ?? "none" },
                    optional: event.settings.people?.optional ?? [])
            }
            if event.place != nil || event.note != nil {
                Section { PlaceNoteView(event: event) }
            }
            Section {
                if event.mode == .vote {
                    Button {
                        asking = .backOut
                    } label: {
                        ListRow(CasyStrings.eventsCantAfterAll, systemImage: "calendar.badge.minus", tone: .primary)
                            .contentShape(Rectangle())
                    }
                }
                if !mine {
                    Button {
                        reporting = true
                    } label: {
                        ListRow(CasyStrings.reportEvent, systemImage: "flag")
                            .contentShape(Rectangle())
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
                // Its words are the question's button's too.
                .accessibilityIdentifier("dated.exit")
                if let failure { Notice(failure, tone: .error, bare: true) }
            }
            .disabled(working)
        }
        .casyPushedBar(event.group.name, close: CasyStrings.done, action: closeSheet)
        // Its one main action, pinned along the bottom.
        .safeAreaInset(edge: .bottom) { AddToCalendar(event: event) }
        .refreshable { await model.load() }
        .confirmationDialog(
            asking == .backOut
                ? CasyStrings.eventsMoveConfirm
                : mine ? CasyStrings.eventsCancelConfirm : CasyStrings.eventsLeaveConfirm,
            isPresented: Binding(get: { asking != nil }, set: { if !$0 { asking = nil } }),
            titleVisibility: .visible, presenting: asking
        ) { asked in
            // `asked`, not `asking`: the dialog clears `asking` before its button runs.
            if asked == .backOut {
                Button(CasyStrings.eventsMoveYes, role: .destructive) {
                    run { try await model.answer(event.id, dateId: date.id, .declined) }
                }
                Button(CasyStrings.eventsMoveKeep, role: .cancel) {}
            } else {
                Button(mine ? CasyStrings.eventsCancelEvent : CasyStrings.eventsLeaveEvent, role: .destructive) {
                    run { try await mine ? model.cancel(event.id) : model.leave(event.id) }
                }
                Button(mine ? CasyStrings.eventsKeepIt : CasyStrings.eventsStayIn, role: .cancel) {}
            }
        }
        .sheet(isPresented: $reporting) {
            ReportSheet(event: event)
                .nativeSheetLook(NativePreferences.shared)
        }
    }

    /// The group is the bar's title; here what it is, and when.
    private func header(_ event: SuggestedEvent, _ date: EventDate) -> some View {
        let when =
            event.settings.kind == .single
            ? "\(formatTime(date.start))-\(formatTime(date.end))"
            : formatEventDate(event.settings.kind, start: date.start, end: date.end, lang)
        let yours = yourTime(
            event.settings.kind, start: date.start, end: date.end, lang, viewerZone: TimeZone.current.identifier)
        return HStack(spacing: 16) {
            DateTile(start: parseInstant(date.start), size: .hero)
            VStack(alignment: .leading, spacing: 2) {
                Text(CasyStrings.eventTitle(event.title))
                    .font(.headline)
                    .lineLimit(2)
                Text(when)
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(Theme.mutedForeground.color)
                if let yours {
                    Text(CasyStrings.timeZoneYours(yours))
                        .font(.footnote)
                        .foregroundStyle(Theme.mutedForeground.color)
                }
            }
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .combine)
    }

    private func run(_ action: @escaping () async throws -> Void) {
        working = true
        failure = nil
        Task {
            defer { working = false }
            do { try await action() } catch { failure = error.localizedDescription }
        }
    }
}

/// Everyone asked, as a row of faces (#177): each with a small badge for where
/// they stand, the one who suggested it with an orange star, those still to
/// answer greyed. With `split` (a vote), those still to answer stand apart at
/// the end, after a thin line.
struct PeopleRow: View {
    let invitees: [EventInvitee]
    let suggesterId: String?
    /// "accepted", "maybe", "declined", or "none" for not yet.
    let standing: (EventInvitee) -> String
    var optional: [String] = []
    var split = false

    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    private var people: [EventInvitee] {
        let waiting = { (p: EventInvitee) in split && standing(p) == "none" }
        return invitees.enumerated().sorted { a, b in
            let (wa, wb) = (waiting(a.element), waiting(b.element))
            if wa != wb { return !wa }
            let (sa, sb) = (a.element.profileId == suggesterId, b.element.profileId == suggesterId)
            if sa != sb { return sa }
            return a.offset < b.offset
        }.map(\.element)
    }

    var body: some View {
        let people = people
        let firstWaiting = split ? people.firstIndex { standing($0) == "none" } : nil
        let optionalNames = people.filter { optional.contains($0.profileId) }.map { $0.isYou ? CasyStrings.eventsYou : $0.name }
        VStack(alignment: .leading, spacing: 6) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 12) {
                    ForEach(Array(people.enumerated()), id: \.element.profileId) { i, p in
                        if i == firstWaiting && i > 0 {
                            Rectangle().fill(Theme.border.color).frame(width: 1, height: 40)
                        }
                        face(p)
                    }
                }
                .padding(.top, 2)
            }
            if !optionalNames.isEmpty {
                Text(CasyStrings.eventsOptionalAre(nameList(optionalNames, lang)))
                    .font(.caption)
                    .foregroundStyle(Theme.mutedForeground.color)
            }
        }
    }

    private func face(_ p: EventInvitee) -> some View {
        let stand = standing(p)
        let name = p.isYou ? CasyStrings.eventsYou : p.name
        let suggested =
            p.profileId == suggesterId
            ? ". \(p.isYou ? CasyStrings.eventsYouSuggested : CasyStrings.eventsSuggestedBy(p.name))" : ""
        return VStack(spacing: 4) {
            Avatar(
                name: p.name, index: invitees.firstIndex(of: p) ?? 0, size: .row,
                url: p.avatarUrl.flatMap(URL.init(string:))
            )
            .opacity(stand == "none" ? 0.5 : 1)
            .overlay(alignment: .bottomTrailing) { badge(stand).offset(x: 2, y: 2) }
            .overlay(alignment: .bottomLeading) {
                if p.profileId == suggesterId {
                    Image(systemName: "star.fill")
                        .font(.system(size: 8, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 16, height: 16)
                        .background(Circle().fill(Theme.cta.color))
                        .overlay(Circle().strokeBorder(Theme.background.color, lineWidth: 2))
                        .offset(x: -2, y: 2)
                }
            }
            Text(name)
                .font(.caption2)
                .foregroundStyle(Theme.mutedForeground.color)
                .lineLimit(1)
                .frame(width: 48)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(name): \(CasyStrings.eventsAnswered(stand))\(suggested)")
    }

    private func badge(_ stand: String) -> some View {
        let (icon, color): (String, Color) =
            switch stand {
            case "accepted": ("checkmark", Theme.emerald700.color)
            case "maybe": ("face.smiling", Theme.amber700.color)
            case "declined": ("xmark", Theme.red600.color)
            default: ("clock", Theme.mutedForeground.color)
            }
        return Image(systemName: icon)
            .font(.system(size: 8, weight: .heavy))
            .foregroundStyle(.white)
            .frame(width: 16, height: 16)
            .background(Circle().fill(color))
            .overlay(Circle().strokeBorder(Theme.background.color, lineWidth: 2))
    }
}
