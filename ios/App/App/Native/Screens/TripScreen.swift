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
    /// No primary calendar yet: this phone's calendars to choose from for Læg i min kalender.
    var choices: [CalendarChoices]?
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

/// What we found about a trip, as the web's TripSheet (#281): the journeys
/// and the time away they make, with yes or no; or, where the journeys don't
/// pair, a question answered with a city or a day. No and deleting close the
/// sheet; every other answer keeps it open on the same trip as it now is.
/// One column with its buttons at the end, the sheet as tall as it is.
struct TripScreen: View {
    private let model = TripModel.shared
    @Environment(\.closeSheet) private var closeSheet
    @Environment(\.fitSheet) private var fitSheet
    @State private var picked: Int64?
    /// Slet rejsen pressed: asked first, as deleting always is (it is never suggested again).
    @State private var removing: TripMark?
    /// Which days to offer: fixed while the sheet is open.
    @State private var now = Native.now
    @State private var bar: CGFloat = 0
    @State private var content: CGFloat = 0

    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    var body: some View {
        let mark = model.mark
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
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
                if let failure = model.failure {
                    Text(failure)
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.red600.color)
                        .frame(maxWidth: .infinity)
                        .multilineTextAlignment(.center)
                        .padding(.top, 8)
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 16)
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { content = $0 }
        }
        .scrollBounceBehavior(.basedOnSize)
        .onGeometryChange(for: CGFloat.self) { $0.safeAreaInsets.top } action: { bar = $0 }
        .onChange(of: bar + content, initial: true) { _, height in
            if bar > 0, content > 0 { fitSheet(height) }
        }
        .accessibilityIdentifier("trip.screen")
        .casySheetBar(title(mark), close: CasyStrings.done, action: closeSheet)
        .onChange(of: mark?.id) { picked = nil }
        .askFirst(
            isPresented: Binding(get: { removing != nil }, set: { if !$0 { removing = nil } }), presenting: removing,
            words: { _ in AskWords(message: CasyStrings.tripRemoveAsk, confirm: CasyStrings.tripRemove) },
            action: { mark in decline(mark) })
        .sheet(isPresented: Binding(get: { model.choices != nil }, set: { if !$0 { model.choices = nil } })) {
            ChooseCalendarSheet(options: model.choices ?? []) { calendarId in
                model.choices = nil
                if let mark { HomeTrips.shared.add(mark.id, into: calendarId) }
            }
            .nativeSheetLook(NativePreferences.shared)
        }
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

    /// 14 point muted words (`text-sm text-muted-foreground`).
    private func small(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 14))
            .foregroundStyle(Theme.mutedForeground.color)
            .cssLineHeight(20, size: 14)
            .fixedSize(horizontal: false, vertical: true)
    }

    @ViewBuilder private func tripBody(_ mark: TripMark, _ trip: Trip) -> some View {
        // A day the person answered ends at midnight: say the day, not 00:00.
        let end =
            startOfDay(trip.end, appTimeZone) == trip.end ? formatDate(isoString(trip.end - 1), lang) : at(trip.end)
        Text(CasyStrings.tripFound)
            .font(.system(size: 15))
            .foregroundStyle(Theme.mutedForeground.color)
            .padding(.bottom, 12)
        LegList(legs: trip.legs, lang: lang, at: at)
        // A date ending the sentence may end in its own period: one is enough.
        Text(CasyStrings.tripAway(from: at(trip.start), to: end.hasSuffix(".") ? String(end.dropLast()) : end))
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(Theme.foreground.color)
            .cssLineHeight(22.5, size: 15)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.top, 16)
            .padding(.bottom, 8)
        small(trip.accepted ? CasyStrings.tripAcceptedNote : CasyStrings.tripAcceptNote)
            .padding(.bottom, 16)
        if trip.accepted {
            if trip.inCalendar == true {
                HStack(spacing: 8) {
                    LucideIcon("calendar-check", size: 20)
                    Text(model.addedTo.map(CasyStrings.tripAddedTo) ?? CasyStrings.tripInCalendar)
                }
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.emerald600.color)
                .frame(maxWidth: .infinity, minHeight: 48)
            } else {
                FlowButton(busy: model.adding, action: { model.act(.addToCalendar(mark.id)) }) {
                    Text(model.adding ? CasyStrings.tripAdding : CasyStrings.tripAddToCalendar)
                }
            }
            secondary(CasyStrings.tripRemove) { removing = mark }
        } else {
            FlowButton(action: { model.act(.accept(mark.id)) }) { Text(CasyStrings.tripAccept) }
                .accessibilityIdentifier("trip.accept")
            secondary(CasyStrings.tripDecline) { decline(mark) }
        }
    }

    @ViewBuilder private func homeBody(_ mark: TripMark, _ question: TripQuestion) -> some View {
        // The answer first, then what it is about.
        VStack(spacing: 8) {
            ForEach(question.cities ?? [], id: \.self) { city in
                FlowButton(action: { model.act(.home(city)) }) {
                    Text(cityName(city, legs: question.legs, lang))
                }
            }
        }
        .padding(.bottom, 16)
        LegList(legs: question.legs, lang: lang, at: at)
        small(CasyStrings.tripHomeIntro).padding(.top, 12)
        secondary(CasyStrings.tripNoneOfThem) { decline(mark) }
    }

    @ViewBuilder private func dayBody(_ mark: TripMark, _ question: TripQuestion) -> some View {
        let back = question.kind == "return"
        let legs = question.legs
        // The journey's own day: where the stretch away starts (or, asked when they left, ends).
        let journey = startOfDay((back ? legs.first : legs.last)?.start ?? now, appTimeZone)
        LegList(legs: legs, lang: lang, at: at)
        small(back ? CasyStrings.tripReturnIntro : CasyStrings.tripOutboundIntro)
            .padding(.top, 12)
            .padding(.bottom, 16)
        DayPicker(allowed: dayOptions(question, now: now), journey: journey, picked: $picked, lang: lang)
        FlowButton(action: {
            guard let picked else { return }
            model.act(back ? .returned(mark.id, picked) : .left(mark.id, picked))
        }) {
            Text(
                picked.map {
                    let day = shortDay($0)
                    return back ? CasyStrings.tripConfirmReturn(day) : CasyStrings.tripConfirmOutbound(day)
                } ?? CasyStrings.tripPickDay)
        }
        .disabled(picked == nil)
        .accessibilityIdentifier("trip.confirm")
        .padding(.top, 16)
        secondary(CasyStrings.tripNotATrip) { decline(mark) }
    }

    /// The day picked as the web's button says it: "man. 26. okt.".
    private func shortDay(_ day: Int64) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: lang == .en ? "en_GB" : "da_DK")
        formatter.timeZone = TimeZone(identifier: appTimeZone)
        formatter.setLocalizedDateFormatFromTemplate("EEE d MMM")
        return formatter.string(from: Date(timeIntervalSince1970: Double(day) / 1000))
    }

    /// The web's SecondaryButton: 48 high, 15 semibold orange words, nothing behind them.
    private func secondary(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.primary.color)
                .frame(maxWidth: .infinity, minHeight: 48)
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .padding(.top, 8)
    }

    private func decline(_ mark: TripMark) {
        model.act(.decline(mark.id))
        closeSheet()
    }
}

