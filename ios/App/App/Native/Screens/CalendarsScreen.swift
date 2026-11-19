import CasyAPI
import CasyCore
import CasyUI
import SwiftUI

/// The screens Kalendere pushes inside itself.
enum CalendarsPage: Hashable {
    case accounts, tour, primary
}

/// Kalendere opened by itself (#200), from the home page's Kalendere button,
/// on the screen the address named (`?calendars=accounts`, `=tour`).
struct CalendarsSheet: View {
    let preferences: NativePreferences
    let start: CalendarsPage?
    /// A provider picked before arriving (`?connect=apple`): its form opens.
    let connect: String?
    let onDone: () -> Void
    let leave: (LeavingProfile) -> Void

    @State private var path: [CalendarsPage] = []
    @State private var started = false

    var body: some View {
        NavigationStack(path: $path) {
            CalendarsScreen()
                .navigationDestination(for: CalendarsPage.self) { page in
                    switch page {
                    case .accounts: ConnectedCalendarsScreen(connect: connect, leave: leave)
                    case .tour: CalendarTourScreen()
                    case .primary: PrimaryCalendarScreen()
                    }
                }
        }
        .environment(\.closeSheet, onDone)
        .nativeSheetLook(preferences)
        .onAppear {
            guard !started else { return }
            started = true
            if let start { path = [start] }
        }
    }
}

/// Kalendere (#219, #200), as the web's CalendarsSheet (#281): a CardList with
/// the guided setup (first while calendars wait for it) and Forbundne
/// kalendere, then the web's CalendarListPanel card, every calendar by brand,
/// with what counts, its category and how much it matters. The primary
/// calendar is left to Forbundne kalendere, as the web's sheet does.
struct CalendarsScreen: View {
    private let model = CalendarsModel.shared
    @Environment(\.closeSheet) private var closeSheet

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // The web's ListGroup mb-4 mt-0: no room above, 16 under.
                CardList(spaced: false) {
                    if model.toSort > 0 { tourRow }
                    NavigationLink(value: CalendarsPage.accounts) {
                        CardRow(
                            CasyStrings.accountsRow, icon: "calendar-plus", detail: CasyStrings.accountsRowDetail,
                            value: model.connectedCount.map(String.init))
                    }
                    .buttonStyle(.cardRow)
                    .accessibilityIdentifier("calendars.accounts")
                    if model.toSort == 0 && model.data != nil { tourRow }
                }
                .padding(.bottom, 16)
                if model.data != nil {
                    CalendarList()
                } else if let failure = model.failure {
                    VStack(alignment: .leading, spacing: 12) {
                        Notice(failure, tone: .error, bare: true)
                        OutlineCapsule(label: CasyStrings.calendarsTryAgain) { Task { await model.load() } }
                    }
                } else {
                    HStack(spacing: 8) {
                        ProgressView().controlSize(.small)
                        Text(CasyStrings.loading)
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.mutedForeground.color)
                    }
                    .padding(.horizontal, 16)
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 16)
        }
        .accessibilityIdentifier("calendars.screen")
        .casySheetBar(CasyStrings.calendarsTitle, close: CasyStrings.done, action: closeSheet)
        .task { await model.load() }
        .refreshable { await model.load() }
    }

    /// The guided setup (#221), carrying on the count from the Kalendere
    /// button: the web's 20 point bg-cta circle, 11 point semibold white.
    private var tourRow: some View {
        NavigationLink(value: CalendarsPage.tour) {
            CardRow(
                CasyStrings.tourRow, icon: "list-checks",
                detail: model.toSort > 0 ? CasyStrings.tourRowUnsorted(model.toSort) : CasyStrings.tourRowDetail
            ) {
                if model.toSort > 0 {
                    Text(verbatim: "\(model.toSort)")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 4)
                        .frame(minWidth: 20, minHeight: 20)
                        .background(Theme.cta.color, in: Capsule())
                        .accessibilityHidden(true)
                }
            }
        }
        .buttonStyle(.cardRow)
        .accessibilityIdentifier("calendars.tour")
    }
}

