import CasyAPI
import CasyCore
import CasyUI
import EventKit
import SwiftUI

/// An agreed event's day in your own calendar (#199), as the web's DaySlice:
/// a slice of the day, its hours squeezed so the whole event fits with an
/// hour either side (five hours at the least), the event drawn solid in
/// Casy's orange among your own blocks, so whether it fits is seen rather
/// than said. A tap opens that day in the day view (still the page's).
///
/// Your calendars come from calendar-busy; this phone's own calendars are
/// read from the phone, with their titles and Apple's colours, as on the web
/// (useMyCalendarDays): what is read here never leaves the phone.
struct DaySlice: View {
    let start: Int64
    let end: Int64
    let label: String
    let onOpen: (_ day: Int64) -> Void

    @Environment(\.colorScheme) private var scheme
    @State private var day: DayOfCalendar?

    private static let leastHours = 5.0
    private static let aroundHours = 1.0
    private static let height: CGFloat = 260
    private static let gutter: CGFloat = 52

    private var midnight: Int64 { startOfDay(start, appTimeZone) }

    var body: some View {
        Group {
            if let day, !day.none {
                Button {
                    onOpen(midnight)
                } label: {
                    slice(day)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(CasyStrings.eventsOpenDay)
            } else {
                // Something to draw while it loads: a list never starts an empty row's task.
                Color.clear.frame(height: 1)
            }
        }
        .task(id: start) { day = await DayOfCalendar.load(midnight)?.without(start: start, end: end, midnight: midnight) }
    }

    /// The hours shown: the event with an hour either side (five at the
    /// least), centred on the event as the web's slice is (DayColumns' `aim`);
    /// an event of most of the day opens at 08:00.
    private var window: (from: Double, hours: Double) {
        let next = addDays(midnight, 1, appTimeZone)
        let onDay = Double(min(end, next) - start) / 3_600_000
        let hours = min(24, max(Self.leastHours, onDay + 2 * Self.aroundHours))
        let span = placeSpan(start, end, midnight: midnight, appTimeZone)
        let centre = span.height > 0.8 ? 8 + hours / 2 : (span.top + span.height / 2) * 24
        let from = min(max(0, centre - hours / 2), 24 - hours)
        return (from, hours)
    }

    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    /// The web's DayColumns for one day (size "full", `fitHours`): the
    /// names row (44 high: the week in the 52 point gutter, 15 muted; the
    /// day, 15 semibold, orange as the event is on it), the whole days
    /// under a line, then the hours fitted into what is left.
    private func slice(_ day: DayOfCalendar) -> some View {
        let allDay = day.segments.filter(\.allDay)
        let local = localDate(midnight, appTimeZone)
        let sep = lang == .da ? "." : ""
        return VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 0) {
                Text(verbatim: CasyStrings.dayWeek(isoWeekNumber(midnight, appTimeZone)))
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.mutedForeground.color)
                    .frame(width: Self.gutter)
                Text(
                    verbatim:
                        "\(weekdayName(midnight, lang)) \(local.day)\(sep) \(monthShortName(midnight, lang)) \(local.year)"
                )
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.primary.color)
                .lineLimit(1)
                .frame(maxWidth: .infinity)
            }
            .frame(height: 44)
            .overlay(alignment: .bottom) { Rectangle().fill(Theme.border.color).frame(height: 1) }
            if !allDay.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(Array(allDay.prefix(2).enumerated()), id: \.offset) { _, s in
                        chip(day.label(s), rgb: day.color(s.calendarId))
                    }
                }
                .padding(.horizontal, 2)
                .padding(.vertical, 1)
                .padding(.leading, Self.gutter)
                .overlay(alignment: .bottom) { Rectangle().fill(Theme.border.color).frame(height: 1) }
            }
            GeometryReader { geo in
                hours(day, size: geo.size)
            }
        }
        .frame(height: Self.height)
        .frame(maxWidth: .infinity)
        .background(Theme.card.color)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.border.color))
        .contentShape(RoundedRectangle(cornerRadius: 16))
    }

    /// Hour lines from the gutter (the border at 80 %), labelled "08:00" (12
    /// muted, right-aligned 6 in), every other hour when an hour is under 18
    /// points; the day's column edged at the gutter; your blocks as the day
    /// view draws them; the event pencilled in over them.
    private func hours(_ day: DayOfCalendar, size: CGSize) -> some View {
        let (from, hours) = window
        let hourPx = size.height / hours
        let width = size.width - Self.gutter
        let y = { (fraction: Double) in (fraction * 24 - from) * hourPx }
        let at = { (h: Int) in
            placeSpan(
                atHour(midnight, Double(h), appTimeZone), atHour(midnight, Double(h), appTimeZone) + 1,
                midnight: midnight, appTimeZone
            ).top * 24
        }
        let step = hourPx < 18 ? 2 : 1
        return ZStack(alignment: .topLeading) {
            ForEach(Array((1...23).filter { $0 % step == 0 }), id: \.self) { h in
                let top = y(at(h) / 24)
                Rectangle()
                    .fill(Theme.border.color.opacity(0.8))
                    .frame(width: width, height: 1)
                    .offset(x: Self.gutter, y: top)
                Text(verbatim: formatClockMinutes(h * 60))
                    .font(.system(size: 12).monospacedDigit())
                    .foregroundStyle(Theme.mutedForeground.color)
                    .frame(width: Self.gutter - 6, height: 16, alignment: .trailing)
                    .offset(y: top - 8)
            }
            Rectangle()
                .fill(Theme.border.color.opacity(0.6))
                .frame(width: 1, height: size.height)
                .offset(x: Self.gutter)
            // Your own blocks, placed as Apple Calendar does.
            ForEach(
                Array(placeBlocks(day.segments, midnight: midnight, appTimeZone, minHeight: 22.0 / (24 * hourPx)).enumerated()),
                id: \.offset
            ) { _, p in
                let px = p.height * 24 * hourPx
                block(
                    day.label(p.segment),
                    time: px >= 40 ? formatSegmentRange(p.segment, appTimeZone, allDay: CasyStrings.dayAllDay) : nil,
                    rgb: day.color(p.segment.calendarId)
                )
                .frame(width: max(0, width * p.width - 4), height: max(0, px - 2))
                .offset(x: Self.gutter + width * p.left + 2, y: y(p.top) + 1)
            }
            // The event, pencilled in as the web's lit pencil: a 2 point orange
            // border, the orange at 20 %, its name 13 bold and its time in orange.
            let span = placeSpan(start, end, midnight: midnight, appTimeZone)
            let px = max(span.height * 24 * hourPx, 22)
            RoundedRectangle(cornerRadius: 5)
                .fill(Theme.primary.color.opacity(0.2))
                .overlay(RoundedRectangle(cornerRadius: 5).strokeBorder(Theme.primary.color, lineWidth: 2))
                .overlay(alignment: .topLeading) {
                    VStack(alignment: .leading, spacing: 0) {
                        Text(label)
                            .font(.system(size: 13, weight: .bold))
                            .lineLimit(1)
                            .frame(height: 18)
                        if px >= 40 {
                            Text(verbatim: "\(formatTime(isoString(start)))-\(formatTime(isoString(end)))")
                                .font(.system(size: 12).monospacedDigit())
                        }
                    }
                    .foregroundStyle(Theme.primary.color)
                    .padding(.horizontal, 8)
                    .padding(.top, 2)
                }
                .frame(width: width - 4, height: px)
                .offset(x: Self.gutter + 2, y: y(span.top))
        }
        .frame(width: size.width, height: size.height, alignment: .topLeading)
        .clipped()
    }

    /// The day view's block: the calendar's tint, rounded 5, a 3 point bar of
    /// its colour 2 in; the name 13 semibold, from two lines a clock and the
    /// time (12), in the calendar's darker shade.
    private func block(_ name: String, time: String?, rgb: String) -> some View {
        let dark = scheme == .dark
        let shape = RoundedRectangle(cornerRadius: 5)
        return shape.fill(Color(rgb: CasyCore.tint(rgb, dark: dark)))
            .overlay(alignment: .leading) {
                Capsule().fill(Color(rgb: rgb)).frame(width: 3).padding(.vertical, 2).padding(.leading, 2)
            }
            .overlay(alignment: .topLeading) {
                VStack(alignment: .leading, spacing: 0) {
                    Text(verbatim: name)
                        .font(.system(size: 13, weight: .semibold))
                        .lineLimit(1)
                        .frame(height: 17)
                    if let time {
                        HStack(spacing: 2) {
                            LucideIcon("clock", size: 12)
                            Text(verbatim: time).font(.system(size: 12).monospacedDigit()).lineLimit(1)
                        }
                        .frame(height: 18)
                        .opacity(0.9)
                    }
                }
                .foregroundStyle(Color(rgb: CasyCore.shade(rgb, dark: dark)))
                .padding(.leading, 8)
                .padding(.trailing, 4)
                .padding(.top, 2)
            }
            .clipShape(shape)
    }

    /// A whole day's entry: 12 semibold on a 20 line, its colour's bar on the left.
    private func chip(_ name: String, rgb: String) -> some View {
        let dark = scheme == .dark
        return Text(name)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(Color(rgb: CasyCore.shade(rgb, dark: dark)))
            .lineLimit(1)
            .padding(.horizontal, 4)
            .frame(maxWidth: .infinity, minHeight: 20, alignment: .leading)
            .background(Color(rgb: CasyCore.tint(rgb, dark: dark)))
            .overlay(alignment: .leading) { Rectangle().fill(Color(rgb: rgb)).frame(width: 3) }
            .clipShape(RoundedRectangle(cornerRadius: 4))
    }
}

