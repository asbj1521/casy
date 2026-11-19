import CasyAPI
import CasyCore
import CasyUI
import Foundation

/// One week of a month, laid out once: its days, its number, and where each
/// item sits (CasyCore's `layoutWeek`), so drawing it costs nothing.
struct HomeWeek: Identifiable, Equatable {
    let id: Int64
    let days: [MonthDay]
    let number: Int
    let layout: WeekLayout
}

/// One month of the home page.
struct HomeMonth: Identifiable, Equatable {
    /// Its first local midnight.
    let id: Int64
    let weeks: [HomeWeek]
    /// The column (0 = Monday) its first day is in, where its short name goes.
    let firstColumn: Int
}

/// What the page says about the home page while it is native (#201): the
/// things it still works out itself (the votes' dates, the trips Casy found,
/// the starred days) and whether something of its own is over the month.
struct HomeFromPage: Equatable {
    /// On the home page at all (signed in, at /).
    var shown = false
    /// Something only the page draws is over the month (the day view, Planlæg,
    /// a vote, a card): the native home steps aside for it.
    var covered = false
    /// The votes' pencilled dates and chips, the trips' bars.
    var extras: [MonthItem] = []
    /// Their colours, "r, g, b".
    var colors: [String: String] = [:]
    /// Days a whole group is free (Tid til hinanden), local midnights.
    var starred: Set<Int64> = []
    /// The vote pill's words, when votes are waiting.
    var pill: String?
    /// Tilføj til kalender is offered (the AI is there for this person).
    var tell = false
    var holidaysHidden = false
    /// The counts on the buttons, as the page draws them (#281).
    var badges = HomeBadges()
    /// When the page last fetched your calendars: a new one means read again.
    var dataAt: Double = 0
}

/// The home page's counts: calendars not set up yet (Kalendere), votes waiting
/// on you (Aftaler), invitations (Profil). 0 draws none.
struct HomeBadges: Equatable {
    var calendars = 0
    var events = 0
    var profile = 0
}

/// The native home page's data (#201): your calendar over the year searched,
/// read here (the busy times from the server, this phone's own events with
/// their titles from the phone), laid out a month at a time off the main
/// thread, with what the page adds on top.
@MainActor @Observable
final class HomeModel {
    static let shared = HomeModel()

    /// The months, from this one, laid out.
    private(set) var months: [HomeMonth] = []
    private(set) var colors: [String: String] = [:]
    private(set) var failure: String?
    private(set) var loading = false
    private(set) var page = HomeFromPage()

    /// The last press, under a UI test, where it can read it.
    var testAction = ""

    /// The bridge's: what a tap asks of the page.
    var onAction: ((_ action: String, _ day: Int64?) -> Void)?

    /// The window searched, as the web's SEARCH_WINDOW: this month and eleven more.
    static let monthCount = 12

    /// Your own calendar's items, before the page's are added.
    private var own: [MonthItem] = []
    /// What they were made from, for a day's view: the counted blocks with
    /// their titles, places and notes, and your calendars.
    private var counted: [OverviewBlock] = []
    private(set) var calendars: [OverviewCalendar] = []
    private var loadedAt: Double = -1
    /// Your blocks cut at each day's midnights, made once off the main thread
    /// as your calendar loads (#281): the day view only looks a day up.
    private var byDay: [String: [DaySegment]] = [:]
    private var names: [String: String] = [:]
    /// Each day as the day view draws it, made once and kept until something
    /// it shows changes; never observed, so filling it redraws nothing.
    @ObservationIgnored private var dayCache: [Int64: HomeDay] = [:]
    @ObservationIgnored private var holidayYears: [Int: [Holiday]] = [:]
    private var layoutTask: Task<Void, Never>?

    func color(_ calendarId: String) -> String {
        page.colors[calendarId] ?? colors[calendarId] ?? "113, 113, 122"
    }