/// Every calendar, grouped by brand, each group folded until opened: the
/// web's CalendarListPanel (`rounded-2xl border bg-card p-4 shadow-sm`), its
/// title (16 semibold) with the (i) beside it, the groups under it split by
/// hairlines (`mt-3 divide-y`). A tick for the whole group, and inside it each
/// calendar's tick, name, category and priority. An unticked calendar waits in
/// "Tæller ikke med" at the bottom until it is ticked again.
private struct CalendarList: View {
    private let model = CalendarsModel.shared
    @State private var open: Set<String> = []
    @State private var uncountedOpen = false
    @State private var helping = false

    var body: some View {
        let calendars = model.calendars
        let groups = groupCalendarsByBrand(calendars)
        let uncounted = groups.flatMap { g in g.calendars.filter { !$0.included }.map { (calendar: $0, brand: g.id) } }
        let primaryId = model.primary?.calendarId
        let listed = groups.filter { $0.calendars.contains(where: \.included) }
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 6) {
                Text(CasyStrings.calendarsListTitle)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Theme.foreground.color)
                    .cssLineHeight(24, size: 16)
                    .accessibilityAddTraits(.isHeader)
                Button {
                    helping = true
                } label: {
                    LucideIcon("info", size: 16)
                        .foregroundStyle(Theme.mutedForeground.color)
                        .frame(width: 20, height: 20)
                        .contentShape(Rectangle().inset(by: -12))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(CasyStrings.calendarsHelpLabel)
                .popover(isPresented: $helping) {
                    // The web's InfoTip: w-72 p-3, 12 point at 1.625, foreground at 80 %.
                    VStack(alignment: .leading, spacing: 8) {
                        Text(CasyStrings.calendarsListIntro)
                        Text(CasyStrings.priorityLevelsHelp)
                    }
                    .font(.system(size: 12))
                    .cssLineHeight(19.5, size: 12)
                    .foregroundStyle(Theme.foreground.color.opacity(0.8))
                    .padding(12)
                    .frame(width: 288)
                    .fixedSize(horizontal: false, vertical: true)
                    .presentationCompactAdaptation(.popover)
                }
            }
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(listed.enumerated()), id: \.element.id) { index, group in
                    let shown = group.calendars.filter(\.included)
                    let accounts = Set(group.calendars.map(\.account))
                    let shared = accounts.count == 1 ? accounts.first ?? nil : nil
                    VStack(alignment: .leading, spacing: 0) {
                        GroupRow(
                            group: group, shown: shown,
                            note: group.id == "builtin" ? CasyStrings.calendarsBuiltInNoAccount : shared,
                            isOpen: open.contains(group.id)
                        ) {
                            withAnimation(.easeOut(duration: 0.2)) {
                                if open.contains(group.id) { open.remove(group.id) } else { open.insert(group.id) }
                            }
                        }
                        if open.contains(group.id) {
                            ForEach(shown, id: \.id) { c in
                                CalendarRow(
                                    calendar: c, calendars: calendars, showAccount: shared == nil,
                                    isPrimary: c.id == primaryId)
                            }
                        }
                    }
                    .modifier(HairlineAbove(shown: index > 0))
                }
            }
            .padding(.top, 12)

            if !uncounted.isEmpty {
                VStack(alignment: .leading, spacing: 0) {
                    Button {
                        withAnimation(.easeOut(duration: 0.2)) { uncountedOpen.toggle() }
                    } label: {
                        HStack(spacing: 8) {
                            Text(CasyStrings.calendarsNotCounted(uncounted.count))
                                .font(.system(size: 14, weight: .medium))
                                .cssLineHeight(20, size: 14)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            Chevron(open: uncountedOpen)
                        }
                        .foregroundStyle(Theme.mutedForeground.color)
                        .padding(.vertical, 8)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("calendars.uncounted")
                    if uncountedOpen {
                        ForEach(uncounted, id: \.calendar.id) { item in
                            let c = item.calendar
                            HStack(alignment: .top, spacing: 12) {
                                TickCircle(color: Color(rgb: model.color(c.id)), tick: .none, dim: true) {
                                    Task { await model.setVisible([c.id], true) }
                                }
                                .accessibilityLabel(CasyStrings.calendarsShow(c.name))
                                VStack(alignment: .leading, spacing: 0) {
                                    Text(c.name)
                                        .font(.system(size: 14))
                                        .foregroundStyle(Theme.mutedForeground.color)
                                        .cssLineHeight(20, size: 14)
                                    Text(
                                        [CasyStrings.calendarsBrand(item.brand), c.account].compactMap { $0 }.joined(
                                            separator: " · ")
                                    )
                                    .font(.system(size: 12))
                                    .foregroundStyle(Theme.mutedForeground.color.opacity(0.8))
                                    .cssLineHeight(16, size: 12)
                                }
                                .lineLimit(1)
                            }
                            .padding(.vertical, 8)
                        }
                    }
                }
                .padding(.top, 4)
                .hairlineAbove()
                .padding(.top, 4)
            }

            if let failure = model.visibilityFailure {
                Notice(failure, tone: .error, bare: true).padding(.top, 8)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .adminCard()
    }
}