/// One day of your calendar, as the web's useMyCalendarDays builds it.
struct DayOfCalendar {
    let segments: [DaySegment]
    let colors: [String: String]
    let names: [String: String]
    let holidays: [String: String]
    /// No calendar connected at all: nothing to draw.
    let none: Bool

    func color(_ calendarId: String) -> String { colors[calendarId] ?? "113, 113, 122" }

    /// Without the copy of an event already in your calendar: a block of
    /// yours at exactly the event's times on this day is the one written
    /// there for it (as homeVotes' scheduledItems reads it), so the event is
    /// drawn once, in its own colour, never over its copy.
    func without(start: Int64, end: Int64, midnight: Int64) -> DayOfCalendar {
        let from = max(start, midnight)
        let to = min(end, addDays(midnight, 1, appTimeZone))
        return DayOfCalendar(
            segments: segments.filter { $0.allDay || !($0.start == from && $0.end == to) },
            colors: colors, names: names, holidays: holidays, none: none)
    }

    func label(_ s: DaySegment) -> String {
        if s.calendarId == holidayCalendarId { return holidays[dayKey(s.start, appTimeZone)] ?? "" }
        if let title = s.details?.title, !title.isEmpty { return title }
        return names[s.calendarId] ?? ""
    }

    @MainActor static func load(_ midnight: Int64) async -> DayOfCalendar? {
        guard let api = await Native.api() else { return nil }
        let next = addDays(midnight, 1, appTimeZone)
        guard let data = try? await api.calendarBusy(from: isoString(midnight), to: isoString(next)) else {
            return nil
        }
        let (blocks, own) = await Task.detached(priority: .userInitiated) {
            phoneDrawn(data, from: midnight, to: next)
        }.value
        let included = Set(data.calendars.filter(\.included).map(\.id))
        // What you told Casy has no tick: it always counts, so it is always drawn.
        let counted =
            blocks.filter { included.contains($0.calendarId) }
            + (data.entries ?? []).map {
                OverviewBlock(
                    calendarId: casyCalendarId, start: $0.start, end: $0.end,
                    details: EventDetails(title: $0.label, location: "", notes: ""))
            }
        var segments = segmentByDay(counted, from: midnight, to: next, appTimeZone)[dayKey(midnight, appTimeZone)] ?? []
        // The Danish holidays first, as whole days.
        let year = localDate(midnight, appTimeZone).year
        let lang = CasyStrings.language == "en" ? Lang.en : Lang.da
        var holidayNames: [String: String] = [:]
        let holidays = danishHolidays(year, appTimeZone).filter { $0.date == midnight }
        for h in holidays {
            holidayNames[h.key] = lang == .da ? h.name : h.englishName
        }
        segments =
            holidays.map {
                DaySegment(
                    calendarId: holidayCalendarId, start: $0.date, end: next, allDay: true,
                    continuesBefore: false, continuesAfter: false, details: nil)
            } + segments
        return DayOfCalendar(
            segments: segments, colors: calendarColors(data.calendars, own: own),
            names: Dictionary(data.calendars.map { ($0.id, $0.name) }, uniquingKeysWith: { a, _ in a }),
            holidays: holidayNames, none: data.calendars.isEmpty)
    }