    /// What the page sent; a newer fetch of your calendars reads them again.
    func update(_ fresh: HomeFromPage) {
        let relayout = fresh.extras != page.extras || fresh.holidaysHidden != page.holidaysHidden
        // Only while it is drawn: with the switch off it reads nothing.
        let reload = fresh.shown && NativeHome.on && fresh.dataAt != loadedAt
        if fresh.extras != page.extras || fresh.holidaysHidden != page.holidaysHidden || fresh.colors != page.colors {
            dayCache = [:]
        }
        page = fresh
        if reload {
            Task { await load() }
        } else if relayout {
            layOut()
        }
    }

    /// Switched on with the page already sent: read what it hasn't yet.
    func loadIfNeeded() {
        if page.shown && loadedAt != page.dataAt { Task { await load() } }
    }

    func load() async {
        guard let api = await Native.api() else { return }
        loadedAt = page.dataAt
        loading = months.isEmpty
        defer { loading = false }
        let from = startOfMonth(Native.now, appTimeZone)
        let to = startOfMonth(from, appTimeZone, Self.monthCount)
        do {
            let data = try await api.calendarBusy(
                from: isoString(from), to: isoString(to), errorMessage: CasyStrings.loadCalendarsFailed)
            let lang = CasyStrings.language == "en" ? Lang.en : Lang.da
            let (items, palette, blocks, cut) = await Task.detached(priority: .userInitiated) {
                let (blocks, phoneColors) = DayOfCalendar.phoneDrawn(data, from: from, to: to)
                let included = Set(data.calendars.filter(\.included).map(\.id))
                // What you told Casy has no tick: it always counts, so it is always drawn.
                let counted =
                    blocks.filter { included.contains($0.calendarId) }
                    + (data.entries ?? []).map {
                        OverviewBlock(
                            calendarId: casyCalendarId, start: $0.start, end: $0.end,
                            details: EventDetails(title: $0.label, location: "", notes: ""))
                    }
                let names = Dictionary(data.calendars.map { ($0.id, $0.name) }, uniquingKeysWith: { a, _ in a })
                return (
                    calendarItems(counted, names: names, from: from, to: to, appTimeZone, lang),
                    calendarColors(data.calendars, own: phoneColors),
                    counted,
                    segmentByDay(counted, from: from, to: to, appTimeZone)
                )
            }.value
            own = items
            counted = blocks
            byDay = cut
            calendars = data.calendars
            names = Dictionary(data.calendars.map { ($0.id, $0.name) }, uniquingKeysWith: { a, _ in a })
            dayCache = [:]
            colors = palette
            failure = nil
            layOut()
        } catch {
            if months.isEmpty { failure = error.localizedDescription }
        }
    }

    /// Every month laid out again, off the main thread; the newest wins.
    private func layOut() {
        let items =
            page.extras + (page.holidaysHidden ? own.filter { $0.calendarId != holidayCalendarId } : own)
        let first = startOfMonth(Native.now, appTimeZone)
        layoutTask?.cancel()
        layoutTask = Task {
            let laid = await Task.detached(priority: .userInitiated) {
                Self.months(items, from: first)
            }.value
            if !Task.isCancelled { months = laid }
        }
    }

    nonisolated static func months(_ items: [MonthItem], from first: Int64) -> [HomeMonth] {
        (0..<monthCount).map { n in
            let month = startOfMonth(first, appTimeZone, n)
            let local = localDate(month, appTimeZone)
            let layout = monthLayout(local.year, local.month, appTimeZone)
            // Only what touches the month, a week to spare each side.
            let near = items.filter {
                $0.end > addDays(month, -7, appTimeZone)
                    && $0.start < addDays(startOfMonth(month, appTimeZone, 1), 7, appTimeZone)
            }
            let weeks = layout.weeks.enumerated().map { w, week in
                let days = week.map(\.date)
                return HomeWeek(
                    id: days[0], days: week, number: layout.weekNumbers[w],
                    layout: layoutWeek(near, days: days, weekEnd: addDays(days[6], 1, appTimeZone), lanes: monthLanes))
            }
            return HomeMonth(
                id: month, weeks: weeks, firstColumn: max(0, layout.weeks[0].firstIndex(where: \.inMonth) ?? 0))
        }
    }

    /// One day as the day view draws it (the web's useDayCalendar): your
    /// blocks cut at its midnights, the holidays first as whole days, and what
    /// the page adds on top (a vote's date, a trip) as items of their own.
    func day(_ midnight: Int64) -> (calendar: DayOfCalendar, extras: [MonthItem]) {
        let shown = laidOut(midnight)
        return (shown.calendar, shown.extras)
    }

