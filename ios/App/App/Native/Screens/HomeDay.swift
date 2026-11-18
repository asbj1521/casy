import CasyCore
import CasyUI
import SwiftUI

/// A day of the home page's month, opened as Apple Calendar's day view, the
/// web's DayView and DayColumns (#176, #201) value for value (#281): the week
/// row, a line, the day's name with the week number in the corner, the whole
/// days, then the hours with the day first, one day or the day and the next
/// (`span`). A sideways swipe on the hours turns the days (the name and whole
/// day rows sliding with them), on the week row a whole week; a tap on a
/// number shows that day. A tap on one of your events opens it in a sheet; on
/// something the page added (a vote's date, a trip) it is the page's.
struct HomeDayView: View {
    @Binding var day: Int64
    let span: Int
    let pageTap: (Int64) -> Void

    @State private var event: ShownEvent?
    @State private var pager = DayPager()

    var body: some View {
        VStack(spacing: 0) {
            WeekStrip(day: $day, span: span)
            Rectangle().fill(Theme.border.color).frame(height: 1)
            DayNames(pager: pager, span: span, day: day)
            AllDayRows(pager: pager, span: span, day: day, open: { event = $0 })
            DayHours(day: $day, span: span, pager: pager, pageTap: pageTap, open: { event = $0 })
        }
        .sheet(item: $event) { EventSheet(event: $0) }
    }
}

/// A segment opened in its sheet.
struct ShownEvent: Identifiable {
    let id = UUID()
    let segment: DaySegment
    let calendar: DayOfCalendar
}

/// Where the hours' pager is, for the rows over it that slide with it (the
/// days' names, the whole days), as the web moves them by the same `x`. Only
/// those rows read it, so a swipe redraws nothing else.
@MainActor @Observable
final class DayPager {
    /// The pager's scroll offset, and one page's width.
    var x: CGFloat = 0
    var width: CGFloat = 0
    /// Each page's first day.
    var pages: [Int64] = []
}

/// A row's share of the days, sliding with the hours (the web's Track): the
/// pages around the one in view, each `page(firstDay)` a page wide.
private struct Track<Page: View>: View {
    let pager: DayPager
    @ViewBuilder let page: (Int64) -> Page

    var body: some View {
        GeometryReader { box in
            let w = pager.width
            if w > 0, !pager.pages.isEmpty {
                let at = min(max(Int((pager.x / w).rounded(.down)), 0), pager.pages.count - 1)
                ZStack(alignment: .topLeading) {
                    ForEach(max(0, at - 1)...min(pager.pages.count - 1, at + 2), id: \.self) { k in
                        page(pager.pages[k])
                            .frame(width: w, height: box.size.height, alignment: .topLeading)
                            .offset(x: CGFloat(k) * w - pager.x)
                    }
                }
            }
        }
        .clipped()
    }
}

// MARK: - The week row

/// Apple's week row over its day view, the web's WeekStrip value for value:
/// the weekdays' letters (12 medium on an 18 line), 4 under them a 40 tall
/// row of the week's numbers (19, in a 36 circle: the day in view filled,
/// orange if today, else the text's colour; today otherwise orange and
/// semibold; weekends muted), one capsule in the secondary colour under every
/// day in view, 4 at the sides and 8 under. A sideways swipe of 40 points
/// turns the week, the numbers sliding in with the web's spring (SLIDE).
private struct WeekStrip: View {
    @Binding var day: Int64
    let span: Int

    /// Which way the week last turned, for its slide.
    @State private var turn: CGFloat = 0
    /// The glass lens that carries the selection from one date to another
    /// (asked for on 18 Nov 2026): it pops up over the old date, glides to
    /// the new one and dissolves, the plain circle and band appearing there.
    /// Never there at rest. `lensAt` is the column of its left edge.
    @State private var lensAt: CGFloat = 0
    @State private var lensOn = false
    @State private var lensUp = false
    @State private var lensRun = 0
    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    /// The web's SLIDE: damping 38, stiffness 380, mass 0.8.
    static let slide = Animation.interpolatingSpring(mass: 0.8, stiffness: 380, damping: 38)

    private var monday: Int64 {
        let dow = localDate(day, appTimeZone).dow
        return addDays(day, -((dow + 6) % 7), appTimeZone)
    }

