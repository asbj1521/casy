import CasyAPI
import CasyCore
import CasyUI
import SwiftUI

/// Planlæg, opened as its own sheet (#282).
struct PlanSheet: View {
    let preferences: NativePreferences
    let onDone: () -> Void
    let leave: (LeavingProfile) -> Void
    /// Find dato: on to the paper pile.
    var onFind: () -> Void = {}
    @State private var path: [PlanPage] = []

    var body: some View {
        NavigationStack(path: $path) {
            PlanScreen(leave: leave, onFind: onFind, path: $path)
                .navigationDestination(for: PlanPage.self) { page in
                    switch page {
                    case .shortcuts: ShortcutsScreen(onFind: onFind, path: $path)
                    case .editor(let id): ShortcutEditor(id: id, path: $path)
                    }
                }
        }
        .environment(\.closeSheet, onDone)
        .nativeSheetLook(preferences)
    }
}

/// The Planlæg sheet, as the web's PlanSetup (#173, #126, #282): the group
/// beside Genveje, the name, then the time as rows (Aftale or Tur / ferie,
/// each setting a row with its value on the right, opening a picker that
/// grows out of it), the months, and how many must be able to come. "Find
/// dato" is the one main action, pinned along the bottom.
struct PlanScreen: View {
    let leave: (LeavingProfile) -> Void
    @Bindable private var model = PlanModel.shared
    @Environment(\.closeSheet) private var closeSheet
    var onFind: () -> Void = {}
    @Binding var path: [PlanPage]
    /// The AI's yes asked first (useAiConsentGate).
    @State private var consent: (() -> Void)?
    /// The AI's questions open, the sheet held as it was until they are answered.
    @State private var asking = false
    @State private var before: PlanState?

    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // Planning a starred day (#243): which, and when everyone is free, said first.
                if let prime = model.shownPrime {
                    HStack(spacing: 8) {
                        Image(systemName: "star.fill")
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.primary.color)
                            .frame(width: 16, height: 16)
                        (Text(CasyStrings.primeTitle).fontWeight(.semibold)
                            + Text(verbatim: " · \(capitalized(dayLabel(prime.day, lang))), \(primeWhen(prime))"))
                            .font(.system(size: 15))
                            .foregroundStyle(Theme.foreground.color)
                    }
                    .padding(.horizontal, 4)
                    .padding(.bottom, 12)
                    .accessibilityElement(children: .combine)
                    .accessibilityIdentifier("plan.prime")
                }
                if model.again != nil {
                    // A vote searched again (#264): its group and name are the
                    // vote's, so only what may find an earlier date is here.
                    Text(model.name)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(Theme.foreground.color)
                        .padding(.horizontal, 4)
                        .accessibilityIdentifier("plan.againName")
                } else {
                    PlanGroupRow(shortcuts: { path.append(.shortcuts) })
                    PlanNameField(onAsk: askAi).padding(.top, 16)
                }
                Group {
                    PlanTimeRows()
                    PlanMonths()
                    PlanHowMany()
                }
                .allowsHitTesting(!model.filling)
                if viewerElsewhere {
                    HStack(spacing: 6) {
                        LucideIcon("globe", size: 16)
                        Text(CasyStrings.planTimeNote).font(.system(size: 12))
                    }
                    .foregroundStyle(Theme.mutedForeground.color)
                    .padding(.horizontal, 4)
                    .padding(.top, 12)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.bottom, 16)
        }
        .scrollDismissesKeyboard(.interactively)
        .accessibilityIdentifier("plan.screen")
        .casySheetBar(
            model.again == nil ? CasyStrings.planTitle : CasyStrings.searchAgain, close: CasyStrings.cancel,
            icon: model.again == nil
                ? SheetIconAction(icon: "rotate-ccw", label: CasyStrings.planReset) { model.startOver() } : nil,
            action: closeSheet
        )
        .safeAreaInset(edge: .bottom) {
            FlowButton(action: onFind) { Text(CasyStrings.planFindDate) }
                .disabled(model.activeGroup == nil)
                .accessibilityIdentifier("plan.find")
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
        }
        .task {
            ShortcutsModel.shared.loadAhead()
            await model.open()
            await model.loadAi()
        }
        .onDisappear { model.closed() }
        .aiConsentGate($consent, leave: leave)
        .sheet(isPresented: $asking, onDismiss: questionsDone) {
            PlanQuestionsSheet(done: { asking = false })
                .nativeSheetLook(NativePreferences.shared)
        }
    }

    /// What is written goes to the AI; its questions (if any) are asked, then
    /// the sheet fills itself in before your eyes.
    private func askAi() {
        consent = {
            let from = model.state
            model.describe(model.name) { hasQuestions in
                before = from
                if hasQuestions {
                    model.holdFill(from: from)
                    asking = true
                } else {
                    model.startFill(from: from)
                }
            }
        }
    }

    private func questionsDone() {
        if let before { model.startFill(from: before) }
        before = nil
    }

    /// Whether this phone's clock isn't Danish time, so every time needs saying so.
    private var viewerElsewhere: Bool {
        let year = Calendar(identifier: .gregorian).component(.year, from: Date())
        return !sameClock(TimeZone.current.identifier, appTimeZone, year)
    }
}

