import CasyCore
import CasyUI
import SwiftUI

/// A day of the home page's month, opened as Apple Calendar's day view (the
/// web's DayView, #176, #201): the week row, then the hours with the day
/// first, one day or the day and the next (`span`). A sideways swipe on the
/// hours turns the days, on the week row a whole week; a tap on a number shows
/// that day. A tap on one of your events opens it in a sheet; on something the
/// page added (a vote's date, a trip) it is the page's, as on the month.
struct HomeDayView: View {
    @Binding var day: Int64
    let span: Int
    let pageTap: (Int64) -> Void

    private let model = HomeModel.shared
    @State private var event: ShownEvent?

    var body: some View {
        VStack(spacing: 0) {
            WeekStrip(day: $day, span: span)
            AllDayRows(days: days, column: nil, pageTap: pageTap, open: { event = $0 })
            DayHours(day: $day, span: span, pageTap: pageTap, open: { event = $0 })
        }
        .sheet(item: $event) { EventSheet(event: $0) }
    }

    private var days: [Int64] { (0..<span).map { addDays(day, $0, appTimeZone) } }
}

/// A segment opened in its sheet.
struct ShownEvent: Identifiable {
    let id = UUID()
    let segment: DaySegment
    let calendar: DayOfCalendar
}

// MARK: - The week row

/// Apple's week row over its day view: the numbers of the day's week, the day
/// in view in a circle (orange if it is today), a grey band under every day in
/// view, and a sideways swipe turning a whole week.
private struct WeekStrip: View {
    @Binding var day: Int64
    let span: Int

    @State private var drag: CGFloat = 0
    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    private var monday: Int64 {
        let dow = localDate(day, appTimeZone).dow
        return addDays(day, -((dow + 6) % 7), appTimeZone)
    }

    var body: some View {
        let today = startOfDay(Native.now, appTimeZone)
        let inView = Set((0..<span).map { addDays(day, $0, appTimeZone) })
        HStack(spacing: 0) {
            ForEach(0..<7, id: \.self) { c in
                let d = addDays(monday, c, appTimeZone)
                let selected = d == day
                Button {
                    withAnimation(.snappy) { day = d }
                } label: {
                    Text(verbatim: "\(localDate(d, appTimeZone).day)")
                        .font(.system(size: 18, weight: selected ? .semibold : .regular))
                        .foregroundStyle(
                            selected
                                ? (d == today ? .white : Theme.background.color)
                                : d == today ? Theme.cta.color : c >= 5 ? Theme.mutedForeground.color : Theme.foreground.color
                        )
                        .frame(width: 34, height: 34)
                        .background(
                            selected ? (d == today ? Theme.cta.color : Theme.foreground.color) : .clear, in: Circle())
                        .frame(maxWidth: .infinity)
                        .frame(height: 40)
                        .background(inView.contains(d) ? Theme.muted.color : .clear)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(dayLabel(d, lang))
                .accessibilityAddTraits(selected ? .isSelected : [])
                .accessibilityIdentifier("week.\(dayKey(d, appTimeZone))")
            }
        }
        .offset(x: drag)
        // Beside the numbers' own taps, not instead of them.
        .simultaneousGesture(
            DragGesture(minimumDistance: 12)
                .onChanged { drag = $0.translation.width / 3 }
                .onEnded { value in
                    let dx = value.translation.width
                    withAnimation(.snappy) {
                        drag = 0
                        if abs(dx) > 40 { day = addDays(day, dx < 0 ? 7 : -7, appTimeZone) }
                    }
                }
        )
        .padding(.bottom, 4)
    }
}

// MARK: - Whole days

/// The whole-day events at the top, up to three rows, the rest counted.
private struct AllDayRows: View {
    let days: [Int64]
    let column: CGFloat?
    let pageTap: (Int64) -> Void
    let open: (ShownEvent) -> Void