    var body: some View {
        VStack(spacing: 4) {
            HStack(spacing: 0) {
                ForEach(0..<7, id: \.self) { c in
                    // Monday first; 5 January 2026 was a Monday.
                    let d = wallTime(2026, 0, 5 + c, 12, appTimeZone)
                    Text(verbatim: String(weekdayShortName(d, lang).prefix(1)).uppercased())
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(c >= 5 ? Theme.mutedForeground.color : Theme.foreground.color)
                        .frame(maxWidth: .infinity)
                        .frame(height: 18)
                }
            }
            .accessibilityHidden(true)
            GeometryReader { box in
                week(monday, column: box.size.width / 7)
                    .id(monday)
                    .transition(
                        .asymmetric(
                            insertion: .offset(x: turn * box.size.width), removal: .offset(x: -turn * box.size.width)))
            }
            .frame(height: 40)
            .clipped()
            .contentShape(Rectangle())
            // Beside the numbers' own taps, not instead of them.
            .simultaneousGesture(
                DragGesture(minimumDistance: 12).onEnded { value in
                    let dx = value.translation.width
                    if abs(dx) > 40, abs(dx) > abs(value.translation.height) { turnWeek(dx < 0 ? 1 : -1) }
                })
        }
        .padding(.horizontal, 4)
        .padding(.bottom, 8)
        .onChange(of: monday) { old, new in turn = new > old ? 1 : -1 }
        .onChange(of: day) { old, new in
            // Within the week the lens carries it; a week turned slides instead.
            if mondayOf(old) == mondayOf(new) { glide(from: column(old), to: column(new)) }
        }
    }

    private func mondayOf(_ d: Int64) -> Int64 {
        addDays(d, -((localDate(d, appTimeZone).dow + 6) % 7), appTimeZone)
    }

    private func column(_ d: Int64) -> CGFloat { CGFloat((localDate(d, appTimeZone).dow + 6) % 7) }