    /// This phone's calendars drawn from the phone: their events with titles,
    /// in Apple's colours. Its calendars are those whose EventKit ids are here.
    /// One store for the app's life: making one is costly.
    nonisolated(unsafe) private static let store = EKEventStore()

    /// This phone's calendars' colours in Apple Calendar (#220), by their ids
    /// here; none without access. Read off the main thread.
    nonisolated static func phoneColors(_ calendars: [OverviewCalendar]) -> [String: String] {
        guard PhoneCalendarReader.accessState() == "granted" else { return [:] }
        let here = Dictionary(
            PhoneCalendarReader.readable(store).map { ($0.calendarIdentifier, $0) }, uniquingKeysWith: { a, _ in a })
        guard let connection = calendars.first(where: { $0.externalId.map { here[$0] != nil } ?? false })?.connectionId
        else { return [:] }
        var own: [String: String] = [:]
        for (external, id) in phoneCalendarIds(calendars, connectionId: connection) {
            let rgb = PhoneCalendarReader.rgb(of: here[external]?.cgColor)
            if !rgb.isEmpty { own[id] = rgb }
        }
        return own
    }

    /// Read off the main thread: EventKit's fetch can take a moment.
    nonisolated static func phoneDrawn(
        _ data: OverviewData, from: Int64, to: Int64
    ) -> ([OverviewBlock], [String: String]) {
        guard PhoneCalendarReader.accessState() == "granted" else { return (data.blocks, [:]) }
        let here = Dictionary(
            PhoneCalendarReader.readable(store).map { ($0.calendarIdentifier, $0) }, uniquingKeysWith: { a, _ in a })
        guard let connection = data.calendars.first(where: { $0.externalId.map { here[$0] != nil } ?? false })?.connectionId
        else { return (data.blocks, [:]) }
        let serverIdOf = phoneCalendarIds(data.calendars, connectionId: connection)
        let events = PhoneCalendarReader.readDetails(store: store, from: Double(from), to: Double(to)).map {
            PhoneEventWithDetails(
                event: PhoneEvent(
                    calendarId: $0.timing.calendarId, allDay: $0.timing.allDay, free: $0.timing.free,
                    cancelled: $0.timing.cancelled, declined: $0.timing.declined,
                    start: $0.timing.start.map { Int64($0) }, end: $0.timing.end.map { Int64($0) },
                    startDay: $0.timing.startDay, endDay: $0.timing.endDay),
                title: $0.title, location: $0.location, notes: $0.notes)
        }
        var own: [String: String] = [:]
        for (external, id) in serverIdOf {
            let rgb = PhoneCalendarReader.rgb(of: here[external]?.cgColor)
            if !rgb.isEmpty { own[id] = rgb }
        }
        return (withPhoneEvents(data.blocks, events, serverIdOf: serverIdOf, from: from, to: to), own)
    }
}

extension Color {
    /// A colour as the web writes one, "r, g, b".
    init(rgb: String) {
        let c = rgb.split(separator: ",").map { Double($0.trimmingCharacters(in: .whitespaces)) ?? 0 }
        self.init(red: (c.first ?? 0) / 255, green: (c.count > 1 ? c[1] : 0) / 255, blue: (c.count > 2 ? c[2] : 0) / 255)
    }
}