// MARK: - The group

/// The plan's group as one row (#173, #185): its members as bubbles and its
/// name big, the groups unfolding from the row to pick another; Genveje beside it.
struct PlanGroupRow: View {
    /// Genveje beside the group; none under a genvej about to run.
    var shortcuts: (() -> Void)?
    private let model = PlanModel.shared
    @State private var picking = false

    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Button { picking = true } label: {
                CardList(spaced: false) {
                    CardRow(model.activeGroup?.name ?? CasyStrings.planGroup, chevron: true) {
                        if let group = model.activeGroup, group.pictureUrl != nil || !group.members.isEmpty {
                            GroupBubbles(
                                members: group.members, picture: group.pictureUrl.flatMap(URL.init(string:)))
                        }
                    }
                }
            }
            .buttonStyle(.cardRow)
            .accessibilityLabel("\(CasyStrings.planGroup) \(model.activeGroup?.name ?? "")")
            .accessibilityIdentifier("plan.group")
            .popover(isPresented: $picking, attachmentAnchor: .rect(.bounds), arrowEdge: .top) {
                GroupChoices(done: { picking = false })
                    .presentationCompactAdaptation(.popover)
            }
            if let shortcuts {
            Button(action: shortcuts) {
                Text(CasyStrings.shortcutsTitle)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Theme.primary.color)
                    .padding(.horizontal, 14)
                    .frame(maxHeight: .infinity)
                    .background(Theme.card.color, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .strokeBorder(Theme.border.color, lineWidth: 1)
                    }
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("plan.shortcuts")
            }
        }
        .fixedSize(horizontal: false, vertical: true)
    }
}

/// The groups to pick from, each with its members' names, the picked one ticked.
private struct GroupChoices: View {
    private let model = PlanModel.shared
    let done: () -> Void

    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    var body: some View {
        ScrollView {
            CardList(spaced: false) {
                ForEach(model.groups ?? [], id: \.id) { group in
                    PickRow(
                        label: group.name, detail: detail(group), picked: group.id == model.activeGroup?.id,
                        action: {
                            model.select(group)
                            done()
                        }
                    ) {
                        GroupBubbles(
                            members: group.members, picture: group.pictureUrl.flatMap(URL.init(string:)))
                    }
                }
            }
            .padding(8)
        }
        .frame(width: 320)
        .frame(maxHeight: 360)
    }

    private func detail(_ group: CasyAPI.Group) -> String {
        nameList(group.members.map { $0.isYou ? CasyStrings.groupWithYou($0.name) : $0.name }, lang)
    }
}

// MARK: - The time

private let dayMinutes = 24 * 60

/// Aftale or Tur / ferie, then one row per setting, each opening a small
/// picker of its own (#173): a meeting is "17:00 - 19:00" (start and end
/// wheels), give or take (Kan rykkes, stepped by half hours in its row), on
/// some weekdays; a trip is its days and the weekday it starts on.
struct PlanTimeRows: View {
    @Bindable private var model = PlanModel.shared
    @State private var open: Open?

