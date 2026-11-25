import CasyAPI
import CasyCore
import CasyUI
import SwiftUI

/// Your genveje (#175, #282): read as Planlæg opens Genveje, saved at once on
/// screen while the server catches up, as the web's PlanFromCalendar does.
@MainActor @Observable
final class ShortcutsModel {
    static let shared = ShortcutsModel()

    private(set) var list: [Shortcut]?
    private(set) var failure: String?
    /// The one on its way to the server (its id, or "saving" for a new one).
    private(set) var savingId: String?
    /// One that didn't make it: a tap tries again.
    private(set) var failed: (name: String, retry: () -> Void)?

    /// Read as Planlæg opens, so Genveje is there with its pictures when it is pressed.
    func loadAhead() {
        if list == nil { Task { await load() } }
    }

    func load() async {
        guard let api = await Native.api() else { return }
        do {
            list = try await api.shortcuts(errorMessage: CasyStrings.shortcutsLoadFailed)
            failure = nil
            PictureMemory.fetch(list?.compactMap { $0.pictureUrl.flatMap(URL.init(string:)) } ?? [])
        } catch {
            failure = error.localizedDescription
        }
    }

    /// Saved at once on screen; if the server says no, the list is as it was and the square says so.
    func save(id: String?, name: String, plan: ShortcutPlan, picture: String?, shownPicture: String?) {
        let before = list
        let shown = Shortcut(id: id ?? "saving", name: name, plan: plan, pictureUrl: shownPicture)
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            if let id { list = list?.map { $0.id == id ? shown : $0 } } else { list = (list ?? []) + [shown] }
        }
        savingId = shown.id
        failed = nil
        Task {
            defer { savingId = nil }
            do {
                guard let api = await Native.api() else {
                    throw APIError.failed(status: 401, message: CasyStrings.shortcutsSaveFailed)
                }
                list = try await api.saveShortcut(
                    id: id, name: name, plan: plan, picture: picture, errorMessage: CasyStrings.shortcutsSaveFailed
                ).shortcuts
            } catch {
                list = before
                failed = (
                    name,
                    { [weak self] in
                        self?.save(id: id, name: name, plan: plan, picture: picture, shownPicture: shownPicture)
                    }
                )
            }
        }
    }

    func dismissFailed() { failed = nil }

    func delete(_ id: String) async throws {
        guard let api = await Native.api() else {
            throw APIError.failed(status: 401, message: CasyStrings.shortcutsDeleteFailed)
        }
        list = try await api.deleteShortcut(id, errorMessage: CasyStrings.shortcutsDeleteFailed)
    }
}

/// Where Planlæg's sheet goes beside the plan (#175).
enum PlanPage: Hashable {
    case shortcuts
    /// A genvej's editor: one to change (its id), or a new one (nil).
    case editor(String?)
}

/// Genveje, the Planlæg sheet's screen to its side (the web's ShortcutsScreen):
/// a square for each saved plan, three across, "..." on each to change it, plus
/// squares to make one. A tap doesn't run it: its square grows to the top with
/// its times beside it, and the group, Hvornår and how many under it; Find
/// dato runs it. A tap on the big square puts it back.
struct ShortcutsScreen: View {
    let onFind: () -> Void
    @Binding var path: [PlanPage]

