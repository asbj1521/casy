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

/// Kalendere (#219, #200), as the web's CalendarsSheet: the guided setup
/// first while calendars wait for it, Forbundne kalendere, then every
/// calendar by brand, with what counts, its category and how much it matters.
struct CalendarsScreen: View {
    private let model = CalendarsModel.shared
    @Environment(\.closeSheet) private var closeSheet

    var body: some View {
        List {
            Section {
                if model.toSort > 0 { tourRow }
                NavigationLink(value: CalendarsPage.accounts) {
                    ListRow(
                        CasyStrings.accountsRow, systemImage: "calendar.badge.plus",
                        detail: CasyStrings.accountsRowDetail, value: model.connectedCount.map(String.init))
                }
                .accessibilityIdentifier("calendars.accounts")
                // Where Casy writes, on the first screen, so it isn't only at
                // the bottom of Forbundne kalendere.
                if let connections = model.connections,
                    !calendarChoices(connections, primaryId: model.primary?.calendarId).isEmpty
                {
                    NavigationLink(value: CalendarsPage.primary) {
                        ListRow(
                            CasyStrings.primaryTitle, systemImage: "star",
                            detail: CasyStrings.primaryIntro,
                            value: primaryName(connections, model.primary?.calendarId) ?? CasyStrings.primaryChoose)
                    }
                    .accessibilityIdentifier("calendars.primary")
                }
                if model.toSort == 0 && model.data != nil { tourRow }
            }
            if model.data != nil {
                CalendarList()
            } else if let failure = model.failure {
                Section {
                    Notice(failure, tone: .error, bare: true)
                    Button(CasyStrings.calendarsTryAgain) { Task { await model.load() } }
                }
            } else {
                HStack(spacing: 8) {
                    ProgressView().controlSize(.small)
                    Text(CasyStrings.loading)
                        .font(.subheadline)
                        .foregroundStyle(Theme.mutedForeground.color)
                }
            }
        }
        .casySheetBar(CasyStrings.calendarsTitle, close: CasyStrings.done, action: closeSheet)
        .task { await model.load() }
        .refreshable { await model.load() }
    }

    /// The guided setup (#221), carrying on the count from the Kalendere button.
    private var tourRow: some View {
        NavigationLink(value: CalendarsPage.tour) {
            HStack {
                ListRow(
                    CasyStrings.tourRow, systemImage: "checklist",
                    detail: model.toSort > 0 ? CasyStrings.tourRowUnsorted(model.toSort) : CasyStrings.tourRowDetail)
                if model.toSort > 0 {
                    Text("\(model.toSort)")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 6)
                        .frame(minWidth: 20, minHeight: 20)
                        .background(Theme.cta.color, in: Capsule())
                        .accessibilityHidden(true)
                }
            }
        }
        .accessibilityIdentifier("calendars.tour")
    }
}

/// Every calendar, grouped by brand, each group folded until opened (the web's
/// CalendarListPanel): a tick for the whole group, and inside it each
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
        Section {
            ForEach(groups) { group in
                let shown = group.calendars.filter(\.included)
                if !shown.isEmpty {
                    let accounts = Set(group.calendars.map(\.account))
                    let shared = accounts.count == 1 ? accounts.first ?? nil : nil
                    GroupRow(
                        group: group, shown: shown,
                        note: group.id == "builtin" ? CasyStrings.calendarsBuiltInNoAccount : shared,
                        isOpen: open.contains(group.id)
                    ) {
                        if open.contains(group.id) { open.remove(group.id) } else { open.insert(group.id) }
                    }
                    if open.contains(group.id) {
                        ForEach(shown, id: \.id) { c in
                            CalendarRow(
                                calendar: c, calendars: calendars, showAccount: shared == nil,
                                isPrimary: c.id == primaryId)
                        }
                    }
                }
            }
        } header: {
            HStack(spacing: 4) {
                Text(CasyStrings.calendarsListTitle)
                Button {
                    helping = true
                } label: {
                    Image(systemName: "info.circle")
                }
                .accessibilityLabel(CasyStrings.calendarsHelpLabel)
                .popover(isPresented: $helping) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(CasyStrings.calendarsListIntro)
                        Text(CasyStrings.priorityLevelsHelp)
                    }
                    .font(.footnote)
                    .foregroundStyle(Theme.foreground.color)
                    .padding()
                    .frame(idealWidth: 320)
                    .fixedSize(horizontal: false, vertical: true)
                    .presentationCompactAdaptation(.popover)
                }
            }
        } footer: {
            if let failure = model.visibilityFailure { Notice(failure, tone: .error, bare: true) }
        }

        if !uncounted.isEmpty {
            Section {
                Button {
                    uncountedOpen.toggle()
                } label: {
                    HStack {
                        Text(CasyStrings.calendarsNotCounted(uncounted.count))
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(Theme.mutedForeground.color)
                        Spacer()
                        Chevron(open: uncountedOpen)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("calendars.uncounted")
                if uncountedOpen {
                    ForEach(uncounted, id: \.calendar.id) { item in
                        let c = item.calendar
                        HStack(spacing: 12) {
                            TickCircle(color: Color(rgb: model.color(c.id)), tick: .none, dim: true) {
                                Task { await model.setVisible([c.id], true) }
                            }
                            .accessibilityLabel(CasyStrings.calendarsShow(c.name))
                            VStack(alignment: .leading, spacing: 2) {
                                Text(c.name)
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.mutedForeground.color)
                                Text([CasyStrings.calendarsBrand(item.brand), c.account].compactMap { $0 }.joined(separator: " · "))
                                    .font(.footnote)
                                    .foregroundStyle(Theme.mutedForeground.color.opacity(0.8))
                            }
                            .lineLimit(1)
                        }
                    }
                }
            }
        }
    }
}

