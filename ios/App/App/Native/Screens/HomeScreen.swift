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
    /// The months whose weeks have reached the header (their short names gone under it),
    /// of those drawn: the last is the big title's.
    @State private var reached: Set<Int64> = []
    /// How far the header reaches into the months (their scroll view's top inset).
    @State private var headerHeight: CGFloat = 0
    @Environment(\.colorScheme) private var scheme
    /// The day open in the day view, and whether it has zoomed out of its cell.
    @State private var shownDay: Int64?
    @State private var dayOpen = false
    /// The cell it zooms out of and back into; nil fades instead.
    @State private var cell: CGRect?
    @State private var dayFrame: CGRect = .zero
    /// One day or two, kept on this phone as the web's toggle is.
    @AppStorage("casy.daySpan") private var span = 1
    /// The toolbar shows the day view's buttons: as the growing day reaches it
    /// (40 % into the zoom), and the month's again as the day starts closing.
    @State private var toolbarDay = false
    /// The toolbar's pieces as wide as they draw, measured, for its capsules to
    /// morph between (HomeToolbar's layout animation).
    @State private var listWidth: CGFloat = 0
    @State private var backWidth: CGFloat = 0
    @State private var spanWidth: CGFloat = 0
    @State private var pinnedWidth: CGFloat = 0
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    /// The vote being answered over the day view (#282), and how much of the
    /// screen its card covers.
    @State private var deck: VoteDeck?
    @State private var voteClear: CGFloat = 0
    /// Its card folded down while the calendar is touched; "‹ Oktober" takes
    /// it out onto the whole month, folded, free to look anywhere (the web's
    /// `folded` and `month`).
    @State private var voteFolded = false
    /// An agreed date said over the month, then flown into its day, with
    /// confetti as it lands (the web's AgreedCard, flyIntoDay, Celebration).
    @State private var agreed: SuggestedEvent?
    @State private var flight: DateFlight?
    @State private var celebrations = 0
    @State private var settled = false
    @State private var voteOnMonth = false
    /// Færdig on a vote (#241): the pill stays away until the app is opened
    /// again, or back after half an hour away (the web's voteLater.ts).
    @State private var votesAway = false
    @State private var awaySince: Date?
    @Environment(\.scenePhase) private var scenePhase

    /// The toolbar's row (HomeToolbar's stand-in): 8 under the safe area, 40
    /// tall; the day view leaves its bottom and 8 (PhoneCalendar's dayFrame.room).
    static let toolbarRoom: CGFloat = 8 + 40 + 8
    /// HomeToolbar's MORPH: damping 34, stiffness 420, mass 0.7.
    private static let morph = Animation.interpolatingSpring(mass: 0.7, stiffness: 420, damping: 34)

    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    var body: some View {
        GeometryReader { box in
            let column = box.size.width / 7
            ZStack(alignment: .top) {
                months(column, bottomSafe: box.safeAreaInsets.bottom)
                if let day = shownDay {
                    VStack(spacing: 0) {
                        // The toolbar's room: it stays where it is, over the day growing in.
                        Theme.background.color
                            .frame(height: Self.toolbarRoom)
                            .opacity(dayOpen ? 1 : 0)
                        dayContent(day)
                    }
                    // Down to the screen's edge, so the month doesn't show under it once open.
                    .background(Theme.background.color.ignoresSafeArea().opacity(dayOpen ? 1 : 0))
                    .zIndex(1)
                }
                toolbar.zIndex(2)
                if let agreed {
                    AgreedCard(event: agreed) { from in flyIn(agreed, from: from) }
                        .transition(.opacity)
                        .zIndex(4)
                }
                if let flight {
                    FlyingDate(flight: flight) { landed() }
                        .id(flight.id)
                        .zIndex(5)
                }
                if celebrations > 0 {
                    Celebration().id(celebrations).zIndex(6)
                }
                if let deck {
                    HomeVotePanel(
                        deck: deck, close: { closeVote(away: false) }, later: { closeVote(away: true) },
                        onClear: { voteClear = $0 }, folded: voteFolded, onUnfold: unfoldVote
                    )
                    .id(deck.eventId)
                    .transition(.move(edge: .bottom))
                    .zIndex(3)
                }
            }
        }
        .background(Theme.background.color.ignoresSafeArea())
        .task {
            if EventsModel.shared.events == nil { await EventsModel.shared.load() }
            // As the web's SHEETS_AFTER_MS: the home page settles before anything is said over it.
            try? await Task.sleep(for: .milliseconds(1200))
            settled = true
            // Tid til hinanden's stars, once the home page has settled (the page's usePrimeDates).
            if HomeStars.on { HomeStars.shared.refresh() }
            // Your AI setting and invitations, for Tilføj til kalender and Profil's count.
            if HomeModel.ownData { await ProfileModel.shared.load() }
            sayAgreed()
        }
        .onChange(of: EventsModel.shared.events) { _, _ in
            model.votesChanged()
            sayAgreed()
        }
        .onChange(of: idle) { _, _ in sayAgreed() }
        .onChange(of: model.page.dataAt) { _, _ in
            Task {
                await EventsModel.shared.load()
                if HomeModel.ownData { await ProfileModel.shared.load() }
            }
        }
        .onChange(of: deck?.view) { _, view in showVote(view) }
        .onChange(of: voteClear) { _, clear in model.voting?.clear = clear }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background { awaySince = Date() }
            if phase == .active, let since = awaySince {
                if Date().timeIntervalSince(since) >= 30 * 60 { votesAway = false }
                awaySince = nil
            }
        }
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

    private func months(_ column: CGFloat, bottomSafe: CGFloat) -> some View {
            ScrollView {
                // Its own view, drawn again only when what it shows changes: never
                // as an open day moves (every day changed redrew a year of months
                // under it, part of the 18 Nov 2026 freeze).
                MonthList(
                    months: model.months, column: column, today: startOfDay(Native.now, appTimeZone),
                    starred: model.starred, lang: lang, dark: scheme == .dark, color: model.color,
                    headerHeight: headerHeight, pick: pick,
                    reach: { month, now in
                        if now { reached.insert(month) } else { reached.remove(month) }
                    }
                )
                .equatable()
            }
            .scrollPosition(id: $position, anchor: .top)
            .onScrollGeometryChange(for: CGFloat.self) { $0.contentInsets.top } action: { _, top in
                headerHeight = top
            }
            .onChange(of: model.months.first?.id, initial: true) { _, first in
                // Opened on this month's first week, once the months are there.
                if position == nil, let first { position = first }
            }
            .onChange(of: model.focus) { _, month in
                guard let month else { return }
                withAnimation(.easeInOut(duration: 0.45)) { position = month }
                model.focus = nil
            }
            .refreshable {
                await model.load()
                if HomeStars.on { HomeStars.shared.refresh(force: true) }
            }
            .accessibilityIdentifier("home.months")
            .casyTopBar { header }
            .safeAreaInset(edge: .bottom, spacing: 0) { bottom(safe: bottomSafe) }
            .accessibilityHidden(shownDay != nil)
            // Under an open day nothing reaches it: no tap, no swipe, no pull to refresh.
            .allowsHitTesting(shownDay == nil)
    }

    // MARK: The day view

    /// A tap on a day: the page's when it has something there (a trip
    /// waiting, a vote's date, a starred day), else its day view, zoomed out of its cell.
    private func pick(_ day: Int64, _ from: CGRect?) {
        // While a vote is answered, a day opens in the day view, the vote still on.
        if deck != nil {
            voteOnMonth = false
            openDayView(day, from: from)
            return
        }
        if let vote = waitingVote(on: day) {
            openVote(vote, from: from)
            return
        }
        // A star of the app's own: Tid til hinanden's sheet, which the page opens.
        if HomeStars.on, HomeStars.shared.star(on: day) != nil {
            model.onAction?("prime", day)
            return
        }
        if model.dayIsThePages(day) {
            model.onAction?("day", day)
            return
        }
        openDayView(day, from: from)
    }

    /// Its day view, zoomed out of its cell.
    private func openDayView(_ day: Int64, from: CGRect?) {
        cell = from
        dayOpen = false
        shownDay = day
        Task { @MainActor in
            withAnimation(Self.zoomIn) { dayOpen = true }
            try? await Task.sleep(for: .milliseconds(Int(380 * 0.4)))
            if shownDay != nil, dayOpen { withAnimation(Self.morph) { toolbarDay = true } }
        }
    }

    /// The web's zoom (morph.ts's ZOOM): cubic-bezier(0.32, 0.72, 0, 1), 380 ms
    /// out of the cell and 320 ms back into it.
    private static let zoomIn = Animation.timingCurve(0.32, 0.72, 0, 1, duration: 0.38)
    private static let zoomOut = Animation.timingCurve(0.32, 0.72, 0, 1, duration: 0.32)

    /// Back to the month, shrinking into the cell of the day it is on now,
    /// brought into view first; faded if it can't be found.
    private func closeDay() {
        guard let day = shownDay else { return }
        // The toolbar is the month's again at once, as the day starts closing.
        withAnimation(Self.morph) { toolbarDay = false }
        if let visible = HomeFrames.shared.cell(of: day) {
            // In sight: the zoom starts on this very frame, no wait.
            cell = visible
            withAnimation(Self.zoomOut) { dayOpen = false } completion: { shownDay = nil }
            return
        }
        // Out of sight: its month brought into view first, then into its cell.
        position = startOfMonth(day, appTimeZone)
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(30))
            cell = HomeFrames.shared.cell(of: day)
            withAnimation(Self.zoomOut) { dayOpen = false } completion: { shownDay = nil }
        }
    }

    /// HomeToolbar (#180, #281): one toolbar over the month and the day view
    /// alike, so its buttons never move as a day opens, they morph into their
    /// use there. "Kalendere" (lucide Layers 20, 6 between, 14 left 16 right)
    /// becomes "‹ <month>" (ChevronLeft 24, 2 between, 8 left 16 right), its
    /// words crossfading as the capsule's width follows; the right capsule
    /// takes the 1/2 day switch (15 semibold, 16 left 12 right, a divider) in
    /// on its left, so the plus and I dag stay put. 17 regular, 16 at the
    /// sides, 8 under the safe area, on HomeToolbar's MORPH spring.
    /// How much of the right capsule shows: I dag and the plus, and the 1/2
    /// day switch beside them in the day view; nil until measured (all of it).
    private var rightWidth: CGFloat? {
        pinnedWidth > 0 ? pinnedWidth + (toolbarDay && shownDay != nil ? spanWidth : 0) : nil
    }

    private var toolbar: some View {
        let day = toolbarDay && shownDay != nil
        let month = shownDay.map { capitalize(monthName($0, lang)) } ?? ""
        return HStack(alignment: .top) {
            Button(action: day ? (deck != nil ? voteToMonth : closeDay) : { model.onAction?("calendars", nil) }) {
                // Both words always laid out, one faded in (0.18 s, the web's
                // crossfade); the capsule's width morphs from one to the other.
                ZStack(alignment: .leading) {
                    HStack(spacing: 6) {
                        LucideIcon("layers", size: 20)
                        Text(CasyStrings.calendarsTitle).font(.system(size: 17))
                    }
                    .padding(.leading, 14)
                    .padding(.trailing, 16)
                    .fixedSize()
                    .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { listWidth = $0 }
                    .opacity(day ? 0 : 1)
                    HStack(spacing: 2) {
                        LucideIcon("chevron-left", size: 24)
                        if !dynamicTypeSize.isAccessibilitySize {
                            Text(verbatim: month).font(.system(size: 17))
                        }
                    }
                    .padding(.leading, 8)
                    .padding(.trailing, 16)
                    .fixedSize()
                    .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { backWidth = $0 }
                    .opacity(day ? 1 : 0)
                }
                .animation(.linear(duration: 0.18), value: day)
                .frame(width: (day ? backWidth : listWidth).nonZero, height: 40, alignment: .leading)
                .clipped()
                .contentShape(Capsule())
                .casyGlass(clear: true)
            }
            .overlay(alignment: .topTrailing) { if !day { badge(model.badges.calendars) } }
            .accessibilityLabel(day ? CasyStrings.dayShowMonth(month) : CasyStrings.calendarsTitle)
            .accessibilityValue(
                !day && model.badges.calendars > 0 ? CasyStrings.homeToSort(model.badges.calendars) : "")
            .accessibilityIdentifier(day ? "day.back" : "home.calendars")
            Spacer()
            // The plus and I dag never move: pinned to the capsule's right edge,
            // with the 1/2 day switch laid out to their left. Only the capsule's
            // width (its clip and glass) morphs, revealing the switch leftward
            // as it widens (the web's width 0 to auto) and hiding it as it
            // narrows; nothing slides over anything.
            HStack(spacing: 0) {
                HStack(spacing: 0) {
                    Button { span = span == 1 ? 2 : 1 } label: {
                        // What a press shows, in words, as the web's.
                        Text(span == 1 ? CasyStrings.dayTwo : CasyStrings.dayOne)
                            .font(.system(size: 15, weight: .semibold))
                            .padding(.leading, 16)
                            .padding(.trailing, 12)
                            .frame(height: 40)
                            .contentShape(Rectangle())
                    }
                    .accessibilityLabel(span == 1 ? CasyStrings.dayShowTwo : CasyStrings.dayShowOne)
                    .accessibilityIdentifier("day.span")
                    divider
                }
                .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { spanWidth = $0 }
                .opacity(day ? 1 : 0)
                .allowsHitTesting(day)
                .accessibilityHidden(!day)
                HStack(spacing: 0) {
                    if model.tell {
                        Button { model.onAction?("tell", nil) } label: {
                            LucideIcon("plus", size: 24, stroke: 2.25)
                                .frame(width: 44, height: 40)
                                .contentShape(Rectangle())
                        }
                        .accessibilityLabel(CasyStrings.homeTell)
                        .accessibilityIdentifier("home.tell")
                        divider
                    }
                    Button {
                        if shownDay != nil {
                            withAnimation(.snappy) { shownDay = startOfDay(Native.now, appTimeZone) }
                        } else {
                            goToday()
                        }
                    } label: {
                        Text(CasyStrings.homeToday)
                            .font(.system(size: 17))
                            .padding(.horizontal, 16)
                            .frame(height: 40)
                            .contentShape(Rectangle())
                    }
                    .accessibilityIdentifier(day ? "day.today" : "home.today")
                }
                .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { pinnedWidth = $0 }
            }
            .fixedSize()
            // The layout above never changes; only the window onto it does: a
            // capsule pinned to the right, as wide as what shows, the glass
            // drawn in the same shape behind it. (Animating the layout's frame
            // moved the buttons: I dag slid over the plus.)
            .mask(alignment: .trailing) { Capsule().frame(width: rightWidth) }
            .background(alignment: .trailing) {
                Color.clear.frame(width: rightWidth, height: 40).casyGlass(clear: true)
            }
        }
        .buttonStyle(.plain)
        .foregroundStyle(Theme.primary.color)
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .animation(Self.morph, value: day)
        .animation(Self.morph, value: span)
    }

    /// The toolbar capsule's divider: 1 by 20 in the orange at 30 %.
    private var divider: some View {
        Rectangle().fill(Theme.primary.color.opacity(0.3)).frame(width: 1, height: 20)
    }

    /// The day view grows out of the date's circle and shrinks back into it:
    /// scaled evenly down to the 32 point circle round the date's number (1
    /// point line, then 4, centred in its column) as its corners round off,
    /// the square of the page turning into that circle (asked for on 18 Nov
    /// 2026: the web shrinks into the whole cell, square, and fades). Faded in
    /// over the first 30 % of the way out and out over the last 30 % back.
    ///
    /// Where it sits open is measured on a still layer beside it, never on the
    /// view being scaled and moved: measured there, every frame of the zoom
    /// moved its own target, and the zoom chased it, redrawing the screen.
    private func dayContent(_ day: Int64) -> some View {
        // The date's circle in its cell: 32 wide, under the row's 1 point line and 4.
        let from = cell.map { CGRect(x: $0.midX - 16, y: $0.minY + 5, width: 32, height: 32) } ?? .zero
        let zooms = cell != nil && dayFrame.width > 0
        let scale = zooms ? from.width / dayFrame.width : 1
        return ZStack(alignment: .topLeading) {
            Color.clear
                .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { dayFrame = $0 }
            HomeDayView(
                day: Binding(get: { shownDay ?? day }, set: { shownDay = $0 }), span: span,
                pageTap: { day in
                    if deck != nil { return }
                    if let vote = waitingVote(on: day) { openVote(vote, from: nil) } else { model.onAction?("day", day) }
                }
            )
            // Down to the screen's edge, so the month doesn't show under it.
            .background(Theme.background.color.ignoresSafeArea(edges: .bottom))
            // A finger on the week row or the hours folds a vote's card away.
            .simultaneousGesture(
                DragGesture(minimumDistance: 0).onChanged { _ in foldVote() },
                including: deck != nil && !voteFolded ? .all : .subviews)
            .mask(alignment: .topLeading) {
                // Open, nothing is clipped, the hours under the home indicator
                // included; in the circle, a square as wide as the page with
                // corners of half of it: a circle, scaled down to the date's.
                RoundedRectangle(cornerRadius: dayOpen || !zooms ? 0 : dayFrame.width / 2)
                    .frame(
                        width: dayFrame.width,
                        height: dayOpen || !zooms ? dayFrame.height + 200 : dayFrame.width)
            }
            .scaleEffect(dayOpen || !zooms ? 1 : scale, anchor: .topLeading)
            .offset(
                x: dayOpen || !zooms ? 0 : from.minX - dayFrame.minX,
                y: dayOpen || !zooms ? 0 : from.minY - dayFrame.minY)
            // The fade's own timing, for the fade alone: an `.animation` here would
            // also take over the scale and the move above it (it did: the zoom
            // ran in 0.11 s, and waited 0.22 s before closing).
            .animation(
                dayOpen ? .linear(duration: 0.38 * 0.3) : .linear(duration: 0.32 * 0.3).delay(0.32 * 0.7)
            ) { $0.opacity(dayOpen ? 1 : 0) }
        }
    }

    // MARK: An agreed date

    /// Nothing over the month: no vote, no open day, nothing of the page's, no flight.
    private var idle: Bool {
        settled && deck == nil && shownDay == nil && !model.page.covered && flight == nil && agreed == nil
            && pendingLanding == nil
    }

    private func sayAgreed() {
        // Only once the events are known: on a first visit, what is decided by then counts as seen.
        guard idle, let events = EventsModel.shared.events, let next = AgreedSeen.next(events) else { return }
        if let date = next.currentDate {
            model.landing = (instantOrZero(date.start), instantOrZero(date.end))
        }
        withAnimation(.easeOut(duration: 0.25)) { agreed = next }
    }

    /// The card closed: the month glides to the day, and the date flies there.
    private func flyIn(_ event: SuggestedEvent, from: CGRect) {
        // On its way from now: nothing else is said until it has landed.
        pendingLanding = event.id
        withAnimation(.easeOut(duration: 0.25)) { agreed = nil }
        guard let date = event.currentDate else { return }
        let day = startOfDay(instantOrZero(date.start), appTimeZone)
        withAnimation(.easeInOut(duration: 0.5)) { position = startOfMonth(day, appTimeZone) }
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(650))
            guard let cell = HomeFrames.shared.cell(of: day), !UIAccessibility.isReduceMotionEnabled else {
                pendingLanding = nil
                land(event.id)
                return
            }
            flight = DateFlight(label: CasyStrings.eventTitle(event.title), from: from, cell: cell)
        }
    }

    @State private var pendingLanding: String?

    private func landed() {
        if let id = pendingLanding { land(id) }
        pendingLanding = nil
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(700))
            flight = nil
        }
    }

    /// It has landed: the month's own chip takes over, confetti, and a
    /// moment to see it settle before the next is said.
    private func land(_ id: String) {
        AgreedSeen.mark(id)
        model.landing = nil
        celebrations += 1
        // A date agreed, landed in the calendar: the moment the page may ask
        // for a rating (#256).
        model.onAction?("landed", nil)
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(1500))
            sayAgreed()
        }
    }

    // MARK: Votes

    /// The votes waiting for your answer, soonest first (My events' toSwipe).
    private var waiting: [SuggestedEvent] {
        sectionEvents(EventsModel.shared.events ?? [], now: Native.now).toSwipe
    }

    /// A waiting vote with a date on that day: a tap there starts answering it.
    private func waitingVote(on day: Int64) -> SuggestedEvent? {
        waiting.first { v in v.candidates.contains { startOfDay(instantOrZero($0.start), appTimeZone) == day } }
    }

    /// Answering a vote over the day view (#176): the day view opens on the
    /// date being answered, zoomed out of its cell, the card along the bottom.
    private func openVote(_ event: SuggestedEvent, from: CGRect?) {
        let opened = VoteDeck(event)
        let first = opened.current ?? opened.dates.first
        let day = first.map { startOfDay(instantOrZero($0.start), appTimeZone) } ?? startOfDay(Native.now, appTimeZone)
        model.voting = opened.view
        model.voting?.clear = voteClear
        withAnimation(.timingCurve(0.32, 0.72, 0, 1, duration: 0.38)) { deck = opened }
        if shownDay == nil {
            openDayView(day, from: from ?? HomeFrames.shared.cell(of: day))
        } else {
            withAnimation(Self.travel(from: shownDay ?? day, to: day)) { shownDay = day }
        }
    }

    private func foldVote() {
        guard deck != nil, !voteFolded else { return }
        withAnimation(.easeInOut(duration: 0.3)) { voteFolded = true }
    }

    /// Unfolded, back to the day view on the date being answered, from the
    /// month or another day looked at meanwhile.
    private func unfoldVote() {
        withAnimation(.easeInOut(duration: 0.3)) { voteFolded = false }
        voteOnMonth = false
        guard let current = model.voting?.current else { return }
        let day = startOfDay(current.start, appTimeZone)
        if shownDay == nil {
            openDayView(day, from: HomeFrames.shared.cell(of: day))
        } else if shownDay != day {
            withAnimation(Self.travel(from: shownDay ?? day, to: day)) { shownDay = day }
        }
    }

    /// "‹ Oktober" while answering: the vote out onto the month, its card folded.
    private func voteToMonth() {
        withAnimation(.easeInOut(duration: 0.3)) { voteFolded = true }
        voteOnMonth = true
        closeDay()
    }

    /// The card says which date is up: the day view glides there (the web's
    /// travel: off quickly, then a long soft stop); on the month, the month does.
    private func showVote(_ view: VoteView?) {
        guard var view else { return }
        view.clear = voteClear
        model.voting = view
        if voteOnMonth, let current = view.current {
            withAnimation(.easeInOut(duration: 0.45)) { position = startOfMonth(current.start, appTimeZone) }
            return
        }
        guard let current = view.current, let shown = shownDay else { return }
        let day = startOfDay(current.start, appTimeZone)
        let inView = (0..<span).contains { addDays(shown, $0, appTimeZone) == day }
        if !inView { withAnimation(Self.travel(from: shown, to: day)) { shownDay = day } }
    }

    /// dayTravel.ts: 350 ms and 40 more a day, at most 0.9 s, on (0.6, 0, 0.1, 1).
    static func travel(from: Int64, to: Int64) -> Animation {
        let days = abs(Double(to - from) / 86_400_000).rounded()
        return .timingCurve(0.6, 0, 0.1, 1, duration: min(0.35 + 0.04 * days, 0.9))
    }

    /// Færdig, or every date answered: back to the month, gliding to today.
    private func closeVote(away: Bool) {
        if away { votesAway = true }
        voteFolded = false
        voteOnMonth = false
        withAnimation(.timingCurve(0.32, 0.72, 0, 1, duration: 0.32)) { deck = nil }
        model.voting = nil
        closeDay()
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(400))
            goToday()
        }
    }

    // MARK: The header

    /// The month on screen, as the web's `track`: the last whose first week has
    /// reached the header. A month's name row at the top (id -month) means its
    /// weeks haven't yet, so the title still names the month before.
    /// The last month whose weeks have reached the header: the moment its short name
    /// (MonthLabel, just above them) goes under it, by the same measure.
    private var titleMonth: Int64 {
        reached.max() ?? model.months.first?.id ?? startOfMonth(Native.now, appTimeZone)
    }

    /// MonthView's floating header with HomeToolbar on its stand-in row: the row
    /// 8 points under the safe area (APP_TOP_GAP), 40 tall, 4 under it, 16 at the
    /// sides; the title 30 bold, tight (-0.75), its line 37.5, 4 above and under,
    /// 12 at the sides; the weekdays 24 tall in 12 medium; 6 under the block.
    private var header: some View {
        VStack(alignment: .leading, spacing: 0) {
            // The toolbar's row: the toolbar itself floats over it (`toolbar`).
            Color.clear
                .frame(height: 40)
                .padding(.top, 8)
                .padding(.bottom, 4)
            if let failure = model.failure {
                Notice(failure, tone: .error).padding(.horizontal, 16).padding(.bottom, 8)
            }
            Text(verbatim: monthTitle(titleMonth))
                .font(.system(size: 30, weight: .bold))
                .tracking(-0.75)
                .foregroundStyle(Theme.foreground.color)
                .frame(height: 37.5)
                .padding(.horizontal, 12)
                .padding(.vertical, 4)
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
            .font(.system(size: 12, weight: .medium))
            .frame(height: 24)
            .padding(.bottom, 6)
            .accessibilityHidden(true)
        }
    }

    /// The web's count, 4 points outside the button's top right corner; none for 0.
    @ViewBuilder private func badge(_ count: Int) -> some View {
        if count > 0 { CountBadge(count).offset(x: 4, y: -4).allowsHitTesting(false) }
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

    /// HomeBar: max(safe area, 12) from the bottom, 16 at the sides, 12 between;
    /// Aftaler and Profil 48 round with a 24 icon, Planlæg 48 tall, 16 at its
    /// sides, a 20 icon 8 from 17 semibold. Over it HomePill (the vote pill):
    /// 12 above the bar, 44 tall, 16 left and 12 right, a 20 icon, 15 semibold,
    /// a 16 chevron, 8 between.
    private func bottom(safe: CGFloat) -> some View {
        VStack(spacing: 12) {
            if let pill = model.pill, !votesAway, deck == nil, let first = waiting.first {
                Button { openVote(first, from: nil) } label: {
                    HStack(spacing: 8) {
                        LucideIcon("vote", size: 20)
                        Text(pill).lineLimit(1)
                        LucideIcon("chevron-right", size: 16)
                    }
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.primary.color)
                    .padding(.leading, 16)
                    .padding(.trailing, 12)
                    .frame(height: 44)
                    .casyGlass()
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("home.pill")
            }
            HStack(spacing: 12) {
                round("calendar-check", label: CasyStrings.homeEvents, badge: model.badges.events, id: "home.events") {
                    model.onAction?("events", nil)
                }
                Button { model.onAction?("plan", nil) } label: {
                    HStack(spacing: 8) {
                        LucideIcon("calendar-search", size: 20)
                        Text(CasyStrings.homePlan).lineLimit(1)
                    }
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Theme.primary.color)
                    .padding(.horizontal, 16)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .casyGlass()
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("home.plan")
                round("user", label: CasyStrings.homeProfile, badge: model.badges.profile, id: "home.profile") {
                    model.onAction?("profile", nil)
                }
            }
        }
        .padding(.horizontal, 16)
        // The safe area is under it already; a phone without one keeps 12.
        .padding(.bottom, max(0, 12 - safe))
        // Gone while a vote is answered, its card where they were (HomeBar's `hidden`).
        .opacity(deck == nil ? 1 : 0)
        .allowsHitTesting(deck == nil)
        .animation(.easeOut(duration: 0.2), value: deck == nil)
    }

    private func round(
        _ icon: String, label: String, badge count: Int, id: String, action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            LucideIcon(icon, size: 24)
                .foregroundStyle(Theme.primary.color)
                .frame(width: 48, height: 48)
                .casyGlass()
        }
        .buttonStyle(.plain)
        .overlay(alignment: .topTrailing) { badge(count) }
        .accessibilityLabel(label)
        .accessibilityValue(count > 0 ? CasyStrings.homeWaiting(count) : "")
        .accessibilityIdentifier(id)
    }
}