    private let model = ShortcutsModel.shared
    private let plan = PlanModel.shared
    @Environment(\.closeSheet) private var closeSheet
    @Namespace private var squares
    @State private var selected: Shortcut?
    /// The plan as it was before a genvej was looked at: back if it isn't run.
    @State private var before: PlanModel.Snapshot?
    /// When it searches, for this run only: Snarest unless months are picked.
    @State private var runPeriod: Period?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if let failure = model.failure {
                    Notice(failure, tone: .error, bare: true).padding(.bottom, 12)
                }
                if let selected {
                    chosen(selected)
                } else {
                    grid
                    if model.list?.isEmpty == true && model.failed == nil {
                        Text(CasyStrings.shortcutsEmptyNote)
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.mutedForeground.color)
                            .padding(.horizontal, 4)
                            .padding(.top, 12)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 16)
        }
        .accessibilityIdentifier("shortcuts.screen")
        .casyPushedBar(CasyStrings.shortcutsTitle, close: CasyStrings.cancel, action: closeSheet)
        .safeAreaInset(edge: .bottom) {
            if selected != nil {
                FlowButton(action: run) { Text(CasyStrings.planFindDate) }
                    .disabled(plan.activeGroup == nil)
                    .accessibilityIdentifier("shortcuts.find")
                    .padding(.horizontal, 16)
                    .padding(.bottom, 8)
            }
        }
        .task { await model.load() }
        .onDisappear {
            // Looked at but not run: the plan as it was.
            if let before, selected != nil { plan.restore(before) }
        }
    }

    // MARK: The squares

    /// One square of the grid.
    private enum Cell: Hashable {
        case held(Int), shortcut(String), failed, add(Int)
    }

    private var cells: [Cell] {
        guard let list = model.list else { return (0..<3).map { .held($0) } }
        let n = list.count + (model.failed == nil ? 0 : 1)
        let adds = n >= maxShortcuts ? 0 : n < 3 ? 3 - n : 1
        return list.map { .shortcut($0.id) } + (model.failed == nil ? [] : [.failed]) + (0..<adds).map { .add($0) }
    }

    /// Three across, each as tall as it is wide.
    private var grid: some View {
        let all = cells
        let rows = stride(from: 0, to: all.count, by: 3).map { Array(all[$0..<min($0 + 3, all.count)]) }
        return VStack(spacing: 12) {
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                HStack(spacing: 12) {
                    ForEach(row, id: \.self) { cell in
                        self.cell(cell).frame(maxWidth: .infinity)
                    }
                    ForEach(0..<(3 - row.count), id: \.self) { _ in Color.clear.frame(maxWidth: .infinity) }
                }
            }
        }
    }

    @ViewBuilder private func cell(_ cell: Cell) -> some View {
        switch cell {
        case .held:
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Theme.secondary.color)
                .squareCell()
        case .shortcut(let id):
            if let s = model.list?.first(where: { $0.id == id }) { square(s) }
        case .failed:
            if let failed = model.failed { failedSquare(failed.name, retry: failed.retry) }
        case .add:
            Button { path.append(.editor(nil)) } label: {
                LucideIcon("plus", size: 28)
                    .foregroundStyle(Theme.primary.color)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .overlay {
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .strokeBorder(Theme.border.color, style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                    }
                    .contentShape(Rectangle())
                    .squareCell()
            }
            .buttonStyle(.plain)
            .accessibilityLabel(CasyStrings.shortcutsAdd)
            .accessibilityIdentifier("shortcuts.add")
        }
    }

    private func square(_ s: Shortcut) -> some View {
        ZStack(alignment: .topTrailing) {
            Button { select(s) } label: {
                ShortcutFace(shortcut: s, size: 17)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .squareCell()
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(CasyStrings.shortcutsRun(s.name))
            .accessibilityIdentifier("shortcut.\(s.name)")
            if s.id != model.savingId {
                Button { path.append(.editor(s.id)) } label: {
                    LucideIcon("ellipsis", size: 20)
                        .foregroundStyle(s.pictureUrl == nil ? Theme.mutedForeground.color : .white)
                        .frame(width: 36, height: 36)
                        .background(s.pictureUrl == nil ? Color.clear : Color.black.opacity(0.3), in: Circle())
                        .padding(4)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(CasyStrings.shortcutsEdit(s.name))
            }
        }
        .background(Theme.card.color, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay { RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.border.color, lineWidth: 1) }
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .matchedGeometryEffect(id: s.id, in: squares)
    }

    private func failedSquare(_ name: String, retry: @escaping () -> Void) -> some View {
        ZStack(alignment: .topTrailing) {
            Button(action: retry) {
                VStack(spacing: 4) {
                    Text(name)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(Theme.foreground.color)
                        .multilineTextAlignment(.center)
                        .lineLimit(3)
                    Text(CasyStrings.shortcutsNotSaved)
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.red700.color)
                        .multilineTextAlignment(.center)
                }
                .padding(12)
                .padding(.top, 16)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .squareCell()
            }
            .buttonStyle(.plain)
            Button { model.dismissFailed() } label: {
                LucideIcon("x", size: 16).foregroundStyle(Theme.red700.color).frame(width: 36, height: 36)
            }
            .buttonStyle(.plain)
        }
        .background(Theme.red50.color, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay { RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.red600.color.opacity(0.4), lineWidth: 1) }
    }

    // MARK: The one about to run

    private func chosen(_ s: Shortcut) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .bottom, spacing: 16) {
                Button { deselect() } label: {
                    ShortcutFace(shortcut: s, size: 24)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .squareCell()
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .background(Theme.card.color, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.border.color, lineWidth: 1)
                }
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .matchedGeometryEffect(id: s.id, in: squares)
                .accessibilityLabel(CasyStrings.shortcutsBack(s.name))
                ShortcutFacts(shortcut: s)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .transition(.opacity.combined(with: .offset(x: 12)))
            }
            VStack(alignment: .leading, spacing: 0) {
                PlanGroupRow(shortcuts: nil)
                WhenRow(value: $runPeriod)
                PlanHowMany(top: 12)
            }
            .transition(.opacity)
        }
    }

    private func select(_ s: Shortcut) {
        before = plan.snapshot
        plan.load(s)
        withAnimation(.spring(response: 0.38, dampingFraction: 0.82)) { selected = s }
    }

    private func deselect() {
        if let before { plan.restore(before) }
        before = nil
        runPeriod = nil
        withAnimation(.spring(response: 0.38, dampingFraction: 0.82)) { selected = nil }
    }

    /// Run with the group chosen in Planlæg (a genvej has none of its own), from today or the months picked.
    private func run() {
        guard selected != nil else { return }
        if let runPeriod { plan.update { $0.period = runPeriod } }
        before = nil
        selected = nil
        onFind()
    }
}

