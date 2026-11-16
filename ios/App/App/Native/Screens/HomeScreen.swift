import CasyCore
import CasyUI
import SwiftUI

/// My calendar, the home page, native (#201): your calendar as Apple
/// Calendar's month view, the months scrolling under a glass header whose
/// title follows them (the web's MonthView with a `header`), with Kalendere,
/// Tilføj til kalender and I dag at the top and Aftaler, Planlæg and Profil
/// along the bottom. What isn't native yet is the page's: every press is
/// handed to it (`HomeModel.onAction`), which opens its own sheets, native
/// ones included, as it does from its own buttons.
struct HomeScreen: View {
    let preferences: NativePreferences

    private let model = HomeModel.shared
    @State private var position: Int64?
    @Environment(\.colorScheme) private var scheme
    /// The day open in the day view, and whether it has zoomed out of its cell.
    @State private var shownDay: Int64?
    @State private var dayOpen = false
    /// The cell it zooms out of and back into; nil fades instead.
    @State private var cell: CGRect?
    @State private var dayFrame: CGRect = .zero
    /// One day or two, kept on this phone as the web's toggle is.
    @AppStorage("casy.daySpan") private var span = 1

    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    var body: some View {
        GeometryReader { box in
            let column = box.size.width / 7
            ZStack(alignment: .top) {
                months(column)
                if let day = shownDay {
                    VStack(spacing: 0) {
                        dayHeader(day)
                            .opacity(dayOpen ? 1 : 0)
                        dayContent(day)
                    }
                    // Down to the screen's edge, so the month doesn't show under it once open.
                    .background(Theme.background.color.ignoresSafeArea().opacity(dayOpen ? 1 : 0))
                    .zIndex(1)

                }
            }
        }
        .background(Theme.background.color.ignoresSafeArea())
        .overlay {
            if model.loading { ProgressView() }
        }
        .overlay(alignment: .center) {
            #if DEBUG
                if TestLaunch.isActive {
                    Text(verbatim: model.testAction)
                        .font(.caption2)
                        .opacity(0.01)
                        .accessibilityIdentifier("home.lastAction")
                }
            #endif
        }
        .tint(Theme.primary.color)
        .preferredColorScheme(
            preferences.theme == "light" ? .light : preferences.theme == "dark" ? .dark : nil)
    }