    private let model = HomeModel.shared
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let rows = days.map { d -> [(DaySegment, DayOfCalendar)] in
            let (calendar, _) = model.day(d)
            return calendar.segments.filter(\.allDay).map { ($0, calendar) }
        }
        if rows.contains(where: { !$0.isEmpty }) {
            HStack(alignment: .top, spacing: 4) {
                Color.clear.frame(width: DayHours.gutter - 4, height: 1)
                ForEach(Array(rows.enumerated()), id: \.offset) { _, list in
                    VStack(alignment: .leading, spacing: 2) {
                        ForEach(Array(list.prefix(3).enumerated()), id: \.offset) { _, pair in
                            let (s, calendar) = pair
                            let rgb = calendar.color(s.calendarId)
                            Button { open(ShownEvent(segment: s, calendar: calendar)) } label: {
                                Text(verbatim: calendar.label(s))
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(Color(rgb: CasyCore.shade(rgb, dark: scheme == .dark)))
                                    .lineLimit(1)
                                    .padding(.horizontal, 6)
                                    .frame(maxWidth: .infinity, minHeight: 22, alignment: .leading)
                                    .background(
                                        RoundedRectangle(cornerRadius: 5)
                                            .fill(Color(rgb: CasyCore.tint(rgb, dark: scheme == .dark))))
                            }
                            .buttonStyle(.plain)
                        }
                        if list.count > 3 {
                            Text(verbatim: "+\(list.count - 3)")
                                .font(.system(size: 11))
                                .foregroundStyle(Theme.mutedForeground.color)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .topLeading)
                }
            }
            .padding(.horizontal, 6)
            .padding(.bottom, 4)
        }
    }
}

// MARK: - The hours

/// The hours of the days in view: a sideways paging list of days (or pairs
/// of days) inside the hours' own scroll, so a sideways swipe turns the days
/// as iOS pages anything, and an up or down one scrolls the hours.
struct DayHours: View {
    @Binding var day: Int64
    let span: Int
    let pageTap: (Int64) -> Void
    let open: (ShownEvent) -> Void

    static let hourHeight: CGFloat = 46
    static let gutter: CGFloat = 52
    /// Pages drawn either side of where it opened; a jump further starts again from there.
    private static let reach = 120

    @State private var anchor: Int64?
    @State private var now = Native.now

    private var pages: [Int64] {
        let from = anchor ?? day
        return (-Self.reach...Self.reach).map { addDays(from, $0 * span, appTimeZone) }
    }

    var body: some View {
        GeometryReader { box in
            let width = box.size.width - Self.gutter
            ScrollViewReader { reader in
                ScrollView {
                    HStack(alignment: .top, spacing: 0) {
                        HourLabels()
                        ScrollView(.horizontal) {
                            LazyHStack(spacing: 0) {
                                ForEach(pages, id: \.self) { first in
                                    HStack(spacing: 0) {
                                        ForEach(0..<span, id: \.self) { n in
                                            DayColumn(
                                                midnight: addDays(first, n, appTimeZone), now: now, pageTap: pageTap,
                                                open: open)
                                        }
                                    }
                                    .frame(width: width)
                                    .id(first)
                                }
                            }
                            .scrollTargetLayout()
                        }
                        .scrollTargetBehavior(.paging)
                        .scrollIndicators(.hidden)
                        .scrollPosition(
                            id: Binding(get: { Optional(day) }, set: { if let d = $0, d != day { day = d } })
                        )
                        .frame(width: width, height: Self.hourHeight * 24)
                    }
                    .padding(.vertical, 10)
                }
                .accessibilityIdentifier("day.hours")
                .onAppear {
                    anchor = day
                    scrollToOpening(reader)
                }
                .onChange(of: day) { _, new in
                    // A day not among the pages (a week turned far, I dag): start from it.
                    if !pages.contains(new) { anchor = new }
                    scrollToOpening(reader)
                }
                .onChange(of: span) { _, _ in anchor = day }
            }
        }
        .task {
            // The line of the time now moves on each minute.
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(60))
                now = Native.now
            }
        }
    }

    /// Today on the time now, another day an hour before its first event, else 08:00
    /// (dayColumns.ts's `openingOf`).
    private func scrollToOpening(_ reader: ScrollViewProxy) {
        let today = startOfDay(Native.now, appTimeZone)
        let shown = (0..<span).map { addDays(day, $0, appTimeZone) }
        if shown.contains(today) {
            let hour = Int(placeSpan(Native.now, Native.now + 1, midnight: today, appTimeZone).top * 24)
            reader.scrollTo("hour.\(hour)", anchor: .center)
            return
        }
        let firsts = shown.flatMap { d in
            HomeModel.shared.day(d).calendar.segments.filter { !$0.allDay }
                .map { placeSpan($0.start, $0.end, midnight: d, appTimeZone).top }
        }
        let hour = firsts.min().map { max(0, Int($0 * 24) - 1) } ?? 8
        reader.scrollTo("hour.\(hour)", anchor: .top)
    }
}