/// The web's `divide-y`: a hairline above every group but the first.
private struct HairlineAbove: ViewModifier {
    let shown: Bool

    func body(content: Content) -> some View {
        if shown { content.hairlineAbove() } else { content }
    }
}

/// A brand's header (`py-3 gap-3`): its tick, its name (14 medium) and whose
/// (12 muted), how many and how busy (12 muted), its colours (8 point dots, 2
/// apart) and a chevron that turns over while open.
private struct GroupRow: View {
    let group: CalendarGroup
    let shown: [OverviewCalendar]
    let note: String?
    let isOpen: Bool
    let toggle: () -> Void

    private let model = CalendarsModel.shared

    var body: some View {
        let tick = groupVisibility(group)
        let brand = CasyStrings.calendarsBrand(group.id)
        HStack(spacing: 12) {
            TickCircle(color: Theme.primary.color, tick: tick) {
                // All ticked: untick them all; otherwise tick them all.
                Task { await model.setVisible(group.calendars.map(\.id), tick != .all) }
            }
            .accessibilityLabel(CasyStrings.calendarsShowAll(brand))
            Button(action: toggle) {
                HStack(spacing: 8) {
                    VStack(alignment: .leading, spacing: 0) {
                        (Text(brand).font(.system(size: 14, weight: .medium))
                            + Text(note.map { " · \($0)" } ?? "")
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.mutedForeground.color))
                            .foregroundStyle(Theme.foreground.color)
                            .cssLineHeight(20, size: 14)
                        Text(
                            "\(CasyStrings.calendarsCount(shown.count)) · \(CasyStrings.calendarsTotal(shown.reduce(0) { $0 + $1.total }))"
                        )
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.mutedForeground.color)
                        .cssLineHeight(16, size: 12)
                    }
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    HStack(spacing: 2) {
                        ForEach(shown.prefix(6), id: \.id) { c in
                            Circle().fill(Color(rgb: model.color(c.id))).frame(width: 8, height: 8)
                        }
                    }
                    .accessibilityHidden(true)
                    Chevron(open: isOpen)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("calendars.group.\(group.id)")
            .accessibilityAddTraits(isOpen ? .isSelected : [])
        }
        .padding(.vertical, 12)
    }
}

/// The web's ChevronDown (16, muted), turned over while open.
private struct Chevron: View {
    let open: Bool

    var body: some View {
        LucideIcon("chevron-down", size: 16)
            .foregroundStyle(Theme.mutedForeground.color)
            .rotationEffect(.degrees(open ? 180 : 0))
            .accessibilityHidden(true)
    }
}

