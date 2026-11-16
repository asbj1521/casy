import CasyAPI
import CasyCore
import CasyUI
import SwiftUI

/// An answer about a trip, carried out by the page, which keeps the trips (#200).
enum TripAction {
    case accept(String)
    /// Declined, or an accepted trip deleted: never suggested again.
    case decline(String)
    case home(String)
    /// The day the person is back (a local midnight).
    case returned(String, Int64)
    /// The day the person left (a local midnight).
    case left(String, Int64)
    case addToCalendar(String)
}

/// The trip the sheet shows, as the page has it now (#200): the page finds the
/// trips and keeps the answers, so it sends the trip as it opens and again
/// after each answer, and carries out what is answered here (`onAction`).
@MainActor @Observable
final class TripModel {
    static let shared = TripModel()

    var mark: TripMark?
    /// The calendar an accepted trip was just put in.
    var addedTo: String?
    var adding = false
    var failure: String?
    @ObservationIgnored var onAction: ((TripAction) -> Void)?

    func show(_ mark: TripMark?) {
        // Gone (declined): what was shown stays while the sheet slides away.
        if let mark { self.mark = mark }
        adding = false
    }

    func act(_ action: TripAction) {
        failure = nil
        if case .addToCalendar = action { adding = true }
        onAction?(action)
    }
}

/// A trip found in the calendar (#115), opened from its bar on My calendar.
struct TripSheet: View {
    let preferences: NativePreferences
    let onDone: () -> Void

    var body: some View {
        NavigationStack {
            TripScreen()
        }
        .environment(\.closeSheet, onDone)
        .nativeSheetLook(preferences)
    }
}

/// What we found about a trip: the journeys and the time away they make, with
/// yes or no; or, where the journeys don't pair, a question answered with a
/// city or a day. No and deleting close the sheet; every other answer keeps it
/// open on the same trip as it now is.
struct TripScreen: View {
    private let model = TripModel.shared
    @Environment(\.closeSheet) private var closeSheet
    @State private var picked: Int64?
    /// Which days to offer: fixed while the sheet is open.
    @State private var now = Native.now

    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    var body: some View {
        let mark = model.mark
        List {
            if let mark {
                if let trip = mark.trip {
                    tripBody(mark, trip)
                } else if let question = mark.question {
                    if question.kind == "home" {
                        homeBody(mark, question)
                    } else {
                        dayBody(mark, question)
                    }
                }
            }
            if let failure = model.failure { Notice(failure, tone: .error, bare: true) }
        }
        .casySheetBar(title(mark), close: CasyStrings.done, action: closeSheet)
        .safeAreaInset(edge: .bottom) {
            if let mark { buttons(mark).padding(.horizontal, 16).padding(.bottom, 8) }
        }
        .onChange(of: mark?.id) { picked = nil }
    }

    private func title(_ mark: TripMark?) -> String {
        guard let mark else { return "" }
        guard let question = mark.question else { return CasyStrings.tripTitle(mark.city) }
        switch question.kind {
        case "home": return CasyStrings.tripHomeTitle
        case "return": return CasyStrings.tripReturnTitle(mark.city)
        default: return CasyStrings.tripOutboundTitle(mark.city)
        }
    }

    private func at(_ ms: Int64) -> String {
        let iso = isoString(ms)
        return CasyStrings.tripAt(formatDate(iso, lang), formatTime(iso))
    }