    /// The lens: up over the old date (a quick pop), across on a soft spring,
    /// and gone as it settles, the selection appearing under it.
    private func glide(from: CGFloat, to: CGFloat) {
        lensRun += 1
        let run = lensRun
        if !lensOn { lensAt = from }
        lensOn = true
        withAnimation(.spring(duration: 0.18, bounce: 0.3)) { lensUp = true }
        withAnimation(.spring(duration: 0.42, bounce: 0.18)) { lensAt = to }
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(380))
            guard run == lensRun else { return }
            withAnimation(.easeOut(duration: 0.22)) {
                lensUp = false
                lensOn = false
            }
        }
    }

    private func turnWeek(_ direction: Int) {
        turn = CGFloat(direction)
        withAnimation(Self.slide) { day = addDays(day, 7 * direction, appTimeZone) }
    }

    private func week(_ monday: Int64, column: CGFloat) -> some View {
        let today = startOfDay(Native.now, appTimeZone)
        let shown = (0..<7).filter { c in
            let d = addDays(monday, c, appTimeZone)
            return d >= day && d < addDays(day, span, appTimeZone)
        }
        return ZStack(alignment: .topLeading) {
            if let first = shown.first {
                Capsule()
                    .fill(Theme.secondary.color)
                    .frame(width: column * CGFloat(shown.count), height: 40)
                    .offset(x: column * CGFloat(first))
                    .animation(Self.slide, value: first)
                    .animation(Self.slide, value: shown.count)
                    .opacity(lensOn ? 0 : 1)
                    .animation(lensOn ? nil : .easeOut(duration: 0.22), value: lensOn)
            }
            HStack(spacing: 0) {
                ForEach(0..<7, id: \.self) { c in
                    let d = addDays(monday, c, appTimeZone)
                    number(d, today: today, weekend: c >= 5)
                }
            }
            // Over the numbers, which show through it bent by the glass.
            Capsule()
                .fill(.clear)
                .frame(width: column * CGFloat(span), height: 40)
                .casyGlass(in: Capsule())
                .scaleEffect(lensUp ? 1.12 : 0.9)
                .offset(x: column * lensAt)
                .opacity(lensOn ? 1 : 0)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
        }
    }

    private func number(_ d: Int64, today: Int64, weekend: Bool) -> some View {
        // Under the moving lens no date is filled; it appears as the lens goes.
        let center = d == day && !lensOn
        let isToday = d == today
        return Button {
            withAnimation(Self.slide) { day = d }
        } label: {
            Text(verbatim: "\(localDate(d, appTimeZone).day)")
                .font(.system(size: 19, weight: center || isToday ? .semibold : .regular))
                .foregroundStyle(
                    center
                        ? (isToday ? .white : Theme.background.color)
                        : isToday ? Theme.primary.color : weekend ? Theme.mutedForeground.color : Theme.foreground.color
                )
                .frame(width: 36, height: 36)
                .background {
                    // Taken into the lens at once as it rises; fading in as it goes.
                    Circle()
                        .fill(isToday ? Theme.cta.color : Theme.foreground.color)
                        .opacity(center ? 1 : 0)
                        .animation(nil, value: day)
                        .animation(lensOn ? nil : .easeOut(duration: 0.22), value: lensOn)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(dayLabel(d, lang))
        .accessibilityAddTraits(d == day ? .isSelected : [])
        .accessibilityIdentifier("week.\(dayKey(d, appTimeZone))")
    }
}

// MARK: - The days' names

/// The days' names, 44 tall with a line under them, the week number in the
/// corner (15, muted, centred in the 52 gutter) as Apple has it: alone
/// "torsdag 8. okt. 2026", side by side "tors. 8. okt."; 15 semibold, orange
/// for today beside another day or for a vote's date, else the text's colour.
private struct DayNames: View {
    let pager: DayPager
    let span: Int
    let day: Int64

    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    var body: some View {
        HStack(spacing: 0) {
            Text(verbatim: CasyStrings.dayWeek(isoWeekNumber(day, appTimeZone)))
                .font(.system(size: 15))
                .foregroundStyle(Theme.mutedForeground.color)
                .frame(width: DayHours.gutter)
            Track(pager: pager) { first in
                HStack(spacing: 0) {
                    ForEach(0..<span, id: \.self) { n in
                        name(addDays(first, n, appTimeZone))
                    }
                }
                .frame(maxHeight: .infinity)
            }
        }
        .frame(height: 44)
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.border.color).frame(height: 1) }
        .accessibilityHidden(true)
    }

    private func name(_ midnight: Int64) -> some View {
        let today = startOfDay(Native.now, appTimeZone)
        let next = addDays(midnight, 1, appTimeZone)
        let pencilled = HomeModel.shared.page.extras.contains { $0.pencil == true && $0.start < next && $0.end > midnight }
        return Text(verbatim: text(midnight))
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(
                (midnight == today && span > 1) || pencilled ? Theme.primary.color : Theme.foreground.color)
            .lineLimit(1)
            .frame(maxWidth: .infinity)
    }

    /// The web's headerText.
    private func text(_ midnight: Int64) -> String {
        let local = localDate(midnight, appTimeZone)
        let sep = lang == .da ? "." : ""
        let month = monthShortName(midnight, lang)
        if span == 1 { return "\(weekdayName(midnight, lang)) \(local.day)\(sep) \(month) \(local.year)" }
        return "\(weekdayShortName(midnight, lang)) \(local.day)\(sep) \(month)"
    }
}

// MARK: - Whole days

/// The whole days, when a day in view has one: under the names, a line under
/// them, each day's rows stacked 4 apart (2 at the sides, 1 at the top), 12
/// semibold on a 20 line, a 3 point bar of the calendar's colour on the left,
/// rounded 4; up to three, past that two and the count of the rest. As tall as
/// the fullest day in view needs: its rows times 24, and 2.
private struct AllDayRows: View {
    let pager: DayPager
    let span: Int
    let day: Int64
    let open: (ShownEvent) -> Void