    private func months(_ column: CGFloat) -> some View {
            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(model.months) { month in
                        MonthBlock(
                            month: month, column: column, today: startOfDay(Native.now, appTimeZone),
                            starred: model.page.starred, lang: lang, dark: scheme == .dark,
                            color: model.color, pick: pick
                        )
                        .equatable()
                    }
                }
                .scrollTargetLayout()
            }
            .scrollPosition(id: $position, anchor: .top)
            .refreshable { await model.load() }
            .accessibilityIdentifier("home.months")
            .safeAreaInset(edge: .top, spacing: 0) { header }
            .safeAreaInset(edge: .bottom, spacing: 0) { bottom }
            .accessibilityHidden(shownDay != nil)
            // Under an open day nothing reaches it: no tap, no swipe, no pull to refresh.
            .allowsHitTesting(shownDay == nil)
    }

    // MARK: The day view

    /// A tap on a day: the page's when it has something there (a trip
    /// waiting, a vote's date, a starred day), else its day view, zoomed out of its cell.
    private func pick(_ day: Int64, _ from: CGRect?) {
        if model.dayIsThePages(day) {
            model.onAction?("day", day)
            return
        }
        cell = from
        dayOpen = false
        shownDay = day
        Task { @MainActor in
            withAnimation(.smooth(duration: 0.38)) { dayOpen = true }
        }
    }

    /// Back to the month, shrinking into the cell of the day it is on now,
    /// brought into view first; faded if it can't be found.
    private func closeDay() {
        guard let day = shownDay else { return }
        let month = startOfMonth(day, appTimeZone)
        if HomeFrames.shared.cell(of: day) == nil { position = month }
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(30))
            cell = HomeFrames.shared.cell(of: day)
            withAnimation(.smooth(duration: 0.32)) { dayOpen = false } completion: { shownDay = nil }
        }
    }

    private func dayHeader(_ day: Int64) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Button(action: closeDay) {
                    Label(capitalize(monthName(day, lang)), systemImage: "chevron.left")
                        .font(.body.weight(.medium))
                        .padding(.horizontal, 14)
                        .frame(height: 40)
                        .casyGlass()
                }
                .accessibilityLabel(CasyStrings.dayShowMonth(capitalize(monthName(day, lang))))
                .accessibilityIdentifier("day.back")
                Spacer()
                HStack(spacing: 0) {
                    Button { span = span == 1 ? 2 : 1 } label: {
                        Text(span == 1 ? CasyStrings.dayOne : CasyStrings.dayTwo)
                            .font(.body.weight(.medium))
                            .padding(.horizontal, 12)
                            .frame(height: 40)
                    }
                    .accessibilityLabel(span == 1 ? CasyStrings.dayShowTwo : CasyStrings.dayShowOne)
                    .accessibilityIdentifier("day.span")
                    Divider().frame(height: 22)
                    if model.page.tell {
                        Button { model.onAction?("tell", nil) } label: {
                            Image(systemName: "plus")
                                .font(.title3.weight(.semibold))
                                .frame(width: 44, height: 40)
                        }
                        .accessibilityLabel(CasyStrings.homeTell)
                        Divider().frame(height: 22)
                    }
                    Button {
                        withAnimation(.snappy) { shownDay = startOfDay(Native.now, appTimeZone) }
                    } label: {
                        Text(CasyStrings.homeToday)
                            .font(.body.weight(.medium))
                            .padding(.horizontal, 14)
                            .frame(height: 40)
                    }
                    .accessibilityIdentifier("day.today")
                }
                .casyGlass()
            }
            .buttonStyle(.plain)
            .foregroundStyle(Theme.primary.color)
            .padding(.horizontal, 12)
            .padding(.vertical, 4)
            weekdays
        }
        .background(.bar)
    }

    /// The day view, scaled evenly down into its cell and clipped to it until open.
    private func dayContent(_ day: Int64) -> some View {
        let from = cell ?? .zero
        let scale = cell == nil || dayFrame.width == 0 ? 1 : from.width / dayFrame.width
        return HomeDayView(
            day: Binding(get: { shownDay ?? day }, set: { shownDay = $0 }), span: span,
            pageTap: { model.onAction?("day", $0) }
        )
        // Down to the screen's edge, so the month doesn't show under it.
        .background(Theme.background.color.ignoresSafeArea(edges: .bottom))
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { dayFrame = $0 }
        .mask(alignment: .topLeading) {
            Rectangle().frame(
                width: dayOpen || cell == nil ? nil : dayFrame.width,
                height: dayOpen || cell == nil ? nil : from.height / max(scale, 0.01))
        }
        .scaleEffect(dayOpen || cell == nil ? 1 : scale, anchor: .topLeading)
        .offset(
            x: dayOpen || cell == nil ? 0 : from.minX - dayFrame.minX,
            y: dayOpen || cell == nil ? 0 : from.minY - dayFrame.minY)
        .opacity(cell == nil && !dayOpen ? 0 : 1)
    }

    private var weekdays: some View {
        HStack(spacing: 0) {
            ForEach(0..<7, id: \.self) { c in
                // Monday first; 5 January 2026 was a Monday.
                let day = wallTime(2026, 0, 5 + c, 12, appTimeZone)
                Text(verbatim: String(weekdayShortName(day, lang).prefix(1)).uppercased())
                    .frame(maxWidth: .infinity)
                    .foregroundStyle(c >= 5 ? Theme.mutedForeground.color : Theme.foreground.color)
            }
        }
        .font(.caption.weight(.medium))
        .frame(height: 24)
        .accessibilityHidden(true)
    }

    // MARK: The header

    /// The month on screen: the one whose top is under the header.
    private var titleMonth: Int64 {
        position ?? model.months.first?.id ?? startOfMonth(Native.now, appTimeZone)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Button { model.onAction?("calendars", nil) } label: {
                    Label(CasyStrings.calendarsTitle, systemImage: "square.3.layers.3d")
                        .font(.body.weight(.medium))
                        .padding(.horizontal, 14)
                        .frame(height: 40)
                        .casyGlass()
                }
                .accessibilityIdentifier("home.calendars")
                Spacer()
                HStack(spacing: 0) {
                    if model.page.tell {
                        Button { model.onAction?("tell", nil) } label: {
                            Image(systemName: "plus")
                                .font(.title3.weight(.semibold))
                                .frame(width: 44, height: 40)
                        }
                        .accessibilityLabel(CasyStrings.homeTell)
                        .accessibilityIdentifier("home.tell")
                        Divider().frame(height: 22)
                    }
                    Button(action: goToday) {
                        Text(CasyStrings.homeToday)
                            .font(.body.weight(.medium))
                            .padding(.horizontal, 14)
                            .frame(height: 40)
                    }
                    .accessibilityIdentifier("home.today")
                }
                .casyGlass()
            }
            .buttonStyle(.plain)
            .foregroundStyle(Theme.primary.color)
            .padding(.horizontal, 12)
            .padding(.top, 4)
            .padding(.bottom, 4)
            if let failure = model.failure {
                Notice(failure, tone: .error).padding(.horizontal, 16).padding(.bottom, 6)
            }
            Text(verbatim: monthTitle(titleMonth))
                .font(.system(size: 30, weight: .bold))
                .foregroundStyle(Theme.foreground.color)
                .padding(.horizontal, 12)
                .padding(.vertical, 2)
                .accessibilityAddTraits(.isHeader)
                .accessibilityIdentifier("home.title")
            HStack(spacing: 0) {
                ForEach(0..<7, id: \.self) { c in
                    // Monday first; 5 January 2026 was a Monday.
                    let day = wallTime(2026, 0, 5 + c, 12, appTimeZone)
                    Text(verbatim: String(weekdayShortName(day, lang).prefix(1)).uppercased())
                        .frame(maxWidth: .infinity)
                        .foregroundStyle(c >= 5 ? Theme.mutedForeground.color : Theme.foreground.color)
                }
            }
            .font(.caption.weight(.medium))
            .frame(height: 24)
            .padding(.bottom, 6)
            .accessibilityHidden(true)
        }
        .background(.bar)
    }

    private func monthTitle(_ month: Int64) -> String {
        let name = capitalize(monthName(month, lang))
        let year = localDate(month, appTimeZone).year
        return year == localDate(Native.now, appTimeZone).year ? name : "\(name) \(year)"
    }

    private func goToday() {
        withAnimation(.easeInOut(duration: 0.35)) { position = model.months.first?.id }
    }

    // MARK: Along the bottom

    private var bottom: some View {
        VStack(spacing: 10) {
            if let pill = model.page.pill {
                Button { model.onAction?("pill", nil) } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.circle")
                        Text(pill).lineLimit(1)
                        Image(systemName: "chevron.right").font(.footnote.weight(.semibold))
                    }
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Theme.primary.color)
                    .padding(.horizontal, 18)
                    .frame(height: 44)
                    .casyGlass()
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("home.pill")
            }
            HStack(spacing: 10) {
                round("calendar.badge.checkmark", label: CasyStrings.homeEvents, id: "home.events") {
                    model.onAction?("events", nil)
                }
                Button { model.onAction?("plan", nil) } label: {
                    Label(CasyStrings.homePlan, systemImage: "magnifyingglass")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(Theme.primary.color)
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .casyGlass()
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("home.plan")
                round("person", label: CasyStrings.homeProfile, id: "home.profile") {
                    model.onAction?("profile", nil)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 4)
    }

    private func round(_ image: String, label: String, id: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: image)
                .font(.title3.weight(.medium))
                .foregroundStyle(Theme.primary.color)
                .frame(width: 48, height: 48)
                .casyGlass()
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityIdentifier(id)
    }
}