/// The months, each as two scroll targets, its short name and its weeks (ids
/// -month and month): opening on a month opens on its first week, the name
/// tucked under the header as on the web (monthScrollTop, MONTH_LABEL_PX).
private struct MonthList: View, Equatable {
    let months: [HomeMonth]
    let column: CGFloat
    let today: Int64
    let starred: Set<Int64>
    let lang: Lang
    let dark: Bool
    let color: (String) -> String
    let headerHeight: CGFloat
    let pick: (Int64, CGRect?) -> Void
    /// A month's weeks reaching the header (true) or leaving it, or no longer drawn (false).
    let reach: (Int64, Bool) -> Void

    static func == (a: MonthList, b: MonthList) -> Bool {
        a.months == b.months && a.column == b.column && a.today == b.today && a.starred == b.starred
            && a.lang == b.lang && a.dark == b.dark && a.headerHeight == b.headerHeight
    }

    var body: some View {
        LazyVStack(spacing: 0) {
            ForEach(months.flatMap { [MonthRow(month: $0, label: true), MonthRow(month: $0, label: false)] }) { row in
                if row.label {
                    MonthLabel(
                        month: row.month.id, firstColumn: row.month.firstColumn, column: column, lang: lang,
                        headerHeight: headerHeight)
                } else {
                    MonthBlock(
                        month: row.month, column: column, today: today, starred: starred, lang: lang, dark: dark,
                        color: color, pick: pick
                    )
                    .equatable()
                    // Its weeks at or past the header's bottom edge: the title's month (MonthLabel
                    // goes by the same edge). Only a crossing calls back, however fast it scrolls.
                    .onGeometryChange(for: Bool.self) { [headerHeight] proxy in
                        proxy.frame(in: .scrollView).minY - headerHeight <= 0.5
                    } action: { now in
                        reach(row.month.id, now)
                    }
                    .onDisappear { reach(row.month.id, false) }
                }
            }
        }
        .scrollTargetLayout()
    }
}