/// A square's face: the name in the middle, or the picture filling it with the name at its foot.
struct ShortcutFace: View {
    let shortcut: Shortcut
    let size: CGFloat

    var body: some View {
        if let url = shortcut.pictureUrl.flatMap(URL.init(string:)) {
            ZStack(alignment: .bottom) {
                // Kept between visits (PictureMemory): AsyncImage fetched it again each
                // time, a dark square flashing first.
                RemoteImage(url: url) { Theme.secondary.color }
                    .scaledToFill()
                LinearGradient(colors: [.clear, .black.opacity(0.65)], startPoint: .top, endPoint: .bottom)
                    .frame(height: 64)
                Text(shortcut.name)
                    .font(.system(size: size, weight: .semibold))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .padding(.horizontal, 8)
                    .padding(.bottom, 8)
            }
        } else {
            Text(shortcut.name)
                .font(.system(size: size, weight: .semibold))
                .foregroundStyle(Theme.foreground.color)
                .multilineTextAlignment(.center)
                .lineLimit(3)
                .minimumScaleFactor(0.8)
                .padding(12)
        }
    }
}

/// What a genvej looks at: each time start to end, its days; a trip's length.
private struct ShortcutFacts: View {
    let shortcut: Shortcut

    var body: some View {
        let settings = shortcut.plan.settings
        VStack(alignment: .leading, spacing: 12) {
            if settings.multiDay {
                fact(CasyStrings.planTripDays, CasyStrings.days(settings.days))
            } else {
                ForEach(Array(shortcut.plan.times.enumerated()), id: \.offset) { i, time in
                    fact(CasyStrings.shortcutsTime(i + 1), shortcutTimeLabel(time, allDay: CasyStrings.shortcutsAnyTime))
                }
                Text(daysLabel(settings.dows))
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.mutedForeground.color)
            }
        }
        .padding(.bottom, 4)
    }

    private func fact(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(label).font(.system(size: 13)).foregroundStyle(Theme.mutedForeground.color)
            Text(value).font(.system(size: 17, weight: .semibold)).foregroundStyle(Theme.foreground.color)
        }
    }
}

/// The weekdays as a row's value: "Alle dage", "Hverdage", or the days ("Man, Ons").
func daysLabel(_ dows: [Int]) -> String {
    switch describeDays(dows) {
    case .list(let days):
        return days.map { CasyStrings.planWeekdayShort($0) }.joined(separator: ", ")
    case .all: return capitalize(CasyStrings.planDayList("all"))
    case .weekdays: return capitalize(CasyStrings.planDayList("weekdays"))
    case .weekends: return capitalize(CasyStrings.planDayList("weekends"))
    }
}