/// A tick as Apple Calendar's list draws it (the web's TickCircle): a 22
/// point circle in the calendar's colour, its border 2, filled with a white
/// tick (14, stroke 3) when it counts, empty when it doesn't, a dash for a
/// group partly ticked. 44 points to touch.
struct TickCircle: View {
    let color: Color
    let tick: GroupTick
    var dim = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                Circle()
                    .strokeBorder(color, lineWidth: 2)
                    .background(Circle().fill(tick == .none ? Color.clear : color))
                if tick != .none {
                    LucideIcon(tick == .all ? "check" : "minus", size: 14, stroke: 3)
                        .foregroundStyle(.white)
                }
            }
            .frame(width: 22, height: 22)
            .opacity(dim ? 0.6 : 1)
            .contentShape(Rectangle().inset(by: -11))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(tick == .all ? .isSelected : [])
        .accessibilityValue(tick == .some ? "–" : "")
    }
}

/// A dashed hairline along the top: the web's `border-t border-dashed`.
private struct DashedLineAbove: View {
    var body: some View {
        GeometryReader { proxy in
            Path { path in
                path.move(to: CGPoint(x: 0, y: 0.5))
                path.addLine(to: CGPoint(x: proxy.size.width, y: 0.5))
            }
            .stroke(Theme.border.color, style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
        }
        .frame(height: 1)
    }
}

/// One ticked calendar (the web's CalendarRow, `border-t border-dashed py-2
/// pl-7`, 6 apart): its name (14 medium; renamed with the pencil, the
/// original name kept underneath), its total (12 muted), and under it its
/// category and priority, 38 in, each saved on its own.
private struct CalendarRow: View {
    let calendar: OverviewCalendar
    let calendars: [OverviewCalendar]
    let showAccount: Bool
    let isPrimary: Bool

    private let model = CalendarsModel.shared
    @Environment(\.colorScheme) private var colorScheme
    @State private var busy = false
    @State private var failure: String?
    @State private var renaming = false
    @State private var draft = ""
    @State private var creating = false

    /// Matches the check on calendar_sources.custom_name.
    private static let maxName = 60