    @ViewBuilder private func tripBody(_ mark: TripMark, _ trip: Trip) -> some View {
        // A day the person answered ends at midnight: say the day, not 00:00.
        let end =
            startOfDay(trip.end, appTimeZone) == trip.end ? formatDate(isoString(trip.end - 1), lang) : at(trip.end)
        Section {
            LegRows(legs: trip.legs, lang: lang, at: at)
        } header: {
            Text(CasyStrings.tripFound).textCase(nil)
        } footer: {
            VStack(alignment: .leading, spacing: 8) {
                // A date ending the sentence may end in its own period: one is enough.
                Text(CasyStrings.tripAway(from: at(trip.start), to: end.hasSuffix(".") ? String(end.dropLast()) : end))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.foreground.color)
                Text(trip.accepted ? CasyStrings.tripAcceptedNote : CasyStrings.tripAcceptNote)
            }
            .padding(.top, 4)
        }
    }

    @ViewBuilder private func homeBody(_ mark: TripMark, _ question: TripQuestion) -> some View {
        // The answer first, then what it is about.
        Section {
            ForEach(question.cities ?? [], id: \.self) { city in
                Button {
                    model.act(.home(city))
                } label: {
                    HStack {
                        Text(cityName(city, legs: question.legs, lang))
                            .font(.body.weight(.semibold))
                            .foregroundStyle(Theme.primary.color)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Theme.mutedForeground.color.opacity(0.6))
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        Section {
            LegRows(legs: question.legs, lang: lang, at: at)
        } footer: {
            Text(CasyStrings.tripHomeIntro)
        }
    }

    @ViewBuilder private func dayBody(_ mark: TripMark, _ question: TripQuestion) -> some View {
        let back = question.kind == "return"
        let legs = question.legs
        // The journey's own day: where the stretch away starts (or, asked when they left, ends).
        let journey = startOfDay((back ? legs.first : legs.last)?.start ?? now, appTimeZone)
        Section {
            LegRows(legs: legs, lang: lang, at: at)
        } footer: {
            Text(back ? CasyStrings.tripReturnIntro : CasyStrings.tripOutboundIntro)
        }
        Section {
            DayPicker(allowed: dayOptions(question, now: now), journey: journey, picked: $picked, lang: lang)
        }
    }

    /// The answer along the bottom: the main one, and the other beside it.
    @ViewBuilder private func buttons(_ mark: TripMark) -> some View {
        VStack(spacing: 8) {
            if let trip = mark.trip {
                if trip.accepted {
                    if trip.inCalendar == true {
                        Label(
                            model.addedTo.map(CasyStrings.tripAddedTo) ?? CasyStrings.tripInCalendar,
                            systemImage: "calendar.badge.checkmark"
                        )
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.emerald700.color)
                        .frame(minHeight: 48)
                    } else {
                        FlowButton(busy: model.adding, action: { model.act(.addToCalendar(mark.id)) }) {
                            Text(model.adding ? CasyStrings.tripAdding : CasyStrings.tripAddToCalendar)
                        }
                    }
                    quiet(CasyStrings.tripRemove) { decline(mark) }
                } else {
                    FlowButton(action: { model.act(.accept(mark.id)) }) { Text(CasyStrings.tripAccept) }
                        .accessibilityIdentifier("trip.accept")
                    quiet(CasyStrings.tripDecline) { decline(mark) }
                }
            } else if let question = mark.question {
                if question.kind == "home" {
                    quiet(CasyStrings.tripNoneOfThem) { decline(mark) }
                } else {
                    let back = question.kind == "return"
                    FlowButton(action: {
                        guard let picked else { return }
                        model.act(back ? .returned(mark.id, picked) : .left(mark.id, picked))
                    }) {
                        Text(
                            picked.map {
                                let day = formatDate(isoString($0), lang)
                                return back ? CasyStrings.tripConfirmReturn(day) : CasyStrings.tripConfirmOutbound(day)
                            } ?? CasyStrings.tripPickDay)
                    }
                    .disabled(picked == nil)
                    .accessibilityIdentifier("trip.confirm")
                    quiet(CasyStrings.tripNotATrip) { decline(mark) }
                }
            }
        }
    }

    private func quiet(_ title: String, action: @escaping () -> Void) -> some View {
        FlowButton(kind: .quiet, action: action) { Text(title) }
    }

    private func decline(_ mark: TripMark) {
        model.act(.decline(mark.id))
        closeSheet()
    }
}

/// The journeys read from the calendar: how, from where to where, and when.
private struct LegRows: View {
    let legs: [Leg]
    let lang: Lang
    let at: (Int64) -> String

    var body: some View {
        ForEach(legs) { leg in
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: leg.mode == "train" ? "tram.fill" : leg.mode == "bus" ? "bus.fill" : "airplane")
                    .foregroundStyle(Theme.primary.color)
                    .frame(width: 24)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(
                        "\(CasyStrings.tripMode(leg.mode)): \(CasyStrings.tripRoute(cityName(leg.from, legs: legs, lang), cityName(leg.to, legs: legs, lang)))"
                    )
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.foreground.color)
                    Text(at(leg.start))
                        .font(.footnote)
                        .foregroundStyle(Theme.mutedForeground.color)
                }
            }
        }
    }
}

