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
    private static let gutter: CGFloat = 40
    private static let allDayRow: CGFloat = 22

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
        .task(id: start) { day = await DayOfCalendar.load(midnight) }
    }

    /// The hours shown: the event with an hour either side, as one window of the day.
    private var window: (from: Double, hours: Double) {
        let next = addDays(midnight, 1, appTimeZone)
        let onDay = Double(min(end, next) - start) / 3_600_000
        let hours = min(24, max(Self.leastHours, onDay + 2 * Self.aroundHours))
        let startHour = placeSpan(start, start + 1, midnight: midnight, appTimeZone).top * 24
        let from = min(max(0, startHour - Self.aroundHours), 24 - hours)
        return (from, hours)
    }

    private func slice(_ day: DayOfCalendar) -> some View {
        let allDay = day.segments.filter(\.allDay)
        let top = allDay.isEmpty ? 0 : CGFloat(min(allDay.count, 2)) * Self.allDayRow + 6
        return VStack(alignment: .leading, spacing: 0) {
            if !allDay.isEmpty {
                VStack(alignment: .leading, spacing: 2) {
                    ForEach(Array(allDay.prefix(2).enumerated()), id: \.offset) { _, s in
                        chip(day.label(s), rgb: day.color(s.calendarId))
                    }
                }
                .padding(.horizontal, 6)
                .padding(.top, 6)
                .padding(.leading, Self.gutter - 6)
            }
            GeometryReader { geo in
                hours(day, size: geo.size)
            }
        }
        .frame(height: Self.height)
        .frame(maxWidth: .infinity)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.card.color))
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.border.color))
        .contentShape(RoundedRectangle(cornerRadius: 16))
        .padding(.top, top == 0 ? 0 : 0)
    }

    private func hours(_ day: DayOfCalendar, size: CGSize) -> some View {
        let (from, hours) = window
        let hourPx = size.height / hours
        let width = size.width - Self.gutter - 6
        let y = { (fraction: Double) in (fraction * 24 - from) * hourPx }
        return ZStack(alignment: .topLeading) {
            // The hour lines and their times.
            ForEach(Array(stride(from: Int(from.rounded(.up)), through: Int(from + hours), by: 1)), id: \.self) { h in
                let top = (Double(h) - from) * hourPx
                // A time cut by the card's edge is left out; its line stays.
                let fits = top >= 8 && top <= size.height - 8
                HStack(spacing: 4) {
                    Text(fits ? formatClockMinutes(h * 60) : "")
                        .font(.system(size: 10).monospacedDigit())
                        .foregroundStyle(Theme.mutedForeground.color)
                        .frame(width: Self.gutter - 6, alignment: .trailing)
                    Rectangle().fill(Theme.border.color).frame(height: 0.5)
                }
                .offset(y: top - 6)
            }
            // Your own blocks, placed as Apple Calendar does.
            ForEach(Array(placeBlocks(day.segments, midnight: midnight, appTimeZone, minHeight: 0.6 / 24).enumerated()), id: \.offset) { _, p in
                let rgb = day.color(p.segment.calendarId)
                block(day.label(p.segment), rgb: rgb)
                    .frame(width: max(0, width * p.width - 2), height: max(0, p.height * 24 * hourPx - 2))
                    .offset(x: Self.gutter + width * p.left, y: y(p.top))
            }
            // The event itself, solid in Casy's orange.
            let span = placeSpan(start, end, midnight: midnight, appTimeZone)
            RoundedRectangle(cornerRadius: 6)
                .fill(Theme.cta.color)
                .overlay(alignment: .topLeading) {
                    Text(label)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .lineLimit(2)
                }
                .frame(width: width, height: max(18, span.height * 24 * hourPx - 2))
                .offset(x: Self.gutter, y: y(span.top))
        }
        .frame(width: size.width, height: size.height, alignment: .topLeading)
        .clipped()
    }

    private func block(_ name: String, rgb: String) -> some View {
        let dark = scheme == .dark
        return RoundedRectangle(cornerRadius: 5)
            .fill(Color(rgb: CasyCore.tint(rgb, dark: dark)))
            .overlay(alignment: .leading) {
                Rectangle().fill(Color(rgb: rgb)).frame(width: 3)
            }
            .overlay(alignment: .topLeading) {
                Text(name)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Color(rgb: CasyCore.shade(rgb, dark: dark)))
                    .padding(.leading, 7)
                    .padding(.top, 2)
                    .lineLimit(1)
            }
            .clipShape(RoundedRectangle(cornerRadius: 5))
    }

    private func chip(_ name: String, rgb: String) -> some View {
        let dark = scheme == .dark
        return Text(name)
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(Color(rgb: CasyCore.shade(rgb, dark: dark)))
            .lineLimit(1)
            .padding(.horizontal, 6)
            .frame(maxWidth: .infinity, minHeight: Self.allDayRow - 2, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 5).fill(Color(rgb: CasyCore.tint(rgb, dark: dark))))
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
        let (blocks, own) = phoneDrawn(data, from: midnight, to: next)
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
    private static func phoneDrawn(_ data: OverviewData, from: Int64, to: Int64) -> ([OverviewBlock], [String: String]) {
        guard PhoneCalendarReader.accessState() == "granted" else { return (data.blocks, [:]) }
        let store = EKEventStore()
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