    var body: some View {
        let c = calendar
        let rgb = model.color(c.id)
        let original = c.renamed ? c.originalName : nil
        let note = [original.map(CasyStrings.calendarsOriginally), showAccount ? c.account : nil]
            .compactMap { $0 }.joined(separator: " · ")
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top, spacing: 12) {
                TickCircle(color: Color(rgb: rgb), tick: .all) {
                    Task { await model.setVisible([c.id], false) }
                }
                .accessibilityLabel(CasyStrings.calendarsShow(c.name))
                .accessibilityIdentifier("calendars.tick.\(c.id)")
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 4) {
                        Text(c.name)
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(Theme.foreground.color)
                            .cssLineHeight(20, size: 14)
                            .lineLimit(1)
                        if isPrimary {
                            HStack(spacing: 2) {
                                Image(systemName: "star.fill").font(.system(size: 8))
                                Text(CasyStrings.primaryBadge)
                            }
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(Theme.amber800.color)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Theme.amber100.color, in: Capsule())
                        }
                        // The holiday calendar has no stored row to rename.
                        if c.provider != "builtin" {
                            Button {
                                draft = c.name
                                failure = nil
                                renaming = true
                            } label: {
                                LucideIcon("pencil", size: 12)
                                    .foregroundStyle(Theme.mutedForeground.color)
                                    .frame(width: 24, height: 24)
                                    .contentShape(Rectangle().inset(by: -10))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(CasyStrings.calendarsRename(c.name))
                        }
                    }
                    if !note.isEmpty {
                        Text(note)
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.mutedForeground.color)
                            .cssLineHeight(16, size: 12)
                            .lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Text(CasyStrings.calendarsTotal(c.total))
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.mutedForeground.color)
                    .cssLineHeight(16, size: 12)
                    .padding(.top, 2)
            }
            WrapLayout(spacing: 8) {
                if c.provider == "builtin" {
                    // Holidays are always holidays and have no priority: a day
                    // off blocks nothing, so there is nothing to pick.
                    Text(CasyStrings.calendarsHolidayCategory)
                        .font(.system(size: 12))
                        .cssLineHeight(16, size: 12)
                        .foregroundStyle(Color(rgb: CasyCore.shade(rgb, dark: colorScheme == .dark)))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(Color(rgb: rgb).opacity(0.16), in: Capsule())
                } else {
                    CategoryMenu(calendar: c, calendars: calendars, disabled: busy, create: { creating = true }) {
                        save($0)
                    }
                    PriorityMenu(calendar: c, disabled: busy) { save(.priority($0)) }
                }
                if busy {
                    LucideIcon("loader-circle", size: 14)
                        .foregroundStyle(Theme.mutedForeground.color)
                        .frame(height: 28)
                }
            }
            .padding(.leading, 38)
            if let failure {
                Notice(failure, tone: .error, bare: true)
                    .padding(.leading, 38)
            }
        }
        .padding(.vertical, 8)
        .padding(.leading, 28)
        .overlay(alignment: .top) { DashedLineAbove().padding(.leading, 28) }
        .alert(CasyStrings.calendarsRename(c.name), isPresented: $renaming) {
            TextField(c.name, text: $draft)
            Button(CasyStrings.save) {
                let name = String(draft.trimmingCharacters(in: .whitespacesAndNewlines).prefix(Self.maxName))
                save(.name(name.isEmpty ? nil : name))
            }
            if let original {
                Button(CasyStrings.calendarsUseOriginalName(original)) { save(.name(nil)) }
            }
            Button(CasyStrings.cancel, role: .cancel) {}
        }
        .sheet(isPresented: $creating) {
            NewCategorySheet { category in
                creating = false
                save(.purpose(category.purpose, categoryName: category.name))
            }
            .nativeSheetLook(NativePreferences.shared)
        }
    }

    private func save(_ change: CalendarChange) {
        busy = true
        failure = nil
        Task {
            defer { busy = false }
            do {
                try await model.update(calendar.id, change)
            } catch {
                failure = error.localizedDescription
            }
        }
    }
}

/// A calendar's small choice (the web's PickerButton: `h-7 rounded-full
/// bg-secondary px-2.5`, 12 medium, a 12 point chevron, 4 apart), opening its
/// choices as the system's menu, growing out of it.
private struct PickerCapsule: View {
    let text: String
    var guessed = false

    var body: some View {
        HStack(spacing: 4) {
            if guessed {
                LucideIcon("sparkles", size: 12).foregroundStyle(Theme.amber500.color)
            }
            Text(text).lineLimit(1)
            LucideIcon("chevron-down", size: 12)
                .foregroundStyle(Theme.mutedForeground.color)
        }
        .font(.system(size: 12, weight: .medium))
        .foregroundStyle(Theme.foreground.color)
        .padding(.horizontal, 10)
        .frame(height: 28)
        .background(Theme.secondary.color, in: Capsule())
        .contentShape(Capsule())
    }
}

/// The four categories and the person's own (#220), with Ny kategori under them.
private struct CategoryMenu: View {
    let calendar: OverviewCalendar
    let calendars: [OverviewCalendar]
    let disabled: Bool
    let create: () -> Void
    let pick: (CalendarChange) -> Void