/// Picking the day a trip ends (or began) on a month like the phone's own date
/// picker: the journey's day marked, the days that can be picked not greyed,
/// and the stretch away shaded from the journey to the day picked.
private struct DayPicker: View {
    let allowed: [Int64]
    let journey: Int64
    @Binding var picked: Int64?
    let lang: Lang

    @State private var month: Int64 = 0

    var body: some View {
        let canPick = Set(allowed)
        let days = [journey] + allowed
        let first = startOfMonth(days.min() ?? journey, appTimeZone)
        let last = startOfMonth(days.max() ?? journey, appTimeZone)
        let shown = month == 0 ? startOfMonth(allowed.first ?? journey, appTimeZone) : month
        let (from, to) = picked.map { (min(journey, $0), max(journey, $0)) } ?? (journey, journey)
        VStack(spacing: 4) {
            HStack {
                Button {
                    month = startOfMonth(shown, appTimeZone, -1)
                } label: {
                    Image(systemName: "chevron.left").frame(width: 44, height: 44)
                }
                .disabled(shown <= first)
                .accessibilityLabel(CasyStrings.tripPreviousMonth)
                Spacer()
                Text(verbatim: "\(capitalize(monthName(shown, lang))) \(localDate(shown, appTimeZone).year)")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Button {
                    month = startOfMonth(shown, appTimeZone, 1)
                } label: {
                    Image(systemName: "chevron.right").frame(width: 44, height: 44)
                }
                .disabled(shown >= last)
                .accessibilityLabel(CasyStrings.tripNextMonth)
            }
            .buttonStyle(.plain)
            .foregroundStyle(Theme.primary.color)
            Grid(horizontalSpacing: 0, verticalSpacing: 2) {
                GridRow {
                    ForEach(0..<7, id: \.self) { i in
                        // From a Monday: 5 Oct 2026.
                        Text(String(weekdayShortName(addDays(Self.monday, i, appTimeZone), lang).prefix(1)).uppercased())
                            .font(.caption.weight(.medium))
                            .foregroundStyle(Theme.mutedForeground.color)
                            .frame(maxWidth: .infinity)
                    }
                }
                ForEach(weeks(shown), id: \.self) { week in
                    GridRow {
                        ForEach(0..<7, id: \.self) { i in
                            if let day = week[i] {
                                cell(day, canPick: canPick.contains(day), away: picked != nil && day >= from && day <= to)
                            } else {
                                Color.clear.frame(height: 44)
                            }
                        }
                    }
                }
            }
        }
        .padding(.vertical, 4)
    }

    private static let monday = wallTime(2026, 9, 5, 0, appTimeZone)

    /// The month's days by week, Monday first; nil outside the month.
    private func weeks(_ month: Int64) -> [[Int64?]] {
        let next = startOfMonth(month, appTimeZone, 1)
        var days: [Int64?] = Array(repeating: nil, count: (localDate(month, appTimeZone).dow + 6) % 7)
        var day = month
        while day < next {
            days.append(day)
            day = addDays(day, 1, appTimeZone)
        }
        while days.count % 7 != 0 { days.append(nil) }
        return stride(from: 0, to: days.count, by: 7).map { Array(days[$0..<$0 + 7]) }
    }

    private func cell(_ day: Int64, canPick: Bool, away: Bool) -> some View {
        let isPicked = day == picked
        let isJourney = day == journey
        return Button {
            picked = day
        } label: {
            ZStack(alignment: .bottom) {
                Text("\(localDate(day, appTimeZone).day)")
                    .font(.body.weight(isPicked || isJourney ? .semibold : .regular))
                    .foregroundStyle(
                        isPicked
                            ? Theme.primaryForeground.color
                            : isJourney
                                ? Theme.primary.color
                                : canPick ? Theme.foreground.color : Theme.mutedForeground.color.opacity(0.4)
                    )
                    .frame(width: 40, height: 40)
                    .background(isPicked ? Theme.primary.color : .clear, in: Circle())
                if isJourney && !isPicked {
                    Image(systemName: "airplane")
                        .font(.system(size: 8))
                        .foregroundStyle(Theme.primary.color)
                        .offset(y: -2)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(away ? Theme.primary.color.opacity(0.15) : .clear)
        }
        .buttonStyle(.plain)
        .disabled(!canPick)
        .accessibilityLabel(dayLabel(day, lang))
        .accessibilityAddTraits(isPicked ? .isSelected : [])
    }
}