/// The journeys read from the calendar (the web's LegList: `divide-y
/// rounded-xl border`, each `px-3 py-2.5`): how (plane, train, bus in orange,
/// 20), from where to where (15 medium), and when (14 muted).
private struct LegList: View {
    let legs: [Leg]
    let lang: Lang
    let at: (Int64) -> String

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(legs.enumerated()), id: \.element.id) { index, leg in
                HStack(alignment: .top, spacing: 12) {
                    LucideIcon(leg.mode == "train" ? "train-front" : leg.mode == "bus" ? "bus" : "plane", size: 20)
                        .foregroundStyle(Theme.primary.color)
                        .padding(.top, 2)
                    VStack(alignment: .leading, spacing: 0) {
                        Text(
                            "\(CasyStrings.tripMode(leg.mode)): \(CasyStrings.tripRoute(cityName(leg.from, legs: legs, lang), cityName(leg.to, legs: legs, lang)))"
                        )
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(Theme.foreground.color)
                        .cssLineHeight(22.5, size: 15)
                        Text(at(leg.start))
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.mutedForeground.color)
                            .cssLineHeight(20, size: 14)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .modifier(TopLine(shown: index > 0))
            }
        }
        .overlay {
            RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Theme.border.color, lineWidth: 1)
        }
    }
}