/// A row of the months' list: a month's short name, or its weeks.
private struct MonthRow: Identifiable {
    let month: HomeMonth
    let label: Bool
    var id: Int64 { label ? -month.id : month.id }
}

/// A month's short name ("Nov"), 17 bold, over the column of its first day,
/// in a 28 point row (MONTH_LABEL_PX). It is there until it goes under the
/// header, and gone the instant it does, as the big title takes its month (the
/// same edge as MonthList's, where its weeks start): iOS 26's soft scroll edge only
/// softens what is under the header, and it showed through the weekdays (18 Nov
/// 2026); faded out by its own measure, it disagreed with the title (25 Nov).
private struct MonthLabel: View {
    let month: Int64
    let firstColumn: Int
    let column: CGFloat
    let lang: Lang
    let headerHeight: CGFloat

    var body: some View {
        Text(verbatim: capitalize(monthShortName(month, lang)).replacingOccurrences(of: ".", with: ""))
            .font(.system(size: 17, weight: .bold))
            .foregroundStyle(Theme.foreground.color)
            .lineLimit(1)
            .frame(width: column)
            .offset(x: column * CGFloat(firstColumn))
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(height: 28, alignment: .top)
            .visualEffect { [headerHeight] content, proxy in
                // There while its bottom is below the header, gone the instant it goes under
                // and the big title takes its month (MonthList, by the same edge), never fading.
                let below = proxy.frame(in: .scrollView).minY - headerHeight + 28
                return content.opacity(below > 0.5 ? 1 : 0)
            }
            .accessibilityHidden(true)
    }
}

// MARK: - A month

/// One month's weeks (its short name is a row of its own, `MonthLabel`).
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
            // The web's chip: 11 semibold on a 16 point line, 4 at the sides; the
            // pencil's 1 point dashed border is inside the box, as CSS draws it,
            // so its words have a point less room each side and sit a point lower.
            Text(verbatim: p.item.label)
                .font(.system(size: 11, weight: .semibold))
                .lineLimit(1)
                .frame(height: 16)
                .padding(.horizontal, pencil ? 5 : 4)
                .padding(.top, pencil ? 1 : 0)
                .frame(width: max(0, width), height: monthLanePoints - 3, alignment: .topLeading)
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

private extension CGFloat {
    /// Nil until measured, so a piece is drawn at its own size meanwhile.
    var nonZero: CGFloat? { self > 0 ? self : nil }
}