/// The hours down the left, each line across the days.
private struct HourLabels: View {
    var body: some View {
        VStack(spacing: 0) {
            ForEach(0..<25, id: \.self) { h in
                Text(verbatim: h < 24 ? formatClockMinutes(h * 60) : "")
                    .font(.system(size: 11).monospacedDigit())
                    .foregroundStyle(Theme.mutedForeground.color)
                    .frame(width: DayHours.gutter - 8, alignment: .trailing)
                    .frame(height: h < 24 ? DayHours.hourHeight : 0, alignment: .top)
                    .offset(y: -7)
                    .id("hour.\(h)")
            }
        }
        .frame(width: DayHours.gutter, alignment: .leading)
        .accessibilityHidden(true)
    }
}

/// One day's hours: the lines, your blocks placed as Apple Calendar does, the
/// page's own items, and the time now on today.
private struct DayColumn: View {
    let midnight: Int64
    let now: Int64
    let pageTap: (Int64) -> Void
    let open: (ShownEvent) -> Void

    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let (calendar, extras) = HomeModel.shared.day(midnight)
        let hour = DayHours.hourHeight
        GeometryReader { box in
            let width = box.size.width - 4
            ZStack(alignment: .topLeading) {
                ForEach(0..<25, id: \.self) { h in
                    Rectangle().fill(Theme.border.color).frame(height: 0.5).offset(y: CGFloat(h) * hour)
                }
                Rectangle().fill(Theme.border.color).frame(width: 0.5)
                ForEach(
                    Array(
                        placeBlocks(calendar.segments.filter { !$0.allDay }, midnight: midnight, appTimeZone, minHeight: 0.5 / 24)
                            .enumerated()), id: \.offset
                ) { _, p in
                    let rgb = calendar.color(p.segment.calendarId)
                    Button { open(ShownEvent(segment: p.segment, calendar: calendar)) } label: {
                        block(calendar.label(p.segment), time: p.height * 24 * hour >= 40 ? range(p.segment) : nil, rgb: rgb)
                    }
                    .buttonStyle(.plain)
                    .frame(width: max(0, width * p.width - 2), height: max(14, p.height * 24 * hour - 2))
                    .offset(x: 2 + width * p.left, y: p.top * 24 * hour)
                    .accessibilityLabel("\(calendar.label(p.segment)), \(range(p.segment))")
                }
                ForEach(Array(extras.enumerated()), id: \.offset) { _, item in
                    let span = placeSpan(max(item.start, midnight), item.end, midnight: midnight, appTimeZone)
                    Button { pageTap(midnight) } label: { extra(item) }
                        .buttonStyle(.plain)
                        .frame(width: width, height: max(18, span.height * 24 * hour - 2))
                        .offset(x: 2, y: span.top * 24 * hour)
                        .accessibilityLabel(item.label)
                }
                if startOfDay(now, appTimeZone) == midnight {
                    let y = placeSpan(now, now + 1, midnight: midnight, appTimeZone).top * 24 * hour
                    Rectangle().fill(Theme.cta.color).frame(height: 2).offset(y: y - 1)
                    Circle().fill(Theme.cta.color).frame(width: 9, height: 9).offset(x: -4.5, y: y - 4.5)
                }
            }
        }
        .frame(height: hour * 24)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("column.\(dayKey(midnight, appTimeZone))")
    }

    private func range(_ s: DaySegment) -> String { formatSegmentRange(s, appTimeZone, allDay: CasyStrings.dayAllDay) }

    private func block(_ name: String, time: String?, rgb: String) -> some View {
        let dark = scheme == .dark
        return RoundedRectangle(cornerRadius: 5)
            .fill(Color(rgb: CasyCore.tint(rgb, dark: dark)))
            .overlay(alignment: .leading) { Rectangle().fill(Color(rgb: rgb)).frame(width: 3) }
            .overlay(alignment: .topLeading) {
                VStack(alignment: .leading, spacing: 1) {
                    Text(verbatim: name).font(.system(size: 12, weight: .semibold)).lineLimit(2)
                    if let time { Text(verbatim: time).font(.system(size: 11)).lineLimit(1) }
                }
                .foregroundStyle(Color(rgb: CasyCore.shade(rgb, dark: dark)))
                .padding(.leading, 7)
                .padding(.top, 2)
            }
            .clipShape(RoundedRectangle(cornerRadius: 5))
    }

    private func extra(_ item: MonthItem) -> some View {
        let shape = RoundedRectangle(cornerRadius: 5)
        let rgb = HomeModel.shared.color(item.calendarId)
        return Group {
            if item.pencil == true {
                shape.fill(Theme.primary.color.opacity(0.1))
                    .overlay(shape.strokeBorder(Theme.primary.color, style: StrokeStyle(lineWidth: 1, dash: [3, 2])))
            } else {
                shape.fill(Color(rgb: CasyCore.tint(rgb, dark: scheme == .dark)))
            }
        }
        .overlay(alignment: .topLeading) {
            Text(verbatim: item.label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(item.pencil == true ? Theme.primary.color : Color(rgb: CasyCore.shade(rgb, dark: scheme == .dark)))
                .padding(.horizontal, 7)
                .padding(.top, 2)
                .lineLimit(2)
        }
    }
}