// MARK: - A month

/// One month: its short name over the column of its first day, then its weeks.
private struct MonthBlock: View, Equatable {
    let month: HomeMonth
    let column: CGFloat
    let today: Int64
    let starred: Set<Int64>
    let lang: Lang
    let dark: Bool
    let color: (String) -> String
    let pick: (Int64, CGRect?) -> Void

    static func == (a: MonthBlock, b: MonthBlock) -> Bool {
        a.month == b.month && a.column == b.column && a.today == b.today && a.starred == b.starred
            && a.lang == b.lang && a.dark == b.dark
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(verbatim: capitalize(monthShortName(month.id, lang)).replacingOccurrences(of: ".", with: ""))
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(Theme.foreground.color)
                .frame(width: column)
                .offset(x: column * CGFloat(month.firstColumn))
                .frame(height: 28, alignment: .top)
                .accessibilityHidden(true)
            ForEach(month.weeks) { week in
                WeekRow(
                    month: month.id, week: week, column: column, today: today, starred: starred, lang: lang,
                    dark: dark, color: color, pick: pick)
            }
        }
        .id(month.id)
    }
}

/// One week: the numbers, the items under them, and a tap on any day.
private struct WeekRow: View {
    let month: Int64
    let week: HomeWeek
    let column: CGFloat
    let today: Int64
    let starred: Set<Int64>
    let lang: Lang
    let dark: Bool
    let color: (String) -> String
    let pick: (Int64, CGRect?) -> Void