    private enum Open { case time, days, startDay }

    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }
    private var settings: SchedulerSettings { model.shownSettings }
    private var flex: Int? { flexOf(settings) }
    private var fixedStart: Bool { !settings.anyTime && flex != nil }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // A vote searched again (#264) stays the kind it is.
            if model.again == nil {
                KindChoice(multiDay: settings.multiDay) { value in model.update { $0.multiDay = value } }
                    .litRing(model.lit == .kind, radius: 12)
                    .padding(.bottom, 12)
            }
            if settings.multiDay {
                CardList(spaced: false) {
                    CardRow(CasyStrings.planTripDays, icon: "calendar-days") {
                        PlanStepper(
                            pressed: model.fillPress == .tripLess ? -1 : model.fillPress == .tripMore ? 1 : 0,
                            value: settings.days, values: Array(1...(settings.startDow == nil ? maxSpanDays : maxWeeklyTripDays)),
                            format: { CasyStrings.days($0) }, less: CasyStrings.planFewerDays,
                            more: CasyStrings.planMoreDays
                        ) { days in model.update { $0.days = days } }
                    }
                    .litRow(model.lit == .tripDays)
                    pickerRow(
                        CasyStrings.planTripStarts, icon: "flag", id: .startDay,
                        value: settings.startDow.map { weekdayLong($0) } ?? CasyStrings.planAnyDay)
                }
            } else {
                CardList(spaced: false) {
                    pickerRow(CasyStrings.planTime, icon: "clock", id: .time, value: timeValue)
                    if fixedStart {
                        CardRow(CasyStrings.planFlex, icon: "diff") {
                            PlanStepper(
                                pressed: model.fillPress == .flexLess ? -1 : model.fillPress == .flexMore ? 1 : 0,
                                value: flex ?? 0, values: flexMinutes,
                                format: { $0 == 0 ? CasyStrings.planFlexNone : "± \(CasyStrings.planLength($0))" },
                                less: CasyStrings.planFlexLess, more: CasyStrings.planFlexMore
                            ) { f in
                                model.update { $0.startWindow = flexWindow($0.startHour, f) }
                            }
                        }
                        .litRow(model.lit == .flex)
                    }
                    pickerRow(CasyStrings.planDayLabel, icon: "calendar-days", id: .days, value: daysLabel)
                }
            }
        }
        .padding(.top, 16)
        .onChange(of: model.settings, initial: true) { _, settings in
            // The phone's rows know a start as an hour give or take: a window the
            // AI (or a widened search) chose is put in that shape.
            if !settings.multiDay, !settings.anyTime, let window = settings.startWindow, flexOf(settings) == nil {
                let around = flexAround(window)
                model.update {
                    $0.startHour = around.startHour
                    $0.startWindow = around.startWindow
                }
            }
        }
    }

    /// The picker open: the AI's while it fills the sheet in, else the person's.
    private var shownOpen: Open? {
        switch model.fillSheet {
        case .time: .time
        case .days: .days
        case .startDay: .startDay
        case nil: model.fill == nil ? open : nil
        }
    }

    private func pickerRow(_ label: String, icon: String, id: Open, value: String) -> some View {
        Button { open = id } label: {
            CardRow(label, icon: icon, value: value, chevron: true)
                .litRow(model.lit == litKey(id))
        }
        .buttonStyle(.cardRow)
        .accessibilityIdentifier("plan.row.\(id)")
        .popover(
            isPresented: Binding(get: { shownOpen == id }, set: { if !$0, open == id { open = nil } }),
            attachmentAnchor: .rect(.bounds), arrowEdge: .top
        ) {
            Group {
                switch id {
                case .time: TimePicker()
                case .days: DaysPicker()
                case .startDay: StartDayPicker(done: { open = nil })
                }
            }
            .presentationCompactAdaptation(.popover)
        }
    }

    private func litKey(_ id: Open) -> FillKey {
        switch id {
        case .time: .time
        case .days: .days
        case .startDay: .startDay
        }
    }

    private func clock(_ minutes: Int) -> String { formatClockMinutes(minutes % dayMinutes) }

    private var timeValue: String {
        if fixedStart {
            let start = Int(settings.startHour * 60)
            return CasyStrings.planFromTo(clock(start), clock(start + settings.durationMinutes))
        }
        // A starred day's free hours stand for "any time" (#243).
        let anyTime = PlanModel.shared.shownPrime.map { capitalized(primeWhen($0)) } ?? CasyStrings.planAnyTime
        let start = settings.anyTime ? anyTime : startOptions(settings).first { $0.value == startValue(settings) }?.label ?? ""
        return "\(start), \(CasyStrings.planLength(settings.durationMinutes))"
    }

    private var daysLabel: String {
        let days = describeDays(settings.dows)
        switch days {
        case .list(let dows):
            return dows == [5, 6] ? CasyStrings.planFriSat : dows.map { CasyStrings.planWeekdayShort($0) }.joined(separator: ", ")
        case .all: return capitalized(CasyStrings.planDayList("all"))
        case .weekdays: return capitalized(CasyStrings.planDayList("weekdays"))
        case .weekends: return capitalized(CasyStrings.planDayList("weekends"))
        }
    }
}