    private static let rows = 3
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let inView = (0..<span).map { addDays(day, $0, appTimeZone) }
        let most = inView.map { HomeModel.shared.day($0).calendar.segments.filter(\.allDay).count }.max() ?? 0
        if most > 0 {
            HStack(spacing: 0) {
                Color.clear.frame(width: DayHours.gutter)
                Track(pager: pager) { first in
                    HStack(alignment: .top, spacing: 0) {
                        ForEach(0..<span, id: \.self) { n in
                            column(addDays(first, n, appTimeZone))
                        }
                    }
                }
            }
            .frame(height: CGFloat(min(most, Self.rows)) * 24 + 2)
            .overlay(alignment: .bottom) { Rectangle().fill(Theme.border.color).frame(height: 1) }
        }
    }

    private func column(_ midnight: Int64) -> some View {
        let calendar = HomeModel.shared.day(midnight).calendar
        let list = calendar.segments.filter(\.allDay)
        let full = list.count > Self.rows
        let shown = Array(list.prefix(full ? Self.rows - 1 : Self.rows))
        let dark = scheme == .dark
        return VStack(alignment: .leading, spacing: 4) {
            ForEach(Array(shown.enumerated()), id: \.offset) { _, s in
                let rgb = calendar.color(s.calendarId)
                Button { open(ShownEvent(segment: s, calendar: calendar)) } label: {
                    Text(verbatim: calendar.label(s))
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color(rgb: CasyCore.shade(rgb, dark: dark)))
                        .lineLimit(1)
                        .padding(.leading, 7)
                        .padding(.trailing, 4)
                        .frame(maxWidth: .infinity, minHeight: 20, maxHeight: 20, alignment: .leading)
                        .background(Color(rgb: CasyCore.tint(rgb, dark: dark)))
                        .overlay(alignment: .leading) { Rectangle().fill(Color(rgb: rgb)).frame(width: 3) }
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                }
                .buttonStyle(.plain)
            }
            if full {
                Text(verbatim: "+\(list.count - shown.count)")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.mutedForeground.color)
                    .padding(.horizontal, 4)
                    .frame(maxWidth: .infinity, minHeight: 20, maxHeight: 20, alignment: .leading)
                    .background(Theme.muted.color, in: RoundedRectangle(cornerRadius: 4))
            }
        }
        .padding(.horizontal, 2)
        .padding(.top, 1)
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }
}

// MARK: - The hours

/// The hours of the days in view: an hour line across from the gutter every
/// 46 points (1 point, the border at 80 %), labelled "09:00" in the 52 gutter
/// (12, muted, 6 from its right edge, centred on the line; none at 0 or 24, or
/// under the time now), and a sideways paging list of days (or pairs of days)
/// inside the hours' own scroll, so a sideways swipe turns the days as iOS
/// pages anything, and an up or down one scrolls the hours. Today has the time
/// now: a 2 point orange line across it and the time in an orange capsule in
/// the gutter.
struct DayHours: View {
    @Binding var day: Int64
    let span: Int
    let pager: DayPager
    let pageTap: (Int64) -> Void
    let open: (ShownEvent) -> Void

    static let hourHeight: CGFloat = 46
    static let gutter: CGFloat = 52
    static let dayPoints: Double = 46 * 24
    /// A line of a block's name, the least a block is drawn as, and two (its time shows too).
    static let linePoints: Double = 22
    static let twoLines: CGFloat = 40
    /// Pages drawn either side of where it opened; a jump further starts again from there.
    private static let reach = 120

    /// The pages, made once from where it opened (or jumped to), never in `body`.
    @State private var pages: [Int64]
    /// The day a sideways swipe just paged to: the hours stay where they are.
    @State private var paged: Int64?
    @State private var now = Native.now
    /// Where the hours are scrolled to, set to the web's opening (`openingOf`).
    @State private var vertical = ScrollPosition(edge: .top)

    init(
        day: Binding<Int64>, span: Int, pager: DayPager, pageTap: @escaping (Int64) -> Void,
        open: @escaping (ShownEvent) -> Void
    ) {
        _day = day
        self.span = span
        self.pager = pager
        self.pageTap = pageTap
        self.open = open
        // There from the first frame, so the paging lands on the day at once.
        _pages = State(initialValue: Self.pages(from: day.wrappedValue, span: span))
    }

    private static func pages(from first: Int64, span: Int) -> [Int64] {
        (-reach...reach).map { addDays(first, $0 * span, appTimeZone) }
    }

    private func pages(from first: Int64) -> [Int64] { Self.pages(from: first, span: span) }