    var body: some View {
        let c = calendar
        let chosen = c.categoryName.map { "own:\($0)" } ?? c.purpose.map { "kind:\($0)" } ?? ""
        let own = ownCategories(calendars)
        let label =
            c.purposeGuessed == true
            ? "\(CasyStrings.calendarsCategoryFor(c.name)), \(CasyStrings.guessed)"
            : CasyStrings.calendarsCategoryFor(c.name)
        Menu {
            Picker(
                CasyStrings.calendarsCategoryFor(c.name),
                selection: Binding(
                    get: { chosen },
                    set: { value in
                        if value.hasPrefix("own:"), let mine = own.first(where: { "own:\($0.name)" == value }) {
                            pick(.purpose(mine.purpose, categoryName: mine.name))
                        } else {
                            pick(.purpose(value.isEmpty ? nil : String(value.dropFirst(5))))
                        }
                    })
            ) {
                Text(CasyStrings.calendarsNoCategory).tag("")
                ForEach(calendarCategories, id: \.self) { Text(CasyStrings.category($0)).tag("kind:\($0)") }
                ForEach(own, id: \.name) { Text($0.name).tag("own:\($0.name)") }
            }
            .pickerStyle(.inline)
            Button(CasyStrings.calendarsNewCategory, systemImage: "plus", action: create)
        } label: {
            PickerCapsule(
                text: categoryLabel(
                    purpose: c.purpose, categoryName: c.categoryName, categories: CasyStrings.category,
                    none: CasyStrings.calendarsNoCategory),
                guessed: c.purposeGuessed == true)
        }
        .disabled(disabled)
        .accessibilityLabel(label)
        .accessibilityValue(
            categoryLabel(
                purpose: c.purpose, categoryName: c.categoryName, categories: CasyStrings.category,
                none: CasyStrings.calendarsNoCategory))
        .accessibilityIdentifier("calendars.category.\(c.id)")
    }
}

/// How much a calendar matters, by the names the tour gives them (#221).
private struct PriorityMenu: View {
    let calendar: OverviewCalendar
    let disabled: Bool
    let pick: (String) -> Void

    var body: some View {
        Menu {
            Picker(
                CasyStrings.calendarsPriorityFor(calendar.name),
                selection: Binding(get: { calendar.priority }, set: pick)
            ) {
                ForEach(["skip", "normal", "never"], id: \.self) { Text(CasyStrings.priorityLevel($0)).tag($0) }
            }
            .pickerStyle(.inline)
        } label: {
            PickerCapsule(text: CasyStrings.priorityLevel(calendar.priority))
        }
        .disabled(disabled)
        .accessibilityLabel(CasyStrings.calendarsPriorityFor(calendar.name))
        .accessibilityValue(CasyStrings.priorityLevel(calendar.priority))
        .accessibilityIdentifier("calendars.priority.\(calendar.id)")
    }
}

/// A category of the person's own (#220): a name, and whether a trip may lie
/// on top of it (the kind scheduling reads), shown only to its owner. The
/// web's NewCategorySheet (#281): the name field, then the question as a
/// list 16 under it with the two answers ticked, Gem kategori along the
/// bottom; as tall as that, in iOS's glass.
struct NewCategorySheet: View {
    let save: (OwnCategory) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var soft = false
    @State private var contentHeight: CGFloat = 220

    /// Matches the check on calendar_sources.category_name.
    private static let maxName = 30

    private var trimmed: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    CasyField(
                        CasyStrings.calendarsNewCategoryName, text: $name,
                        placeholder: CasyStrings.calendarsNewCategoryPlaceholder, autofocus: true)
                        .onChange(of: name) { _, typed in
                            if typed.count > Self.maxName { name = String(typed.prefix(Self.maxName)) }
                        }
                    CardList(CasyStrings.calendarsNewCategoryAsk, spaced: false) {
                        PickRow(CasyStrings.calendarsNewCategoryYes, picked: soft) { soft = true }
                        PickRow(CasyStrings.calendarsNewCategoryNo, picked: !soft) { soft = false }
                    }
                    .padding(.top, 16)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { contentHeight = $0 }
            }
            .scrollBounceBehavior(.basedOnSize)
            .accessibilityIdentifier("category.screen")
            .casySheetBar(CasyStrings.calendarsNewCategory, close: CasyStrings.cancel) { dismiss() }
            .safeAreaInset(edge: .bottom) {
                FlowButton(action: {
                    guard !trimmed.isEmpty else { return }
                    save(OwnCategory(name: trimmed, purpose: soft ? "work" : "personal"))
                }) {
                    Text(CasyStrings.calendarsNewCategorySave)
                }
                .disabled(trimmed.isEmpty)
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
            }
        }
        .sheetFits(contentHeight)
    }
}
