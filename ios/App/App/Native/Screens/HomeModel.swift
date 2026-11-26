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
    /// Your events that matter, with the AI's labels kept by the page (#114):
    /// what a vote's date is warned against.
    var important: [LabelledEvent] = []
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
    /// A month to scroll to (the paper pile's, #282: the web scrolls My calendar to the
    /// dates' month and throws the calendars onto it); the home page clears it once there.
    var focus: Int64?

    /// Back on this month once the pile is gone, as the home page opens (#282).
    func backToToday() {
        focus = months.first?.id
    }
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

    /// Your events that matter (#114): the app's own labels when it labels
    /// (LabelsWork), else what the page sent.
    var important: [LabelledEvent] { LabelsWork.on ? LabelsWork.shared.important : page.important }

    func color(_ calendarId: String) -> String {
        if Self.ownData && calendarId == casyVoteCalendar { return casyRGB }
        return page.colors[calendarId] ?? colors[calendarId] ?? "113, 113, 122"
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
                // A holiday by its own name ("Juledag"), not its calendar's ("Helligdage i Danmark").
                let years = localDate(from, appTimeZone).year...localDate(to, appTimeZone).year
                let holidayNames = Dictionary(
                    years.flatMap { danishHolidays($0, appTimeZone) }.map { ($0.date, lang == .da ? $0.name : $0.englishName) },
                    uniquingKeysWith: { a, b in "\(a), \(b)" })
                let items = calendarItems(counted, names: names, from: from, to: to, appTimeZone, lang).map { item in
                    guard item.calendarId == holidayCalendarId, let name = holidayNames[startOfDay(item.start, appTimeZone)]
                    else { return item }
                    var named = item
                    named.label = name
                    return named
                }
                return (
                    items,
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

    /// An agreed date being said and flown in: its chip waits on the month until it lands.
    var landing: (start: Int64, end: Int64)? {
        didSet { if landing?.start != oldValue?.start || landing?.end != oldValue?.end { dayCache = [:]; layOut() } }
    }

    /// Every month laid out again, off the main thread; the newest wins.
    /// Casy's own events on the month (#172), worked out here (#202): the waiting votes'
    /// dates pencilled in, the decided ones as chips; one decided since this device last
    /// looked waits to fly into its day (AgreedSeen) before its chip shows.
    private var voteItems: [MonthItem] {
        let events = EventsModel.shared.events ?? []
        let now = Native.now
        let titleOf = { (e: SuggestedEvent) in CasyStrings.eventTitle(e.title) }
        let flying = Set(AgreedSeen.read().map { newlyDecided(events, seen: $0, now: now).map(\.id) } ?? [])
        // Every agreed date as Casy's own chip, in Casy's orange, also one Casy wrote into
        // your calendar: its copy there is left out instead (`casyCopies`), so a date you
        // planned here always reads as one (the web draws the copy in its calendar's colour).
        return pencilItems(waitingVotes(events, now: now), titleOf: titleOf, now: now)
            + scheduledItems(events.filter { !flying.contains($0.id) }, calendarItems: [], titleOf: titleOf, now: now)
    }

    /// Your calendar's own copies of Casy's agreed dates (the same start and end): left out
    /// for Casy's chip.
    private func withoutCasyCopies(_ items: [MonthItem], _ votes: [MonthItem]) -> [MonthItem] {
        let chips = Set(votes.filter { $0.pencil != true }.map { "\($0.start)/\($0.end)" })
        guard !chips.isEmpty else { return items }
        return items.filter { !chips.contains("\($0.start)/\($0.end)") }
    }

    /// What goes on the month besides your calendar: Casy's events (the app's own, or the
    /// page's) and the trips' bars (the page's).
    private var extras: [MonthItem] { Self.ownData ? voteItems + page.extras : page.extras }

    /// Your calendar on the month: without the copies of Casy's chips when the app draws them.
    private func calendarShown(_ extras: [MonthItem]) -> [MonthItem] {
        let mine = holidaysHidden ? own.filter { $0.calendarId != holidayCalendarId } : own
        return Self.ownData ? withoutCasyCopies(mine, extras) : mine
    }

    /// The vote pill's words, when votes are waiting.
    var pill: String? {
        guard Self.ownData else { return page.pill }
        let waiting = waitingVotes(EventsModel.shared.events ?? [], now: Native.now)
        guard let first = waiting.first else { return nil }
        return waiting.count > 1 ? CasyStrings.homeVotesWaiting(waiting.count) : CasyStrings.homeVoteAnswer(CasyStrings.eventTitle(first.title))
    }

    /// The votes changed (or one landed): the month drawn again with them.
    func votesChanged() { if Self.ownData { dayCache = [:]; layOut() } }

    private func layOut() {
        let extras = extras
        let shown = landing.map { l in extras.filter { !($0.start == l.start && $0.end == l.end && $0.pencil != true) } } ?? extras
        let items = shown + calendarShown(extras)
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
        if !holidaysHidden {
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

    // MARK: What the app works out itself (#202), else as the page sends it

    /// The home page's data found here rather than told by the page: as its stars.
    static var ownData: Bool { HomeStars.on }

    /// The counts on Kalendere (calendars still wanting a look in the tour), Aftaler
    /// (votes waiting for your answer) and Profil (invitations).
    var badges: HomeBadges {
        guard Self.ownData else { return page.badges }
        let now = Native.now
        return HomeBadges(
            calendars: calendars.isEmpty ? page.badges.calendars : unsortedCalendars(calendars, seen: tourSeen).count,
            events: EventsModel.shared.events.map { $0.filter { needsYourAnswer($0, now: now) }.count } ?? page.badges.events,
            profile: ProfileModel.shared.whoAmI == nil ? page.badges.profile : ProfileModel.shared.invitations)
    }

    /// Tilføj til kalender offered: the AI is on for you.
    var tell: Bool {
        guard Self.ownData, let who = ProfileModel.shared.whoAmI else { return page.tell }
        return who.aiAllowed == true
    }

    /// The holidays calendar switched off (the web's `!holidays?.included`).
    var holidaysHidden: Bool {
        guard Self.ownData, !calendars.isEmpty else { return page.holidaysHidden }
        return calendars.first { $0.id == holidayCalendarId }?.included != true
    }

    /// The calendars gone through in the tour, kept here per person; the page's handed over.
    private(set) var tourSeen: Set<String> = []
    @ObservationIgnored private var userId: String?
    private static func tourKey(_ userId: String) -> String { "casy.calendarTourSeen.\(userId)" }

    func signedIn(_ userId: String?) {
        self.userId = userId
        tourSeen = userId.flatMap { UserDefaults.standard.stringArray(forKey: Self.tourKey($0)) }.map(Set.init) ?? []
    }

    /// The tour's calendars seen, from the page or the app's own tour: kept, and counted again.
    func rememberTourSeen(_ ids: [String]) {
        let seen = Set(ids)
        guard seen != tourSeen else { return }
        tourSeen = seen
        if let userId { UserDefaults.standard.set(Array(seen), forKey: Self.tourKey(userId)) }
    }

    /// Tid til hinanden's starred days: the app's own (HomeStars) when it finds them, else the page's.
    var starred: Set<Int64> { HomeStars.on ? Set(HomeStars.shared.stars.map(\.day)) : page.starred }

    func dayIsThePages(_ midnight: Int64) -> Bool {
        if !HomeStars.on && page.starred.contains(midnight) { return true }
        let next = addDays(midnight, 1, appTimeZone)
        return page.extras.contains { ($0.pencil == true || $0.pulse == true) && $0.end > midnight && $0.start < next }
    }

    func reset() {
        HomeStars.shared.reset()
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