    var body: some View {
        GeometryReader { box in
            let width = box.size.width - Self.gutter
            ScrollView {
                    ZStack(alignment: .topLeading) {
                        HourLines(nowTop: nowTop)
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
                            id: Binding(
                                get: { Optional(day) },
                                set: {
                                    guard let d = $0, d != day else { return }
                                    paged = d
                                    day = d
                                })
                        )
                        .onScrollGeometryChange(for: CGFloat.self) { $0.contentOffset.x } action: { _, x in
                            pager.x = x
                        }
                        .frame(width: width, height: Self.hourHeight * 24)
                        .offset(x: Self.gutter)
                        if let nowTop {
                            Text(verbatim: formatTime(isoString(now)))
                                .font(.system(size: 11, weight: .semibold).monospacedDigit())
                                .foregroundStyle(.white)
                                .padding(.horizontal, 6)
                                .frame(height: 18)
                                .background(Theme.cta.color, in: Capsule())
                                .fixedSize()
                                .offset(x: 2, y: nowTop - 9)
                                .accessibilityHidden(true)
                        }
                    }
                    .frame(height: Self.hourHeight * 24, alignment: .topLeading)
                }
                .scrollPosition($vertical)
                .accessibilityIdentifier("day.hours")
                .onAppear {
                    pager.width = width
                    pager.pages = pages
                    open(height: box.size.height)
                }
                .onChange(of: width) { _, w in pager.width = w }
                .onChange(of: pages) { _, p in pager.pages = p }
                .onChange(of: day) { _, new in
                    // Swiped to: the hours stay where they are, as on the web.
                    if paged == new {
                        paged = nil
                        return
                    }
                    // Jumped to (a number, a week, I dag): a day not among the pages starts them again.
                    if !pages.contains(new) { pages = pages(from: new) }
                    open(height: box.size.height)
                }
                .onChange(of: span) { _, _ in pages = pages(from: day) }
        }
        // Down to the screen's edge, under the home indicator, as the web's.
        .ignoresSafeArea(.container, edges: .bottom)
        .task {
            // The time now moves on each minute.
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(60))
                now = Native.now
            }
        }
    }

    /// Where the time now is, when today is in view.
    private var nowTop: CGFloat? {
        let today = startOfDay(now, appTimeZone)
        guard (0..<span).contains(where: { addDays(day, $0, appTimeZone) == today }) else { return nil }
        return placeSpan(now, now + 1, midnight: today, appTimeZone).top * Self.dayPoints
    }

    /// The web's opening (dayColumns.ts's `openingOf`): today with the time now
    /// in the middle, another day an hour before its first timed event, else
    /// 08:00 at the top.
    private func open(height: CGFloat) {
        let today = startOfDay(Native.now, appTimeZone)
        let shown = (0..<span).map { addDays(day, $0, appTimeZone) }
        let day = CGFloat(Self.dayPoints)
        let y: CGFloat
        if shown.contains(today) {
            y = placeSpan(Native.now, Native.now + 1, midnight: today, appTimeZone).top * day - height / 2
        } else if let first = shown.flatMap({ HomeModel.shared.placed($0).map(\.top) }).min() {
            y = max(0, first - 1.0 / 24) * day
        } else {
            y = 8.0 / 24 * day
        }
        vertical.scrollTo(y: min(max(0, y), max(0, day - height)))
    }
}

/// The hour lines across from the gutter and their labels in it.
private struct HourLines: View {
    let nowTop: CGFloat?