/// A brand's header: its tick, its name, how many and how busy, its colours.
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
                    VStack(alignment: .leading, spacing: 2) {
                        (Text(brand).fontWeight(.medium)
                            + Text(note.map { " · \($0)" } ?? "")
                            .font(.footnote)
                            .foregroundStyle(Theme.mutedForeground.color))
                            .font(.subheadline)
                            .foregroundStyle(Theme.foreground.color)
                        Text(
                            "\(CasyStrings.calendarsCount(shown.count)) · \(CasyStrings.calendarsTotal(shown.reduce(0) { $0 + $1.total }))"
                        )
                        .font(.footnote)
                        .foregroundStyle(Theme.mutedForeground.color)
                    }
                    .lineLimit(1)
                    Spacer(minLength: 4)
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
    }
}

private struct Chevron: View {
    let open: Bool

    var body: some View {
        Image(systemName: "chevron.down")
            .font(.caption.weight(.semibold))
            .foregroundStyle(Theme.mutedForeground.color)
            .rotationEffect(.degrees(open ? 180 : 0))
            .accessibilityHidden(true)
    }
}

/// A tick as Apple Calendar's list draws it: a circle in the calendar's
/// colour, filled with a white tick when it counts, empty when it doesn't, a
/// dash for a group partly ticked. 44 points to touch.
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
                    Image(systemName: tick == .all ? "checkmark" : "minus")
                        .font(.system(size: 11, weight: .heavy))
                        .foregroundStyle(.white)
                }
            }
            .frame(width: 22, height: 22)
            .opacity(dim ? 0.6 : 1)
            .frame(width: 30, height: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(tick == .all ? .isSelected : [])
        .accessibilityValue(tick == .some ? "–" : "")
    }
}

/// One ticked calendar: its name (renamed with the pencil, the original name
/// kept underneath), its category and priority, each saved on its own.
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
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 4) {
                        Text(c.name)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(Theme.foreground.color)
                            .lineLimit(1)
                        if isPrimary {
                            Label(CasyStrings.primaryBadge, systemImage: "star.fill")
                                .labelStyle(.titleAndIcon)
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
                                Image(systemName: "pencil")
                                    .font(.caption)
                                    .foregroundStyle(Theme.mutedForeground.color)
                                    .frame(width: 32, height: 32)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(CasyStrings.calendarsRename(c.name))
                        }
                    }
                    if !note.isEmpty {
                        Text(note)
                            .font(.footnote)
                            .foregroundStyle(Theme.mutedForeground.color)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 4)
                Text(CasyStrings.calendarsTotal(c.total))
                    .font(.footnote)
                    .foregroundStyle(Theme.mutedForeground.color)
                    .padding(.top, 12)
            }
            HStack(spacing: 8) {
                if c.provider == "builtin" {
                    // Holidays are always holidays and have no priority: a day
                    // off blocks nothing, so there is nothing to pick.
                    Text(CasyStrings.calendarsHolidayCategory)
                        .font(.caption)
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
                if busy { ProgressView().controlSize(.mini) }
            }
            .padding(.leading, 42)
            if let failure {
                Notice(failure, tone: .error, bare: true)
                    .padding(.leading, 42)
            }
        }
        .padding(.leading, 16)
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

/// A calendar's small choice (category, priority): a capsule opening its
/// choices as the system's menu, growing out of it.
private struct PickerCapsule: View {
    let text: String
    var guessed = false

    var body: some View {
        HStack(spacing: 4) {
            if guessed {
                Image(systemName: "sparkles")
                    .font(.caption2)
                    .foregroundStyle(Theme.amber700.color)
            }
            Text(text).lineLimit(1)
            Image(systemName: "chevron.down")
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(Theme.mutedForeground.color)
        }
        .font(.caption.weight(.medium))
        .foregroundStyle(Theme.foreground.color)
        .padding(.horizontal, 10)
        .frame(minHeight: 28)
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
/// on top of it (the kind scheduling reads), shown only to its owner.
struct NewCategorySheet: View {
    let save: (OwnCategory) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var soft = false

    /// Matches the check on calendar_sources.category_name.
    private static let maxName = 30

    private var trimmed: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    CasyField(
                        CasyStrings.calendarsNewCategoryName, text: $name,
                        placeholder: CasyStrings.calendarsNewCategoryPlaceholder)
                        .onChange(of: name) { _, typed in
                            if typed.count > Self.maxName { name = String(typed.prefix(Self.maxName)) }
                        }
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets())
                }
                Section(CasyStrings.calendarsNewCategoryAsk) {
                    ListPickRow(CasyStrings.calendarsNewCategoryYes, isSelected: soft) { soft = true }
                    ListPickRow(CasyStrings.calendarsNewCategoryNo, isSelected: !soft) { soft = false }
                }
            }
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
        .presentationDetents([.medium, .large])
    }
}