private func capitalized(_ text: String) -> String { text.prefix(1).uppercased() + text.dropFirst() }

/// "fredag" / "Friday" for a day of week (0 is Sunday), capitalised.
private func weekdayLong(_ dow: Int) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: CasyStrings.language == "en" ? "en_GB" : "da_DK")
    formatter.timeZone = TimeZone(identifier: "UTC")
    formatter.dateFormat = "EEEE"
    // 21 June 2026 is a Sunday.
    let day = Date(timeIntervalSince1970: Double((Int64(1_782_043_200) + Int64(dow) * 86_400)))
    return capitalized(formatter.string(from: day))
}

/// The start dropdown's choices: the AI's window while there is one (-2), "any time" (-1), then the hours.
private func startOptions(_ settings: SchedulerSettings) -> [(label: String, value: Int)] {
    var options: [(label: String, value: Int)] = []
    if let window = settings.startWindow {
        options.append(
            (CasyStrings.planStartWindow(formatClockMinutes(Int(window.from)), formatClockMinutes(Int(window.to))), -2))
    }
    options.append((CasyStrings.planAnyTime, -1))
    for hour in 0..<24 { options.append((String(format: "%02d:00", hour), hour)) }
    return options
}

private func startValue(_ settings: SchedulerSettings) -> Int {
    if settings.startWindow != nil { return -2 }
    return settings.anyTime ? -1 : Int(settings.startHour)
}

/// Start and end wheels side by side; the end keeps its distance as the start moves.
private struct TimePicker: View {
    @Bindable private var model = PlanModel.shared

    private var settings: SchedulerSettings { model.shownSettings }
    private var flex: Int? { flexOf(settings) }
    private var fixedStart: Bool { !settings.anyTime && flex != nil }
    /// A window made by Kan rykkes is the hour itself on the wheel.
    private var wheel: SchedulerSettings {
        var copy = settings
        if flex != nil { copy.startWindow = nil }
        return copy
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            column(CasyStrings.planFrom) {
                Picker("", selection: Binding(get: { startValue(wheel) }, set: { pickStart($0) })) {
                    ForEach(startOptions(wheel), id: \.value) { Text($0.label).tag($0.value) }
                }
            }
            column(fixedStart ? CasyStrings.planTo : CasyStrings.planDuration) {
                Picker("", selection: Binding(get: { settings.durationMinutes }, set: { d in model.update { $0.durationMinutes = d } })) {
                    ForEach(Array(1...24).map { $0 * 30 }, id: \.self) { d in
                        Text(
                            fixedStart
                                ? formatClockMinutes((Int(settings.startHour * 60) + d) % dayMinutes)
                                : CasyStrings.planLength(d)
                        ).tag(d)
                    }
                }
            }
        }
        .padding(12)
        .frame(width: 300)
    }

    private func column<Wheel: View>(_ title: String, @ViewBuilder _ wheel: () -> Wheel) -> some View {
        VStack(spacing: 4) {
            Text(title)
                .textCase(.uppercase)
                .font(.system(size: 12, weight: .medium))
                .tracking(0.3)
                .foregroundStyle(Theme.mutedForeground.color)
            wheel().pickerStyle(.wheel).frame(height: 180)
        }
        .frame(maxWidth: .infinity)
    }

    /// A new hour keeps the flexibility; any other pick drops the AI's window.
    private func pickStart(_ value: Int) {
        if value == -2 { return }
        model.update { s in
            if value == -1 {
                s.anyTime = true
                s.startWindow = nil
            } else {
                s.startHour = Double(value)
                s.anyTime = false
                s.startWindow = flexWindow(Double(value), flex ?? 0)
            }
        }
    }
}