/// "Hvornår" under a genvej about to run (#259): Snarest unless months are
/// picked, in Planlæg's own months grown out of the row.
private struct WhenRow: View {
    @Binding var value: Period?
    @State private var open = false

    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    var body: some View {
        Button { open = true } label: {
            CardList(spaced: false) {
                CardRow(CasyStrings.planWhenLabel, icon: "calendar-range", value: label, chevron: true)
            }
        }
        .buttonStyle(.cardRow)
        .padding(.top, 12)
        .accessibilityIdentifier("shortcuts.when")
        .popover(isPresented: $open, attachmentAnchor: .rect(.bounds), arrowEdge: .top) {
            PlanMonths(value: $value)
                .padding(8)
                .frame(width: 340)
                .presentationCompactAdaptation(.popover)
        }
    }

    private var label: String {
        guard let value else { return CasyStrings.planWhenSoonest }
        let ms = parseInstant(value.from) ?? 0
        if value.from == value.to && value.days != true { return capitalize(monthName(ms, lang)) }
        let words = PeriodWords(any: "", one: { $0 }, range: { "\($0) - \($1)" }, day: { $0 }, until: { $0 })
        return capitalize(periodText(value, lang, words, now: Native.now))
    }
}

// MARK: - A genvej's editor

/// A genvej made or changed (the web's PlanSetup `editor`): its name, its
/// times (meetings), the plan's own time rows, its picture, and Slet genvej
/// last, asked first. The plan on screen is what a new genvej starts from.
struct ShortcutEditor: View {
    let id: String?
    @Binding var path: [PlanPage]

    private let model = ShortcutsModel.shared
    @Bindable private var plan = PlanModel.shared
    @Environment(\.closeSheet) private var closeSheet
    @State private var times: [ShortcutTime] = []
    @State private var current = 0
    /// A picture just picked (base64), "" to take it off, nil to keep the one it has.
    @State private var picture: String?
    @State private var pictureFailure: String?
    @State private var removing = false
    @State private var started = false

    private var editing: Shortcut? { id.flatMap { id in model.list?.first { $0.id == id } } }
    private var named: Bool { !plan.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    /// The times as they stand: the one picked is the plan's own on screen.
    private var liveTimes: [ShortcutTime] {
        times.enumerated().map { i, time in i == current ? timeOf(plan.settings) : time }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CasyField(
                    CasyStrings.shortcutsNameLabel,
                    text: Binding(get: { plan.name }, set: { plan.name = String($0.prefix(maxShortcutName)) }),
                    placeholder: CasyStrings.shortcutsNamePlaceholder)
                .accessibilityIdentifier("editor.name")
                if !plan.settings.multiDay {
                    timesRow.padding(.top, 16)
                }
                PlanTimeRows()
                if !named {
                    Text(CasyStrings.shortcutsNameFirst)
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.mutedForeground.color)
                        .padding(.horizontal, 4)
                        .padding(.top, 12)
                }
                pictureRows
                if let editing {
                    CardList {
                        Button { removing = true } label: {
                            CardRow(CasyStrings.shortcutsRemove, icon: "trash", tone: .danger)
                        }
                        .buttonStyle(.cardRow)
                        .accessibilityIdentifier("editor.remove")
                    }
                    .askFirst(
                        isPresented: $removing, presenting: editing,
                        words: { AskWords(message: CasyStrings.shortcutsRemoveAsk($0.name), confirm: CasyStrings.shortcutsRemove) }
                    ) { s in
                        try await model.delete(s.id)
                        path.removeLast()
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 16)
        }
        .accessibilityIdentifier("editor.screen")
        .casyPushedBar(editing?.name ?? CasyStrings.shortcutsAdd, close: CasyStrings.cancel, action: closeSheet)
        .safeAreaInset(edge: .bottom) {
            FlowButton(action: save) { Text(CasyStrings.shortcutsSave) }
                .disabled(!named)
                .accessibilityIdentifier("editor.save")
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
        }
        .onAppear {
            guard !started else { return }
            started = true
            if let editing { plan.load(editing) } else if id != nil { return }
            times = editing?.plan.times ?? [timeOf(plan.settings)]
            current = 0
        }
    }