    var body: some View {
        ZStack(alignment: .topLeading) {
            ForEach(0..<25, id: \.self) { h in
                let y = CGFloat(h) * DayHours.hourHeight
                Rectangle().fill(Theme.border.color.opacity(0.8))
                    .frame(height: 1)
                    .padding(.leading, DayHours.gutter)
                    .offset(y: y)
                if h > 0, h < 24, nowTop.map({ abs(y - $0) >= 12 }) ?? true {
                    Text(verbatim: formatClockMinutes(h * 60))
                        .font(.system(size: 12).monospacedDigit())
                        .foregroundStyle(Theme.mutedForeground.color)
                        .padding(.trailing, 6)
                        // Centred on its line: a 16 tall box moved up half its height
                        // (an alignment guide would stretch the stack and move the lines).
                        .frame(width: DayHours.gutter, height: 16, alignment: .trailing)
                        .offset(y: y - 8)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .accessibilityHidden(true)
    }
}

/// One day's hours (the web's column): a line down its left (the border at
/// 60 %), your blocks placed as Apple Calendar does, the page's own items,
/// and the time now on today.
private struct DayColumn: View {
    let midnight: Int64
    let now: Int64
    let pageTap: (Int64) -> Void
    let open: (ShownEvent) -> Void

    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let shown = HomeModel.shared.day(midnight)
        let calendar = shown.calendar
        let day = CGFloat(DayHours.dayPoints)
        GeometryReader { box in
            let width = box.size.width
            ZStack(alignment: .topLeading) {
                Rectangle().fill(Theme.border.color.opacity(0.6)).frame(width: 1)
                ForEach(Array(HomeModel.shared.placed(midnight).enumerated()), id: \.offset) { _, p in
                    let height = p.height * day
                    Button { open(ShownEvent(segment: p.segment, calendar: calendar)) } label: {
                        block(
                            calendar.label(p.segment), time: height >= DayHours.twoLines ? range(p.segment) : nil,
                            rgb: calendar.color(p.segment.calendarId))
                    }
                    .buttonStyle(.plain)
                    .frame(width: max(0, width * p.width - 4), height: max(0, height - 2))
                    .offset(x: width * p.left + 2, y: p.top * day + 1)
                    .accessibilityLabel("\(calendar.label(p.segment)), \(range(p.segment))")
                }
                ForEach(Array(shown.extras.enumerated()), id: \.offset) { _, item in
                    let span = placeSpan(max(item.start, midnight), item.end, midnight: midnight, appTimeZone)
                    let height = max(span.height * day, CGFloat(DayHours.linePoints))
                    // A vote's date or a trip waiting for an answer opens the page's
                    // own; anything else of the page's (an agreed date, a trip
                    // already answered) is only shown: handed over, the page would
                    // open its day view over this one.
                    let asks = item.pencil == true || item.pulse == true
                    Button { pageTap(midnight) } label: { extra(item, height: height) }
                        .buttonStyle(.plain)
                        .disabled(!asks)
                        .frame(width: max(0, width - 4), height: height)
                        .offset(x: 2, y: span.top * day)
                        .accessibilityLabel(item.label)
                }
                if startOfDay(now, appTimeZone) == midnight {
                    let y = placeSpan(now, now + 1, midnight: midnight, appTimeZone).top * day
                    Rectangle().fill(Theme.cta.color).frame(height: 2).offset(y: y)
                }
            }
        }
        .frame(height: day)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("column.\(dayKey(midnight, appTimeZone))")
    }

    private func range(_ s: DaySegment) -> String { formatSegmentRange(s, appTimeZone, allDay: CasyStrings.dayAllDay) }

    /// The web's block: the calendar's tint, rounded 5 with a 1 point ring of the
    /// card's colour round it, a 3 point bar of the calendar's colour 2 in from
    /// the left, top and bottom; the name 13 semibold on a 17 line, under it
    /// from two lines on a clock (12) and the time (12, at 90 %), 8 left, 4
    /// right, 2 at the top, in the calendar's darker shade.
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
            .background(RoundedRectangle(cornerRadius: 6).fill(Theme.card.color).padding(-1))
    }

    /// The page's own: a vote's date pencilled in (the web's pencil: a 2 point
    /// dashed orange border, rounded 5, the orange at 10 %, 6 at the sides; its
    /// title 13 bold on an 18 line, from two lines the time, 12, in orange);
    /// anything else (a trip) tinted as a block.
    private func extra(_ item: MonthItem, height: CGFloat) -> some View {
        let shape = RoundedRectangle(cornerRadius: 5)
        let rgb = HomeModel.shared.color(item.calendarId)
        let pencil = item.pencil == true
        return Group {
            if pencil {
                shape.fill(Theme.primary.color.opacity(0.1))
                    .overlay(shape.strokeBorder(Theme.primary.color, style: StrokeStyle(lineWidth: 2, dash: [6, 4])))
            } else {
                shape.fill(Color(rgb: CasyCore.tint(rgb, dark: scheme == .dark)))
            }
        }
        .overlay(alignment: .topLeading) {
            VStack(alignment: .leading, spacing: 0) {
                Text(verbatim: item.label)
                    .font(.system(size: 13, weight: pencil ? .bold : .semibold))
                    .lineLimit(1)
                    .frame(height: 18)
                if pencil, height >= DayHours.twoLines {
                    Text(verbatim: "\(formatTime(isoString(item.start)))-\(formatTime(isoString(item.end)))")
                        .font(.system(size: 12).monospacedDigit())
                }
            }
            .foregroundStyle(pencil ? Theme.primary.color : Color(rgb: CasyCore.shade(rgb, dark: scheme == .dark)))
            .padding(.horizontal, 6)
            .padding(.top, 2)
        }
        .clipShape(shape)
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