/// The weekdays: quick picks, then the seven in a row.
private struct DaysPicker: View {
    @Bindable private var model = PlanModel.shared

    private var days: DayListLabel { describeDays(model.shownSettings.dows) }
    private var presets: [(label: String, dows: [Int], on: Bool)] {
        let friSat: Bool = { if case .list(let d) = days { return d == [5, 6] } else { return false } }()
        return [
            (capitalized(CasyStrings.planDayList("all")), allDows, days == .all),
            (capitalized(CasyStrings.planDayList("weekdays")), [1, 2, 3, 4, 5], days == .weekdays),
            (capitalized(CasyStrings.planDayList("weekends")), [6, 0], days == .weekends),
            (CasyStrings.planFriSat, [5, 6], friSat),
        ]
    }

    var body: some View {
        VStack(spacing: 16) {
            CardList(spaced: false) {
                ForEach(Array(presets.enumerated()), id: \.offset) { _, preset in
                    PickRow(preset.label, picked: preset.on) {
                        model.update { $0.dows = preset.dows }
                    }
                }
            }
            HStack(spacing: 4) {
                ForEach(allDows, id: \.self) { d in
                    let on = model.shownSettings.dows.contains(d)
                    Button { toggle(d) } label: {
                        Text(CasyStrings.planWeekdayShort(d))
                            .font(.system(size: 12, weight: on ? .semibold : .medium))
                            .lineLimit(1)
                            .foregroundStyle(on ? Theme.primaryForeground.color : Theme.mutedForeground.color)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(
                                on ? Theme.primary.color : Theme.secondary.color,
                                in: RoundedRectangle(cornerRadius: 6, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(on ? .isSelected : [])
                }
            }
            .padding(4)
            .overlay {
                RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(Theme.border.color, lineWidth: 1)
            }
        }
        .padding(8)
        .frame(width: 320)
    }

    /// At least one day always stays on.
    private func toggle(_ d: Int) {
        let selected = model.settings.dows
        if selected.contains(d) {
            if selected.count <= 1 { return }
            model.update { $0.dows = selected.filter { $0 != d } }
        } else {
            model.update { $0.dows = selected + [d] }
        }
    }
}

private struct StartDayPicker: View {
    @Bindable private var model = PlanModel.shared
    let done: () -> Void

    var body: some View {
        CardList(spaced: false) {
            PickRow(CasyStrings.planAnyDay, picked: model.shownSettings.startDow == nil) { choose(nil) }
            ForEach(allDows, id: \.self) { d in
                PickRow(weekdayLong(d), picked: model.shownSettings.startDow == d) { choose(d) }
            }
        }
        .padding(8)
        .frame(width: 280)
    }

    private func choose(_ d: Int?) {
        model.update { $0.startDow = d }
        done()
    }
}

// MARK: - Pieces

/// Aftale | Tur / ferie: two equal halves in a track (`KindChoice` with `fill`).
private struct KindChoice: View {
    let multiDay: Bool
    let onChange: (Bool) -> Void

    var body: some View {
        HStack(spacing: 4) {
            ForEach([false, true], id: \.self) { value in
                Button { onChange(value) } label: {
                    Text(value ? CasyStrings.planTrip : CasyStrings.planMeeting)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(multiDay == value ? Theme.foreground.color : Theme.mutedForeground.color)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background {
                            if multiDay == value {
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .fill(Theme.card.color)
                                    .shadow(color: .black.opacity(0.05), radius: 1, y: 1)
                            }
                        }
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(multiDay == value ? .isSelected : [])
                .accessibilityIdentifier(value ? "plan.kind.trip" : "plan.kind.meeting")
            }
        }
        .padding(4)
        .frame(height: 48)
        .background(Theme.secondary.color.opacity(0.6), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay { RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Theme.border.color, lineWidth: 1) }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(CasyStrings.planKind)
    }
}

/// A value stepped with minus and plus at the end of a row: orange buttons
/// and the value muted between them (`Stepper inRow`).
private struct PlanStepper: View {
    /// A button the AI is pressing as it fills the sheet in: -1 minus, 1 plus.
    var pressed = 0
    let value: Int
    let values: [Int]
    let format: (Int) -> String
    let less: String
    let more: String
    let onChange: (Int) -> Void

    private var index: Int? { values.firstIndex(of: value) }

    var body: some View {
        HStack(spacing: 0) {
            button("minus", less, enabled: (index ?? 0) > 0, step: -1, pressed: pressed == -1)
            Text(format(value))
                .font(.system(size: 14))
                .foregroundStyle(Theme.mutedForeground.color)
                .frame(minWidth: 48)
                .lineLimit(1)
                .fixedSize()
            button("plus", more, enabled: index.map { $0 < values.count - 1 } ?? false, step: 1, pressed: pressed == 1)
        }
        .frame(height: 36)
    }

    private func button(_ icon: String, _ label: String, enabled: Bool, step: Int, pressed: Bool) -> some View {
        Button {
            if let index, values.indices.contains(index + step) { onChange(values[index + step]) }
        } label: {
            LucideIcon(icon, size: 16)
                .foregroundStyle(Theme.primary.color)
                .frame(width: 40, height: 36)
                .background(Theme.primary.color.opacity(pressed ? 0.15 : 0), in: Capsule())
                .scaleEffect(pressed ? 1.1 : 1)
                .animation(.easeOut(duration: 0.15), value: pressed)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .opacity(enabled ? 1 : 0.3)
        .disabled(!enabled)
        .accessibilityLabel(label)
    }
}

// MARK: - The months

/// When, in the Planlæg sheet (#173): the twelve months searched, all in view
/// as two rows of six. A tap picks a month, a tap on another stretches the
/// period to it, a tap on either end takes that month off.
struct PlanMonths: View {
    /// The months for something else than the plan (a genvej's Hvornår, #259).
    var value: Binding<Period?>?
    @Bindable private var model = PlanModel.shared
    @State private var now = Native.now

    init(value: Binding<Period?>? = nil) { self.value = value }

    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }
    private var period: Period? { value?.wrappedValue ?? (value == nil ? model.shownSettings.period : nil) }

    private func set(_ change: (Period?) -> Period?) {
        if let value { value.wrappedValue = change(value.wrappedValue) } else { model.update { $0.period = change($0.period) } }
    }
    private var months: [String] {
        let first = startOfMonth(now, appTimeZone)
        return (0..<12).map { isoString(startOfMonth(first, appTimeZone, $0)) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text(CasyStrings.planMonths)
                    .textCase(.uppercase)
                    .font(.system(size: 12, weight: .medium))
                    .tracking(0.3)
                    .foregroundStyle(Theme.mutedForeground.color)
                    .padding(.horizontal, 4)
                Spacer()
                Button { set { _ in nil } } label: {
                    Text(CasyStrings.planAllMonths)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(period == nil ? Theme.primary.color : Theme.mutedForeground.color)
                        .padding(.horizontal, 4)
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(period == nil ? .isSelected : [])
            }
            .padding(.bottom, 6)
            let columns = Array(repeating: GridItem(.flexible(), spacing: 6), count: 6)
            LazyVGrid(columns: columns, spacing: 6) {
                ForEach(Array(months.enumerated()), id: \.element) { i, month in
                    monthButton(month, index: i)
                }
            }
            .padding(6)
            .background(Theme.card.color, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay { RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.border.color, lineWidth: 1) }
            .litRing(value == nil && model.lit == .months, radius: 16)
            .accessibilityElement(children: .contain)
            .accessibilityLabel(CasyStrings.planMonths)
            if let period {
                Text(
                    period.days == true
                        ? CasyStrings.planPeriodDaysHint(
                            periodText(period, lang, Self.words, now: now))
                        : CasyStrings.planPeriodHint
                )
                .font(.system(size: 12))
                .foregroundStyle(Theme.mutedForeground.color)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 4)
                .padding(.top, 6)
            }
        }
        .padding(.top, value == nil ? 16 : 0)
    }

    private static let words = PeriodWords(
        any: "", one: { $0 }, range: { "\($0) - \($1)" }, day: { $0 }, until: { $0 })

    private func inPeriod(_ month: String) -> Bool {
        guard let period else { return false }
        let m = parseInstant(month) ?? 0
        let from = parseInstant(period.from) ?? 0
        let to = parseInstant(period.to) ?? 0
        if period.days == true { return startOfMonth(from, appTimeZone) <= m && m <= to }
        return m >= from && m <= to
    }

    private func isEnd(_ month: String) -> Bool {
        guard let period, period.days != true else { return false }
        return month == period.from || month == period.to
    }

    private func monthButton(_ month: String, index: Int) -> some View {
        let ms = parseInstant(month) ?? 0
        let on = period == nil || inPeriod(month)
        let end = isEnd(month)
        let local = localDate(ms, appTimeZone)
        let name = capitalized(monthShortName(ms, lang).replacingOccurrences(of: ".", with: ""))
        return Button {
            set { pickPeriodMonth($0, month, appTimeZone) }
        } label: {
            VStack(spacing: 0) {
                Text(name).font(.system(size: 15, weight: .semibold))
                // The year where it changes, so January reads as next year's.
                if local.month == 0, index > 0 {
                    Text(String(local.year)).font(.system(size: 10, weight: .medium)).opacity(0.7)
                }
            }
            .foregroundStyle(end ? Color.white : Theme.foreground.color)
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(
                end ? Theme.cta.color : on ? Theme.primary.color.opacity(0.15) : Color.clear,
                in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(capitalized(monthName(ms, lang))) \(local.year)")
        .accessibilityAddTraits(on ? .isSelected : [])
        .accessibilityIdentifier("plan.month.\(index)")
    }
}

// MARK: - The name, and the AI

/// The name field (#173), which is also where the AI is asked: for someone
/// the AI is on for, its right end holds a microphone while it is empty and
/// ✨ once something is written or said; ✨ (or return) sends it as it stands.
/// Without the AI it is the plain name field, as long as a title may be.
private struct PlanNameField: View {
    let onAsk: () -> Void
    @Bindable private var model = PlanModel.shared
    @State private var speech = SpeechInput()
    /// What was typed before the microphone went on; speech is added after it.
    @State private var before = ""
    @FocusState private var focused: Bool
    @ScaledMetric(relativeTo: .body) private var height: CGFloat = 48
    @ScaledMetric(relativeTo: .body) private var textSize: CGFloat = 17

    private var written: Bool { !model.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    private var lit: Bool { focused || speech.listening || model.lit == .name }
    private var limit: Int { model.aiOn ? PlanModel.maxDescription : PlanModel.maxName }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(CasyStrings.planName)
                .textCase(.uppercase)
                .font(.system(size: 12, weight: .medium))
                .tracking(0.3)
                .foregroundStyle(Theme.mutedForeground.color)
                .padding(.horizontal, 4)
                .accessibilityHidden(true)
            HStack(spacing: 0) {
                TextField(
                    "",
                    text: Binding(get: { model.shownName }, set: { model.name = String($0.prefix(limit)) }),
                    prompt: Text(speech.listening ? CasyStrings.listening : CasyStrings.planNamePlaceholder)
                        .foregroundStyle(Theme.mutedForeground.color)
                )
                .font(.system(size: textSize))
                .foregroundStyle(Theme.foreground.color)
                .textFieldStyle(.plain)
                .focused($focused)
                .submitLabel(model.aiOn ? .go : .done)
                .onSubmit { if model.aiOn { ask() } }
                .disabled(model.filling)
                .accessibilityLabel(CasyStrings.planName)
                .accessibilityIdentifier("plan.name")
                if model.aiOn { aiButton.padding(.trailing, 6) }
            }
            .padding(.leading, 14)
            .padding(.trailing, model.aiOn ? 0 : 14)
            .frame(minHeight: height)
            .background(Theme.card.color, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(lit ? Theme.primary.color : Theme.border.color, lineWidth: 1)
            }
            .background {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Theme.primary.color.opacity(lit ? 0.2 : 0))
                    .padding(-2)
            }
            .contentShape(Rectangle())
            .onTapGesture { focused = true }
            if let failure = speech.failure {
                Text(failure).font(.system(size: 12)).foregroundStyle(Theme.red700.color).padding(.horizontal, 4)
            }
            if let failure = model.aiFailure {
                Text(failure).font(.system(size: 12)).foregroundStyle(Theme.red700.color).padding(.horizontal, 4)
            }
        }
        .onAppear {
            speech.onHeard = { heard in
                model.name = String((before.isEmpty ? heard : "\(before) \(heard)").prefix(limit))
            }
        }
        .onDisappear { Task { await speech.stop() } }
    }

    /// A spinner while the AI thinks, ✨ once something is written, else the microphone.
    @ViewBuilder private var aiButton: some View {
        Group {
            if model.aiPending {
                ProgressView()
                    .tint(Theme.primary.color)
                    .frame(width: 36, height: 36)
                    .background(Theme.primary.color.opacity(0.1), in: Circle())
                    .accessibilityLabel(CasyStrings.aiThinking)
            } else if written {
                Button(action: ask) {
                    LucideIcon("sparkles", size: 20)
                        .foregroundStyle(Theme.primary.color)
                        .frame(width: 36, height: 36)
                        .background(Theme.primary.color.opacity(0.1), in: Circle())
                        .frame(width: 44, height: 44)
                        .contentShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(CasyStrings.aiStart)
                .accessibilityIdentifier("plan.ai")
            } else {
                Button {
                    Task {
                        if !speech.listening { before = model.name.trimmingCharacters(in: .whitespacesAndNewlines) }
                        await speech.toggle()
                    }
                } label: {
                    Group {
                        if speech.listening {
                            SoundWave(listening: true).scaleEffect(0.75).foregroundStyle(Color.white)
                        } else {
                            LucideIcon("mic", size: 20).foregroundStyle(Theme.primary.color)
                        }
                    }
                    .frame(width: 36, height: 36)
                    .background(speech.listening ? Theme.red600.color : Color.clear, in: Circle())
                    .frame(width: 44, height: 44)
                    .contentShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(speech.listening ? CasyStrings.stopSpeaking : CasyStrings.speak)
                .accessibilityIdentifier("plan.mic")
            }
        }
        .transition(.scale(scale: 0.4).combined(with: .opacity))
        .animation(.spring(response: 0.25, dampingFraction: 0.7), value: written)
        .animation(.spring(response: 0.25, dampingFraction: 0.7), value: model.aiPending)
    }

    private func ask() {
        Task { await speech.stop() }
        focused = false
        if written, !model.aiPending { onAsk() }
    }
}

/// What the AI needs to know before it fills in the sheet (#173): its
/// questions as one short sheet of tap answers. Answering the last one closes
/// it, and Færdig does too, the rest left as the AI guessed.
private struct PlanQuestionsSheet: View {
    let done: () -> Void
    private let model = PlanModel.shared

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    ForEach(Array(model.questions.enumerated()), id: \.offset) { qi, entry in
                        CardList(entry.question.question, spaced: qi > 0) {
                            ForEach(Array(entry.question.options.enumerated()), id: \.offset) { oi, option in
                                PickRow(option.label, picked: entry.picked == oi) { pick(qi, oi) }
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
            }
            .accessibilityIdentifier("plan.questions")
            .casySheetBar(CasyStrings.aiQuickQuestion, close: CasyStrings.planQuestionsDone, action: done)
        }
        .presentationDetents([.medium, .large])
    }

    /// The last one answered: a moment to see its tick, then on to the filling in.
    private func pick(_ question: Int, _ option: Int) {
        let wasOpen = model.questions[question].picked == nil
        let open = model.questions.filter { $0.picked == nil }.count
        model.answer(question, option)
        if wasOpen, open == 1 {
            Task {
                try? await Task.sleep(for: .milliseconds(300))
                done()
            }
        }
    }
}

extension View {
    /// A row's light while the AI fills it in (#173): soft orange while it is
    /// the one, fading out as the next one takes over.
    fileprivate func litRow(_ on: Bool) -> some View {
        background(Theme.primary.color.opacity(on ? 0.15 : 0))
            .animation(.easeOut(duration: on ? 0.15 : 0.7), value: on)
    }

    /// The same light as a ring, for a box with a background of its own.
    fileprivate func litRing(_ on: Bool, radius: CGFloat) -> some View {
        overlay {
            RoundedRectangle(cornerRadius: radius + 2, style: .continuous)
                .strokeBorder(Theme.primary.color.opacity(on ? 0.5 : 0), lineWidth: 2)
                .padding(-2)
                .allowsHitTesting(false)
        }
        .animation(.easeOut(duration: on ? 0.15 : 0.7), value: on)
    }
}
