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

    /// The web's DatedScreen (#281): the hero tile with what and when (8
    /// below the bar), the day slice and the faces 20 apart, the place and
    /// note, then what you can do as a CardList.
    private func content(_ event: SuggestedEvent, _ date: EventDate) -> some View {
        let mine = event.createdBy.isYou
        return ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header(event, date).padding(.top, 8)
                if let start = parseInstant(date.start), let end = parseInstant(date.end) {
                    DaySlice(start: start, end: end, label: CasyStrings.eventTitle(event.title)) { day in
                        leave(.webScreen("/?day=\(dayKey(day, appTimeZone))"))
                    }
                    .padding(.top, 20)
                }
                PeopleRow(
                    invitees: event.invitees, suggesterId: event.createdBy.id,
                    standing: { $0.response?.rawValue ?? "none" },
                    optional: event.settings.people?.optional ?? []
                )
                .padding(.top, 20)
                if event.place != nil || event.note != nil {
                    PlaceNoteView(event: event).padding(.top, 16)
                }
                if let failure { Notice(failure, tone: .error, bare: true).padding(.top, 16) }
                CardList {
                    if event.mode == .vote {
                        Button {
                            asking = .backOut
                        } label: {
                            CardRow(CasyStrings.eventsCantAfterAll, icon: "calendar-x", tone: .primary)
                        }
                        .buttonStyle(.cardRow)
                    }
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
                    // Its words are the question's button's too.
                    .accessibilityIdentifier("dated.exit")
                }
                .disabled(working)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.bottom, 16)
        }
        .accessibilityIdentifier("dated.screen")
        .casyPushedBar(event.group.name, close: CasyStrings.done, action: closeSheet)
        // Its one main action, pinned along the bottom.
        .safeAreaInset(edge: .bottom) { AddToCalendar(event: event) }
        .refreshable { await model.load() }
        .casyConfirm(
            asking == .backOut
                ? CasyStrings.eventsMoveConfirm
                : mine ? CasyStrings.eventsCancelConfirm : CasyStrings.eventsLeaveConfirm,
            isPresented: Binding(get: { asking != nil }, set: { if !$0 { asking = nil } }), presenting: asking
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
            // The web's: the name 17 semibold, the time 15 muted, the viewer's own 13.
            VStack(alignment: .leading, spacing: 0) {
                Text(CasyStrings.eventTitle(event.title))
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Theme.foreground.color)
                    .lineLimit(1)
                    .cssLineHeight(25.5, size: 17)
                Text(when)
                    .font(.system(size: 15).monospacedDigit())
                    .foregroundStyle(Theme.mutedForeground.color)
                    .cssLineHeight(22.5, size: 15)
                if let yours {
                    Text(CasyStrings.timeZoneYours(yours))
                        .font(.system(size: 13))
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
    @Environment(\.colorScheme) private var scheme
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
        // The web's: faces 12 apart, wrapping 8 under; a thin line before
        // those still to answer; the members whose answer decides nothing named
        // under it (12 muted).
        VStack(alignment: .leading, spacing: 6) {
            WrapLayout(spacing: 12, lineSpacing: 8) {
                ForEach(Array(people.enumerated()), id: \.element.profileId) { i, p in
                    if i == firstWaiting && i > 0 {
                        Rectangle().fill(Theme.border.color).frame(width: 1, height: 52).padding(.horizontal, 4)
                    }
                    face(p)
                }
            }
            if !optionalNames.isEmpty {
                Text(CasyStrings.eventsOptionalAre(nameList(optionalNames, lang)))
                    .font(.system(size: 12))
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
            // Faded on a solid ground, as the web's: the page behind never shows in it.
            .background(Circle().fill(Theme.card.color))
            .overlay(alignment: .bottomTrailing) { badge(stand).offset(x: 2, y: 2) }
            .overlay(alignment: .bottomLeading) {
                if p.profileId == suggesterId {
                    // The web's: an orange 16 point circle in a 2 point ring of the
                    // page's colour, a filled white star (10) in it.
                    ZStack {
                        Circle().fill(Theme.background.color).frame(width: 20, height: 20)
                        Circle().fill(Theme.cta.color).frame(width: 16, height: 16)
                        Image(systemName: "star.fill")
                            .symbolRenderingMode(.monochrome)
                            .font(.system(size: 9))
                            .foregroundStyle(Color.white)
                    }
                    .frame(width: 16, height: 16)
                    .offset(x: -2, y: 2)
                }
            }
            Text(name)
                .font(.system(size: 11))
                .foregroundStyle(Theme.mutedForeground.color)
                .lineLimit(1)
                .frame(width: 48)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(name): \(CasyStrings.eventsAnswered(stand))\(suggested)")
    }

    private func badge(_ stand: String) -> some View {
        // The web's BADGES: lucide check, meh, x and clock at 10 on 16 point circles.
        let (icon, color): (String, Color) =
            switch stand {
            case "accepted": ("check", Theme.emerald500.color)
            case "maybe": ("face-neutral", Theme.amber400.color)
            case "declined": ("x", Theme.rose500.color)
            default: ("clock", scheme == .dark ? Theme.zinc500.color : Theme.zinc400.color)
            }
        return LucideIcon(icon, size: 10, stroke: 3)
            .foregroundStyle(.white)
            .frame(width: 16, height: 16)
            .background(Circle().fill(color))
            .overlay(Circle().strokeBorder(Theme.background.color, lineWidth: 2))
    }
}