// MARK: - An event

/// One of your events, opened (the web's DayRow in its sheet): its name, its
/// time and calendar, where it is, its notes, and whether it carries on.
private struct EventSheet: View {
    let event: ShownEvent
    @Environment(\.dismiss) private var dismiss

    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    var body: some View {
        let s = event.segment
        let calendar = HomeModel.shared.calendars.first { $0.id == s.calendarId }
        let holiday = s.calendarId == holidayCalendarId
        let range = formatSegmentRange(s, appTimeZone, allDay: CasyStrings.dayAllDay)
        let duration = s.allDay ? "" : formatDuration(s.start, s.end, hourUnit: CasyStrings.dayHourUnit)
        NavigationStack {
            List {
                Section {
                    ListRow(
                        formatLongDate(isoString(startOfDay(s.start, appTimeZone)), lang), systemImage: "calendar",
                        detail: [range, duration].filter { !$0.isEmpty }.joined(separator: " "))
                    if holiday {
                        ListRow(CasyStrings.dayPublicHoliday, systemImage: "flag", detail: CasyStrings.dayDenmark)
                    } else {
                        ListRow(
                            calendar?.name ?? (s.calendarId == casyCalendarId ? CasyStrings.dayCasyPill : CasyStrings.dayCalendarFallback),
                            systemImage: "square.3.layers.3d",
                            value: calendar.map {
                                categoryLabel(
                                    purpose: $0.purpose, categoryName: $0.categoryName, categories: CasyStrings.category,
                                    none: CasyStrings.calendarsNoCategory)
                            })
                    }
                    if let location = s.details?.location, !location.isEmpty {
                        ListRow(location, systemImage: "mappin.and.ellipse")
                    }
                    if let carries = continues(s) {
                        ListRow(carries, systemImage: "arrow.left.and.right")
                    }
                }
                .halfSheetRow()
                if let notes = s.details?.notes, !notes.isEmpty {
                    Section {
                        Text(notes)
                            .font(.subheadline)
                            .foregroundStyle(Theme.mutedForeground.color)
                    }
                    .halfSheetRow()
                }
            }
            .solidHalfSheet()
            .casySheetBar(event.calendar.label(s), close: CasyStrings.close) { dismiss() }
        }
        .presentationDetents([.medium, .large])
        .tint(Theme.primary.color)
    }

    private func continues(_ s: DaySegment) -> String? {
        if s.calendarId == holidayCalendarId { return nil }
        if s.continuesBefore && s.continuesAfter { return CasyStrings.dayContinuesBoth }
        if s.continuesBefore { return CasyStrings.dayContinuesBefore }
        if s.continuesAfter { return CasyStrings.dayContinuesAfter }
        return nil
    }
}
