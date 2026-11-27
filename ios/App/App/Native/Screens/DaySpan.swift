import CasyCore
import CasyUI
import SwiftUI

/// An agreed event over several days (a trip, a weekend away, #202), where
/// one day's slice would say little: up to a week, a column per day as Apple
/// Calendar's multi-day view, the event one orange block from its start on
/// the first day to its end on the last, your own blocks in their columns;
/// longer, a month strip, the event a bar over its days and your busy days
/// dotted. A tap opens the day tapped (the first, on the strip).
struct DaySpan: View {
    let start: Int64
    let end: Int64
    let label: String
    let days: [Int64]
    let onOpen: (_ day: Int64) -> Void

    @Environment(\.colorScheme) private var scheme
    @State private var read: [Int64: DayOfCalendar]?

    private static let columnsUpTo = 7
    private static let height: CGFloat = 260
    private static let gutter: CGFloat = 44
    private static let header: CGFloat = 44
    private static let row: CGFloat = 36

    init(start: Int64, end: Int64, label: String, days: [Int64], onOpen: @escaping (_ day: Int64) -> Void) {
        self.start = start
        self.end = end
        self.label = label
        self.days = days
        self.onOpen = onOpen
        let kept = days.compactMap { m in DayOfCalendar.kept(m).map { (m, $0) } }
        _read = State(initialValue: kept.count == days.count ? Dictionary(uniqueKeysWithValues: kept) : nil)
    }

    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    var body: some View {
        Group {
            if let read, !(read.values.first?.none ?? true) {
                if days.count <= Self.columnsUpTo { columns(read) } else { strip(read) }
            } else {
                Color.clear.frame(height: 1)
            }
        }
        .task(id: start) {
            if let fresh = await DayOfCalendar.readDays(days) { read = fresh }
        }
    }

    private func own(_ day: DayOfCalendar, _ midnight: Int64) -> DayOfCalendar {
        day.without(start: start, end: end, midnight: midnight)
    }

    // MARK: Up to a week: a column per day

    /// The hours shown: from an hour before it starts (08:00 at the latest)
    /// to an hour after it ends (22:00 at the earliest), one range for every column.
    private var window: (from: Double, to: Double) {
        let first = days[0]
        let last = days[days.count - 1]
        let startHour = Double(start - first) / 3_600_000
        let endHour = Double(end - last) / 3_600_000
        let from = max(0, min(8, (startHour - 1).rounded(.down)))
        let to = min(25, max(22, (endHour + 1).rounded(.up)))
        return (from, to)
    }