    /// A day's timed blocks placed in its hours, as Apple Calendar does.
    func placed(_ midnight: Int64) -> [PlacedBlock] { laidOut(midnight).placed }

    /// A day, from the cut made as your calendar loaded: a lookup, its
    /// holidays (worked out once a year) and the page's few items.
    private func laidOut(_ midnight: Int64) -> HomeDay {
        if let kept = dayCache[midnight] { return kept }
        let next = addDays(midnight, 1, appTimeZone)
        var segments = byDay[dayKey(midnight, appTimeZone)] ?? []
        let lang = CasyStrings.language == "en" ? Lang.en : Lang.da
        var holidayNames: [String: String] = [:]
        if !page.holidaysHidden {
            let year = localDate(midnight, appTimeZone).year
            if holidayYears[year] == nil { holidayYears[year] = danishHolidays(year, appTimeZone) }
            let holidays = (holidayYears[year] ?? []).filter { $0.date == midnight }
            for h in holidays { holidayNames[h.key] = lang == .da ? h.name : h.englishName }
            segments =
                holidays.map {
                    DaySegment(
                        calendarId: holidayCalendarId, start: $0.date, end: next, allDay: true,
                        continuesBefore: false, continuesAfter: false)
                } + segments
        }
        let calendar = DayOfCalendar(
            segments: segments, colors: colors, names: names, holidays: holidayNames, none: calendars.isEmpty)
        let day = HomeDay(
            calendar: calendar,
            extras: page.extras.filter { $0.end > midnight && $0.start < next },
            placed: placeBlocks(segments.filter { !$0.allDay }, midnight: midnight, appTimeZone, minHeight: DayHours.linePoints / DayHours.dayPoints))
        dayCache[midnight] = day
        return day
    }

    /// The vote being answered over the day view (#282), as its card has it.
    var voting: VoteView?

    /// The first thing in your own calendar a date runs into, and how many
    /// more (the web's clashesOn): for a meeting anything during it, for a
    /// trip or holiday anything on its days. Holidays aren't counted.
    func clash(start: Int64, end: Int64) -> (what: String, more: Int)? {
        var hits: [(DaySegment, DayOfCalendar)] = []
        var day = startOfDay(start, appTimeZone)
        while day < end {
            let shown = laidOut(day)
            for s in byDay[dayKey(day, appTimeZone)] ?? [] where s.start < end && s.end > start {
                hits.append((s, shown.calendar))
            }
            day = addDays(day, 1, appTimeZone)
        }
        guard let (first, calendar) = hits.first else { return nil }
        let when = formatSegmentRange(first, appTimeZone, allDay: "")
        let what = when.isEmpty ? calendar.label(first) : "\(calendar.label(first)) \(when)"
        return (what, hits.count - 1)
    }

    /// A day with a vote's date to answer on it: a waiting vote's pencilled
    /// date, or one of the vote being answered.
    func votesOn(_ midnight: Int64) -> Bool {
        let next = addDays(midnight, 1, appTimeZone)
        if voting?.dates.contains(where: { $0.start >= midnight && $0.start < next }) == true { return true }
        return page.extras.contains { $0.pencil == true && $0.pulse != true && $0.start >= midnight && $0.start < next }
    }

    func dayIsThePages(_ midnight: Int64) -> Bool {
        if page.starred.contains(midnight) { return true }
        let next = addDays(midnight, 1, appTimeZone)
        return page.extras.contains { ($0.pencil == true || $0.pulse == true) && $0.end > midnight && $0.start < next }
    }

    func reset() {
        months = []
        own = []
        counted = []
        byDay = [:]
        names = [:]
        dayCache = [:]
        calendars = []
        colors = [:]
        failure = nil
        loadedAt = -1
        page = HomeFromPage()
    }
}

/// One day of the day view, worked out once (`HomeModel.laidOut`).
struct HomeDay {
    let calendar: DayOfCalendar
    let extras: [MonthItem]
    let placed: [PlacedBlock]
}