    private var first: Int { week.days.firstIndex(where: \.inMonth) ?? 0 }
    private var last: Int { week.days.lastIndex(where: \.inMonth) ?? 6 }

    var body: some View {
        VStack(spacing: 0) {
            Rectangle().fill(Theme.border.color.opacity(0.7)).frame(height: 1)
                .frame(maxWidth: .infinity)
            ZStack(alignment: .topLeading) {
                VStack(spacing: 0) {
                    HStack(spacing: 0) {
                        ForEach(Array(week.days.enumerated()), id: \.offset) { c, day in
                            number(day, c)
                        }
                    }
                    .frame(height: 40)
                    ZStack(alignment: .topLeading) {
                        ForEach(Array(week.layout.placed.enumerated()), id: \.offset) { _, p in
                            bar(p)
                        }
                        ForEach(0..<7, id: \.self) { c in
                            if week.layout.hidden[c] > 0 && week.days[c].inMonth {
                                Text(verbatim: "+\(week.layout.hidden[c])")
                                    .font(.system(size: 10))
                                    .foregroundStyle(Theme.mutedForeground.color)
                                    .frame(width: column)
                                    .offset(x: column * CGFloat(c), y: CGFloat(monthLanes) * monthLanePoints)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .topLeading)
                    .frame(height: CGFloat(monthLanes) * monthLanePoints + monthMorePoints, alignment: .topLeading)
                    .clipped()
                    .accessibilityHidden(true)
                }
                Text(verbatim: "\(week.number)")
                    .font(.system(size: 10).monospacedDigit())
                    .foregroundStyle(Theme.mutedForeground.color)
                    .padding(.leading, 4)
                    .padding(.top, 2)
                    .accessibilityHidden(true)
                // A tap anywhere on a day opens it.
                HStack(spacing: 0) {
                    ForEach(Array(week.days.enumerated()), id: \.offset) { _, day in
                        if day.inMonth {
                            Button { pick(day.date, HomeFrames.shared.cell(of: day.date)) } label: {
                                Color.clear.contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(
                                starred.contains(day.date)
                                    ? "\(dayLabel(day.date, lang)), \(CasyStrings.homeStarred)" : dayLabel(day.date, lang))
                            .accessibilityIdentifier("day.\(dayKey(day.date, appTimeZone))")
                        } else {
                            Color.clear.accessibilityHidden(true)
                        }
                    }
                }
            }
        }
        // Where it is, for the day view to zoom out of and back into (not observed: no redraw).
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { frame in
            HomeFrames.shared.rows[HomeFrames.key(month, week.id)] = (frame, column)
        }
        .onDisappear { HomeFrames.shared.rows[HomeFrames.key(month, week.id)] = nil }
    }

    @ViewBuilder private func number(_ day: MonthDay, _ c: Int) -> some View {
        ZStack(alignment: .topTrailing) {
            if day.inMonth {
                let isToday = day.date == today
                Text(verbatim: "\(day.dayOfMonth)")
                    .font(.system(size: 18, weight: isToday ? .semibold : .regular))
                    .foregroundStyle(
                        isToday ? .white : c >= 5 ? Theme.mutedForeground.color : Theme.foreground.color)
                    .frame(width: 32, height: 32)
                    .background(isToday ? Theme.cta.color : .clear, in: Circle())
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                if starred.contains(day.date) {
                    Image(systemName: "star.fill")
                        .font(.system(size: 8))
                        .foregroundStyle(Theme.primary.color)
                        .padding(.top, 2)
                        .padding(.trailing, max(0, column / 2 - 20))
                }
            }
        }
        .frame(width: column, height: 40)
    }

    /// An item as a tinted chip, or a bar across days, cut at the month's own days.
    @ViewBuilder private func bar(_ p: PlacedItem) -> some View {
        let from = max(p.from, first)
        let to = min(p.to, last)
        if from <= to {
            let before = p.continuesBefore || from > p.from
            let after = p.continuesAfter || to < p.to
            let left = column * CGFloat(from) + (before ? 0 : 2)
            let width = column * CGFloat(to - from + 1) - (before ? 0 : 2) - (after ? 0 : 2)
            let shape = UnevenRoundedRectangle(
                topLeadingRadius: before ? 0 : 4, bottomLeadingRadius: before ? 0 : 4,
                bottomTrailingRadius: after ? 0 : 4, topTrailingRadius: after ? 0 : 4)
            let pencil = p.item.pencil == true
            let rgb = color(p.item.calendarId)
            Text(verbatim: p.item.label)
                .font(.system(size: 11, weight: .semibold))
                .lineLimit(1)
                .padding(.horizontal, 4)
                .frame(width: max(0, width), height: monthLanePoints - 3, alignment: .leading)
                .foregroundStyle(pencil ? Theme.primary.color : Color(rgb: CasyCore.shade(rgb, dark: dark)))
                .background {
                    if pencil {
                        shape.fill(Theme.primary.color.opacity(0.1))
                            .overlay(shape.strokeBorder(Theme.primary.color, style: StrokeStyle(lineWidth: 1, dash: [3, 2])))
                    } else {
                        shape.fill(Color(rgb: CasyCore.tint(rgb, dark: dark)))
                    }
                }
                .overlay {
                    if p.item.pulse == true { Pulse(shape: shape) }
                }
                .offset(x: left, y: CGFloat(p.lane) * monthLanePoints)
        }
    }
}

/// A trip Casy is asking about glows softly, fading in and out.
private struct Pulse<S: Shape>: View {
    let shape: S
    @State private var on = false

    var body: some View {
        shape.stroke(Theme.primary.color, lineWidth: 2)
            .opacity(on ? 0.9 : 0.15)
            .animation(.easeInOut(duration: 1.1).repeatForever(autoreverses: true), value: on)
            .onAppear { on = true }
    }
}

/// Where each week row of the month is on screen, kept outside SwiftUI's
/// state so that scrolling redraws nothing: the day view reads it as it zooms.
final class HomeFrames {
    @MainActor static let shared = HomeFrames()
    var rows: [String: (frame: CGRect, column: CGFloat)] = [:]

    static func key(_ month: Int64, _ week: Int64) -> String { "\(month):\(week)" }

    /// A day's cell, in the screen's coordinates, if it is drawn and in sight.
    @MainActor func cell(of day: Int64) -> CGRect? {
        let dow = localDate(day, appTimeZone).dow
        let monday = addDays(day, -((dow + 6) % 7), appTimeZone)
        guard let row = rows[Self.key(startOfMonth(day, appTimeZone), monday)] else { return nil }
        let c = CGFloat((dow + 6) % 7)
        let rect = CGRect(x: row.frame.minX + row.column * c, y: row.frame.minY, width: row.column, height: row.frame.height)
        let screen = UIScreen.main.bounds
        return rect.minY > 0 && rect.maxY < screen.height ? rect : nil
    }
}