/// `divide-y`: a hairline above every row but the first.
private struct TopLine: ViewModifier {
    let shown: Bool

    func body(content: Content) -> some View {
        if shown { content.hairlineAbove() } else { content }
    }
}

/// Picking the day a trip ends (or began), as the web's DayPicker
/// (`rounded-xl border p-2`): the month and its arrows (36, orange), the
/// weekdays (12 medium muted), the days (17 in 40 point circles, 44 high),
/// the journey's day orange with a small plane, the days that can't be picked
/// faint, and the stretch away shaded from the journey to the day picked.
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
        VStack(spacing: 0) {
            HStack {
                arrow("chevron-left", label: CasyStrings.tripPreviousMonth, enabled: shown > first) {
                    month = startOfMonth(shown, appTimeZone, -1)
                }
                Spacer()
                Text(verbatim: "\(capitalize(monthName(shown, lang))) \(localDate(shown, appTimeZone).year)")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.foreground.color)
                Spacer()
                arrow("chevron-right", label: CasyStrings.tripNextMonth, enabled: shown < last) {
                    month = startOfMonth(shown, appTimeZone, 1)
                }
            }
            .padding(.horizontal, 4)
            .padding(.bottom, 4)
            Grid(horizontalSpacing: 0, verticalSpacing: 0) {
                GridRow {
                    ForEach(0..<7, id: \.self) { i in
                        // From a Monday: 5 Oct 2026.
                        Text(String(weekdayShortName(addDays(Self.monday, i, appTimeZone), lang).prefix(1)).uppercased())
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(Theme.mutedForeground.color)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 4)
                    }
                }
                ForEach(weeks(shown), id: \.self) { week in
                    GridRow {
                        ForEach(0..<7, id: \.self) { i in
                            if let day = week[i] {
                                cell(day, canPick: canPick.contains(day), from: from, to: to)
                            } else {
                                Color.clear.frame(height: 44)
                            }
                        }
                    }
                }
            }
        }
        .padding(8)
        .overlay {
            RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Theme.border.color, lineWidth: 1)
        }
    }

    private func arrow(_ icon: String, label: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            LucideIcon(icon, size: 20)
                .foregroundStyle(enabled ? Theme.primary.color : Theme.mutedForeground.color.opacity(0.4))
                .frame(width: 36, height: 36)
                .contentShape(Circle().inset(by: -4))
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .accessibilityLabel(label)
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

    private func cell(_ day: Int64, canPick: Bool, from: Int64, to: Int64) -> some View {
        let isPicked = day == picked
        let isJourney = day == journey
        let away = picked != nil && day >= from && day <= to
        return Button {
            picked = day
        } label: {
            ZStack(alignment: .bottom) {
                Text("\(localDate(day, appTimeZone).day)")
                    .font(.system(size: 17, weight: isPicked || isJourney ? .semibold : .regular))
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
                    LucideIcon("plane", size: 10)
                        .foregroundStyle(Theme.primary.color)
                        .padding(.bottom, 2)
                }
            }
            .frame(width: 40, height: 40)
            .frame(maxWidth: .infinity, minHeight: 44)
            .background {
                // The stretch away, its ends rounded (`rounded-l-full`, `rounded-r-full`).
                if away {
                    UnevenRoundedRectangle(
                        topLeadingRadius: day == from ? 22 : 0, bottomLeadingRadius: day == from ? 22 : 0,
                        bottomTrailingRadius: day == to ? 22 : 0, topTrailingRadius: day == to ? 22 : 0
                    )
                    .fill(Theme.primary.color.opacity(0.15))
                }
            }
        }
        .buttonStyle(.plain)
        // Not `disabled`, which would fade the journey's own orange day further.
        .allowsHitTesting(canPick)
        .accessibilityAddTraits(canPick ? [] : .isStaticText)
        .accessibilityLabel(dayLabel(day, lang))
        .accessibilityAddTraits(isPicked ? .isSelected : [])
    }
}