    // MARK: Times

    private var timesRow: some View {
        HStack(spacing: 8) {
            ForEach(Array(liveTimes.enumerated()), id: \.offset) { i, time in
                let on = i == current
                ZStack(alignment: .topTrailing) {
                    Button { show(liveTimes, i) } label: {
                        VStack(spacing: 0) {
                            Text(CasyStrings.shortcutsTime(i + 1))
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(on ? Theme.primary.color : Theme.mutedForeground.color)
                            Text(shortcutTimeLabel(time, allDay: CasyStrings.shortcutsAnyTime))
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(on ? Theme.primary.color : Theme.foreground.color)
                                .lineLimit(1)
                                .minimumScaleFactor(0.8)
                        }
                        .frame(maxWidth: .infinity, minHeight: 56)
                        .background(Theme.card.color, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .strokeBorder(on ? Theme.primary.color : Theme.border.color, lineWidth: 1)
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(on ? .isSelected : [])
                    if on && i > 0 {
                        Button {
                            var all = liveTimes
                            all.remove(at: i)
                            show(all, i - 1)
                        } label: {
                            LucideIcon("x", size: 16)
                                .foregroundStyle(Theme.mutedForeground.color)
                                .frame(width: 24, height: 24)
                                .padding(4)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(CasyStrings.shortcutsRemoveTime(i + 1))
                    }
                }
            }
            if liveTimes.count < maxShortcutTimes {
                Button { show(liveTimes + [timeOf(plan.settings)], liveTimes.count) } label: {
                    LucideIcon("plus", size: 20)
                        .foregroundStyle(Theme.primary.color)
                        .frame(width: 48, height: 56)
                        .background(Theme.card.color, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.border.color, lineWidth: 1)
                        }
                }
                .buttonStyle(.plain)
                .accessibilityLabel(CasyStrings.shortcutsAddTime)
                .accessibilityIdentifier("editor.addTime")
            }
        }
    }

    private func show(_ all: [ShortcutTime], _ index: Int) {
        times = all
        current = index
        plan.showTime(all[index])
    }

    // MARK: Picture

    @ViewBuilder private var pictureRows: some View {
        let has = picture.map { !$0.isEmpty } ?? (editing?.pictureUrl != nil)
        CardList {
            PictureMenu(
                hasPicture: has, addLabel: CasyStrings.shortcutsPictureAdd, changeLabel: CasyStrings.shortcutsPicture,
                onPicked: { picture = $0 }, onRemove: { picture = "" },
                onUnreadable: { pictureFailure = CasyStrings.picturesUnreadable }
            ) {
                CardRow(CasyStrings.shortcutsPicture, icon: "image") {
                    if let shown = pictureShown {
                        shown.resizable().scaledToFill().frame(width: 32, height: 32)
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    } else if let url = editing?.pictureUrl.flatMap(URL.init(string:)), picture == nil {
                        RemoteImage(url: url) { Theme.secondary.color }.scaledToFill()
                            .frame(width: 32, height: 32)
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    } else {
                        Text(CasyStrings.shortcutsPictureAdd)
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.primary.color)
                    }
                }
            }
        }
        if let pictureFailure {
            Text(pictureFailure).font(.system(size: 13)).foregroundStyle(Theme.red600.color).padding(.top, 8)
        }
    }

    private var pictureShown: Image? {
        guard let picture, !picture.isEmpty, let data = Data(base64Encoded: picture), let image = UIImage(data: data)
        else { return nil }
        return Image(uiImage: image)
    }

    /// Saved at once on screen; back to Genveje.
    private func save() {
        let name = String(plan.name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(maxShortcutName))
        let saved = shortcutPlan(plan.settings, plan.extras, times: plan.settings.multiDay ? [timeOf(plan.settings)] : liveTimes)
        let shown = picture.map { $0.isEmpty ? nil : "data:image/jpeg;base64,\($0)" } ?? editing?.pictureUrl
        model.save(id: editing?.id, name: name, plan: saved, picture: picture, shownPicture: shown)
        path.removeLast()
    }
}

extension View {
    /// As tall as it is wide, whatever is in it.
    fileprivate func squareCell() -> some View {
        Color.clear.aspectRatio(1, contentMode: .fit).overlay { self }
    }
}