    private func columns(_ read: [Int64: DayOfCalendar]) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                Text(verbatim: CasyStrings.dayWeek(isoWeekNumber(days[0], appTimeZone)))
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.mutedForeground.color)
                    .frame(width: Self.gutter)
                ForEach(days, id: \.self) { m in
                    VStack(spacing: 0) {
                        Text(verbatim: weekdayShortName(m, lang))
                            .font(.system(size: 11, weight: .semibold))
                            .textCase(.uppercase)
                        Text(verbatim: "\(localDate(m, appTimeZone).day)")
                            .font(.system(size: 15, weight: .semibold).monospacedDigit())
                    }
                    .foregroundStyle(Theme.primary.color)
                    .frame(maxWidth: .infinity)
                }
            }
            .frame(height: Self.header)
            .overlay(alignment: .bottom) { Rectangle().fill(Theme.border.color).frame(height: 1) }
            GeometryReader { geo in
                hours(read, size: geo.size)
            }
        }
        .frame(height: Self.height)
        .frame(maxWidth: .infinity)
        .background(Theme.card.color)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.border.color))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(label)
    }

    private func hours(_ read: [Int64: DayOfCalendar], size: CGSize) -> some View {
        let (from, to) = window
        let hourPx = size.height / (to - from)
        let width = (size.width - Self.gutter) / CGFloat(days.count)
        let step = hourPx < 16 ? 3 : hourPx < 22 ? 2 : 1
        let first = Int(from.rounded(.up))
        let last = Int(to.rounded(.down))
        return ZStack(alignment: .topLeading) {
            ForEach(Array(stride(from: max(first, 1), through: min(last, 24), by: 1).filter { $0 % step == 0 }), id: \.self) {
                h in
                let top = (Double(h) - from) * hourPx
                Rectangle()
                    .fill(Theme.border.color.opacity(0.8))
                    .frame(width: size.width - Self.gutter, height: 1)
                    .offset(x: Self.gutter, y: top)
                Text(verbatim: formatClockMinutes((h % 24) * 60))
                    .font(.system(size: 11).monospacedDigit())
                    .foregroundStyle(Theme.mutedForeground.color)
                    .frame(width: Self.gutter - 6, height: 14, alignment: .trailing)
                    .offset(y: top - 7)
            }
            ForEach(Array(days.enumerated()), id: \.offset) { i, m in
                let x = Self.gutter + width * CGFloat(i)
                Rectangle()
                    .fill(Theme.border.color.opacity(0.6))
                    .frame(width: 1, height: size.height)
                    .offset(x: x)
                if let day = read[m] {
                    ForEach(
                        Array(
                            placeBlocks(own(day, m).segments, midnight: m, appTimeZone, minHeight: 14.0 / (24 * hourPx))
                                .enumerated()), id: \.offset
                    ) { _, p in
                        let top = (p.top * 24 - from) * hourPx
                        let rgb = day.color(p.segment.calendarId)
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color(rgb: CasyCore.tint(rgb, dark: scheme == .dark)))
                            .overlay(alignment: .leading) { Rectangle().fill(Color(rgb: rgb)).frame(width: 2) }
                            .clipShape(RoundedRectangle(cornerRadius: 3))
                            .frame(width: max(0, width * p.width - 3), height: max(0, p.height * 24 * hourPx - 2))
                            .offset(x: x + width * p.left + 1.5, y: top + 1)
                    }
                }
                eventPart(i, m, width: width, hourPx: hourPx, from: from, to: to)
                    .offset(x: x + 2)
                Color.clear
                    .frame(width: width, height: size.height)
                    .contentShape(Rectangle())
                    .offset(x: x)
                    .onTapGesture { onOpen(m) }
            }
        }
        .frame(width: size.width, height: size.height, alignment: .topLeading)
        .clipped()
    }

    /// The event's part of one column: from its start on the first day, to its
    /// end on the last, the whole column between; its name on the first.
    @ViewBuilder
    private func eventPart(_ i: Int, _ m: Int64, width: CGFloat, hourPx: CGFloat, from: Double, to: Double) -> some View {
        let isFirst = i == 0
        let isLast = i == days.count - 1
        let top = isFirst ? Double(start - m) / 3_600_000 : from
        let bottom = isLast ? Double(end - m) / 3_600_000 : to
        let y = (max(top, from) - from) * hourPx
        let height = max(18, (min(bottom, to) - max(top, from)) * hourPx)
        UnevenRoundedRectangle(
            topLeadingRadius: isFirst ? 5 : 0, bottomLeadingRadius: isLast ? 5 : 0,
            bottomTrailingRadius: isLast ? 5 : 0, topTrailingRadius: isFirst ? 5 : 0
        )
        .fill(Theme.primary.color.opacity(0.2))
        .overlay {
            UnevenRoundedRectangle(
                topLeadingRadius: isFirst ? 5 : 0, bottomLeadingRadius: isLast ? 5 : 0,
                bottomTrailingRadius: isLast ? 5 : 0, topTrailingRadius: isFirst ? 5 : 0
            )
            .strokeBorder(Theme.primary.color, lineWidth: 2)
        }
        .overlay(alignment: .topLeading) {
            if isFirst {
                VStack(alignment: .leading, spacing: 0) {
                    Text(label).font(.system(size: 12, weight: .bold)).lineLimit(1).truncationMode(.tail)
                    Text(verbatim: formatTime(isoString(start))).font(.system(size: 11).monospacedDigit())
                }
                .foregroundStyle(Theme.primary.color)
                .padding(.horizontal, 4)
                .padding(.top, 2)
            } else if isLast {
                Text(verbatim: "-\(formatTime(isoString(end)))")
                    .font(.system(size: 11).monospacedDigit())
                    .foregroundStyle(Theme.primary.color)
                    .padding(.horizontal, 4)
                    .padding(.top, 2)
            }
        }
        .frame(width: max(0, width - 4), height: height)
        .offset(y: y)
    }

    // MARK: Longer: a month strip

    /// The weeks it touches, Monday first.
    private var weeks: [[Int64]] {
        let firstDow = (localDate(days[0], appTimeZone).dow + 6) % 7
        var day = addDays(days[0], -firstDow, appTimeZone)
        let lastDay = days[days.count - 1]
        var out: [[Int64]] = []
        while day <= lastDay {
            var week: [Int64] = []
            for _ in 0..<7 {
                week.append(day)
                day = addDays(day, 1, appTimeZone)
            }
            out.append(week)
        }
        return out
    }

    private func strip(_ read: [Int64: DayOfCalendar]) -> some View {
        let inside = Set(days)
        let firstDay = localDate(days[0], appTimeZone)
        let lastDay = localDate(days[days.count - 1], appTimeZone)
        let sep = lang == .da ? "." : ""
        let title =
            "\(firstDay.day)\(sep) \(monthShortName(days[0], lang)) – \(lastDay.day)\(sep) \(monthShortName(days[days.count - 1], lang)) \(lastDay.year)"
        return Button {
            onOpen(days[0])
        } label: {
            VStack(spacing: 0) {
                Text(verbatim: title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.primary.color)
                    .frame(maxWidth: .infinity)
                    .frame(height: Self.header)
                    .overlay(alignment: .bottom) { Rectangle().fill(Theme.border.color).frame(height: 1) }
                VStack(spacing: 0) {
                    // The weekdays' letters over the columns, Monday first.
                    HStack(spacing: 0) {
                        ForEach(weeks[0], id: \.self) { m in
                            Text(verbatim: String(weekdayShortName(m, lang).prefix(1)).uppercased())
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(Theme.mutedForeground.color)
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .frame(height: 20)
                    ForEach(Array(weeks.enumerated()), id: \.offset) { _, week in
                        HStack(spacing: 0) {
                            ForEach(week, id: \.self) { m in
                                cell(m, in: inside.contains(m), busy: busy(read[m], m), week: week, inside: inside)
                            }
                        }
                        .frame(height: Self.row)
                    }
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
            }
            .frame(maxWidth: .infinity)
            .background(Theme.card.color)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.border.color))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    /// Something of your own on the day, besides the event.
    private func busy(_ day: DayOfCalendar?, _ m: Int64) -> Bool {
        guard let day else { return false }
        return own(day, m).segments.contains { $0.calendarId != holidayCalendarId }
    }

    private func cell(_ m: Int64, in trip: Bool, busy: Bool, week: [Int64], inside: Set<Int64>) -> some View {
        let i = week.firstIndex(of: m) ?? 0
        let before = i > 0 && inside.contains(week[i - 1])
        let after = i < 6 && inside.contains(week[i + 1])
        return ZStack {
            if trip {
                UnevenRoundedRectangle(
                    topLeadingRadius: before ? 0 : 8, bottomLeadingRadius: before ? 0 : 8,
                    bottomTrailingRadius: after ? 0 : 8, topTrailingRadius: after ? 0 : 8
                )
                .fill(Theme.primary.color.opacity(0.2))
                .padding(.vertical, 4)
            }
            VStack(spacing: 2) {
                Text(verbatim: "\(localDate(m, appTimeZone).day)")
                    .font(.system(size: 13, weight: trip ? .semibold : .regular).monospacedDigit())
                    .foregroundStyle(trip ? Theme.primary.color : Theme.mutedForeground.color)
                Circle()
                    .fill(busy ? Theme.foreground.color.opacity(0.55) : .clear)
                    .frame(width: 4, height: 4)
            }
        }
        .frame(maxWidth: .infinity)
    }
}
