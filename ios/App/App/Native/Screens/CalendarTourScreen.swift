import CasyAPI
import CasyCore
import CasyUI
import SwiftUI

/// The guided calendar setup (#221, #200): your calendars one at a time, in
/// their own colours, what kind each is and how much it matters, then a small
/// reward. Casy's guess is already picked, so Næste alone takes care of a good
/// one. It moves on at once and saves behind it; anything that failed is said
/// at the end. A screen inside Kalendere, as on the web.
struct CalendarTourScreen: View {
    private let model = CalendarsModel.shared
    @Environment(\.closeSheet) private var closeSheet
    /// The calendars it set out with, in the same order whatever saving changes.
    @State private var ids: [String]?
    @State private var index = 0
    @State private var forward = true
    @State private var choices: [String: TourChoice] = [:]
    @State private var creating = false
    @State private var failed: [(id: String, changes: [CalendarChange])] = []
    @State private var saving: [Task<Void, Never>] = []
    @State private var helping = false

    private var steps: [OverviewCalendar] {
        let calendars = model.calendars
        return (ids ?? []).compactMap { id in calendars.first { $0.id == id } }
    }

    var body: some View {
        let steps = self.steps
        let done = ids != nil && index >= steps.count
        ZStack {
            if ids == nil {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if done {
                TourDone(
                    calendars: steps.filter { (choices[$0.id] ?? choiceOf($0)).stop != "off" },
                    failed: failed.count, retry: retry)
            } else {
                card(steps)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("tour.screen")
        .casyPushedBar(CasyStrings.tourTitle, close: CasyStrings.done, action: closeSheet)
        .safeAreaInset(edge: .bottom) {
            if ids != nil {
                Group {
                    if done {
                        FlowButton(action: closeSheet) { Text(CasyStrings.tourSee) }
                    } else {
                        FlowButton(action: goOn) {
                            Text(index + 1 >= steps.count ? CasyStrings.tourFinish : CasyStrings.tourNext)
                        }
                        .accessibilityIdentifier("tour.next")
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
            }
        }
        .sensoryFeedback(.impact(weight: .light), trigger: index)
        .sensoryFeedback(.success, trigger: done) { _, now in now }
        .task {
            if model.data == nil { await model.load() }
            if ids == nil, model.data != nil {
                ids = tourSteps(model.calendars, seen: model.tourSeen).map(\.id)
            }
        }
        // The list and the month pick it all up on leaving, once everything is saved.
        .onDisappear {
            let pending = saving
            saving = []
            guard !pending.isEmpty else { return }
            Task {
                for task in pending { await task.value }
                await model.settled()
            }
        }
        .sheet(isPresented: $creating) {
            NewCategorySheet { category in
                creating = false
                setChoice { $0.purpose = category.purpose; $0.categoryName = category.name }
            }
            .nativeSheetLook(NativePreferences.shared)
        }
    }

    private func choice(_ c: OverviewCalendar) -> TourChoice { choices[c.id] ?? choiceOf(c) }

    private func setChoice(_ change: (inout TourChoice) -> Void) {
        let steps = self.steps
        guard index < steps.count else { return }
        var next = choice(steps[index])
        change(&next)
        choices[steps[index].id] = next
    }

    /// The person's own categories, with one just made on an earlier card.
    private var own: [OwnCategory] {
        var list = ownCategories(model.calendars)
        for c in choices.values {
            if let name = c.categoryName, let purpose = c.purpose, !list.contains(where: { $0.name == name }) {
                list.append(OwnCategory(name: name, purpose: purpose))
            }
        }
        return list
    }

    @ViewBuilder private func card(_ steps: [OverviewCalendar]) -> some View {
        let current = steps[index]
        let next = index + 1 < steps.count ? steps[index + 1] : nil
        let chosen = choice(current)
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // One bar per calendar: tap back to one already done.
                HStack(spacing: 4) {
                    ForEach(steps.indices, id: \.self) { i in
                        Button {
                            forward = false
                            withAnimation(.spring(duration: 0.3)) { index = i }
                        } label: {
                            Capsule()
                                .fill(
                                    i == index
                                        ? Theme.foreground.color : i < index ? Theme.primary.color : Theme.secondary.color
                                )
                                .frame(height: 6)
                                .frame(maxWidth: .infinity, minHeight: 24)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        // Not `disabled`: that dims the bar, and the one you're on is the web's foreground.
                        .allowsHitTesting(i < index)
                        .accessibilityLabel(CasyStrings.tourStep(i + 1, of: steps.count))
                    }
                }

                // The card, the next one waiting behind it, so it reads as a stack.
                ZStack {
                    if let next {
                        TourCard(calendar: next, color: model.color(next.id))
                            .scaleEffect(0.96)
                            .offset(y: 8)
                            .opacity(0.6)
                            .accessibilityHidden(true)
                    }
                    TourCard(calendar: current, color: model.color(current.id))
                        .id(current.id)
                        .transition(
                            .asymmetric(
                                insertion: .scale(scale: 0.96).combined(with: .offset(y: 10)),
                                removal: forward ? .modifier(active: FlyAway(gone: true), identity: FlyAway(gone: false)) : .opacity))
                        .zIndex(1)
                }
                .frame(height: 100)
                .padding(.top, 12)

                // The web's `mb-2 mt-4 px-1`, 12 semibold, capitals drawn only.
                Text(CasyStrings.tourCategory)
                    .font(.system(size: 12, weight: .semibold))
                    .tracking(0.3)
                    .textCase(.uppercase)
                    .foregroundStyle(Theme.mutedForeground.color)
                    .cssLineHeight(16, size: 12)
                    .padding(.top, 16)
                    .padding(.bottom, 8)
                    .padding(.horizontal, 4)
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
                    ForEach(calendarCategories, id: \.self) { category in
                        CategoryChoice(
                            label: CasyStrings.category(category),
                            checked: chosen.purpose == category && chosen.categoryName == nil,
                            guessed: current.purposeGuessed == true && current.purpose == category
                                && current.categoryName == nil
                        ) {
                            setChoice { $0.purpose = category; $0.categoryName = nil }
                        }
                    }
                    ForEach(own, id: \.name) { category in
                        CategoryChoice(label: category.name, checked: chosen.categoryName == category.name) {
                            setChoice { $0.purpose = category.purpose; $0.categoryName = category.name }
                        }
                    }
                    Button {
                        creating = true
                    } label: {
                        // The web's `border-dashed rounded-2xl px-3`, 15 medium orange, a 16 point plus.
                        HStack(spacing: 6) {
                            LucideIcon("plus", size: 16)
                            Text(CasyStrings.calendarsNewCategory).lineLimit(1)
                        }
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(Theme.primary.color)
                        .padding(.horizontal, 12)
                        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .strokeBorder(Theme.border.color, style: StrokeStyle(lineWidth: 1, dash: [3, 3])))
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }

                TourSlider(stop: chosen.stop, helping: $helping) { stop in setChoice { $0.stop = stop } }
                    .padding(.top, 16)
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 12)
        }
    }

    private func goOn() {
        let steps = self.steps
        guard index < steps.count else { return }
        let current = steps[index]
        save(current.id, changesFrom(current, choice(current)))
        model.seen(current.id)
        forward = true
        withAnimation(.spring(response: 0.38, dampingFraction: 0.8)) { index += 1 }
    }

    private func save(_ id: String, _ changes: [CalendarChange]) {
        guard !changes.isEmpty else { return }
        saving.append(
            Task {
                do {
                    try await model.save(id, changes)
                } catch {
                    failed.removeAll { $0.id == id }
                    failed.append((id, changes))
                }
            })
    }

    private func retry() {
        let again = failed
        failed = []
        for f in again { save(f.id, f.changes) }
    }
}

/// The card leaving for the next, as a vote's card does: thrown to the right.
private struct FlyAway: ViewModifier {
    let gone: Bool

    func body(content: Content) -> some View {
        content
            .rotationEffect(.degrees(gone ? 18 : 0))
            .offset(x: gone ? 640 : 0)
            .opacity(gone ? 0 : 1)
    }
}

/// A calendar as the big card: filled with its own colour, its name big.
private struct TourCard: View {
    let calendar: OverviewCalendar
    /// "r, g, b".
    let color: String

    var body: some View {
        let text = textOn(color) == "#ffffff" ? Color.white : Color(red: 28 / 255, green: 28 / 255, blue: 30 / 255)
        VStack(alignment: .leading, spacing: 4) {
            Spacer(minLength: 0)
            // 26 extrabold at 1.1, tracking-tight; then 13 medium at 90 %.
            Text(calendar.name)
                .font(.system(size: 26, weight: .heavy))
                .tracking(-0.65)
                .lineLimit(2)
                .minimumScaleFactor(0.7)
            Text([calendar.account, CasyStrings.tourEvents(calendar.total)].compactMap { $0 }.joined(separator: " · "))
                .font(.system(size: 13, weight: .medium))
                .lineLimit(1)
                .opacity(0.9)
        }
        .foregroundStyle(text)
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .background(Color(rgb: color), in: RoundedRectangle(cornerRadius: 24))
        .shadow(color: .black.opacity(0.15), radius: 10, y: 6)
    }
}

/// One category in the grid: with a slider under it on one screen, rows would
/// run off the bottom as soon as someone had a category of their own.
private struct CategoryChoice: View {
    let label: String
    let checked: Bool
    var guessed = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Text(label).lineLimit(1)
                if guessed {
                    HStack(spacing: 4) {
                        LucideIcon("sparkles", size: 12).foregroundStyle(Theme.amber500.color)
                        Text(CasyStrings.guessed)
                    }
                    .font(.system(size: 12))
                    .fontWeight(.regular)
                    .foregroundStyle(Theme.mutedForeground.color)
                }
                Spacer(minLength: 0)
                if checked { LucideIcon("check", size: 16, stroke: 3) }
            }
            .font(.system(size: 15, weight: checked ? .semibold : .regular))
            .foregroundStyle(checked ? Theme.primary.color : Theme.foreground.color)
            .padding(.horizontal, 12)
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            .background(checked ? Theme.primary.color.opacity(0.1) : Theme.card.color, in: RoundedRectangle(cornerRadius: 16))
            .overlay(
                RoundedRectangle(cornerRadius: 16).strokeBorder(
                    checked ? Theme.primary.color : Theme.border.color, lineWidth: 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(guessed ? "\(label), \(CasyStrings.guessed)" : label)
        .accessibilityAddTraits(checked ? .isSelected : [])
    }
}

/// A calendar's priority: a slider snapping to the four stops, the stop's name
/// under it, what each does behind the ?.
private struct TourSlider: View {
    let stop: String
    @Binding var helping: Bool
    let change: (String) -> Void

    private func name(_ stop: String) -> String {
        stop == "off" ? CasyStrings.tourOff : CasyStrings.priorityLevel(stop)
    }

    var body: some View {
        let at = Double(tourStops.firstIndex(of: stop) ?? 2)
        VStack(spacing: 6) {
            HStack(spacing: 6) {
                Text(CasyStrings.tourImportance)
                    .font(.system(size: 12, weight: .semibold))
                    .tracking(0.3)
                    .textCase(.uppercase)
                    .foregroundStyle(Theme.mutedForeground.color)
                // The web's HelpButton: circle-help, 20, orange.
                Button {
                    helping = true
                } label: {
                    LucideIcon("circle-question-mark", size: 20)
                        .foregroundStyle(Theme.primary.color)
                        .contentShape(Rectangle().inset(by: -12))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(CasyStrings.tourImportanceHelp)
                .popover(isPresented: $helping) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(CasyStrings.priorityLevelsHelp)
                        Text("\(CasyStrings.tourOff): \(CasyStrings.tourOffEffect)")
                    }
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.foreground.color)
                    .padding(16)
                    .frame(idealWidth: 320)
                    .fixedSize(horizontal: false, vertical: true)
                    .presentationCompactAdaptation(.popover)
                }
                Spacer()
            }
            .padding(.horizontal, 4)
            Slider(
                value: Binding(
                    get: { at },
                    set: { value in
                        let next = tourStops[min(3, max(0, Int(value.rounded())))]
                        if next != stop { change(next) }
                    }),
                in: 0...3, step: 1
            )
            .tint(Theme.primary.color)
            // The four stops on the track, the thumb's half-width in from each end.
            .background {
                GeometryReader { box in
                    ForEach(0..<4, id: \.self) { i in
                        Circle()
                            .fill(Double(i) <= at ? Theme.primary.color : Theme.mutedForeground.color.opacity(0.3))
                            .frame(width: 10, height: 10)
                            .position(x: 18 + (box.size.width - 36) * Double(i) / 3, y: box.size.height / 2)
                    }
                }
                .accessibilityHidden(true)
            }
            .accessibilityLabel(CasyStrings.tourImportance)
            .accessibilityValue(name(stop))
            .accessibilityIdentifier("tour.slider")
            .sensoryFeedback(.selection, trigger: stop)
            Text(name(stop))
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.foreground.color)
                .accessibilityHidden(true)
        }
    }
}

/// The reward: every calendar gone through thrown into one neat fan in their
/// colours, confetti, and what it did; anything that failed to save is said here.
private struct TourDone: View {
    let calendars: [OverviewCalendar]
    let failed: Int
    let retry: () -> Void

    private let model = CalendarsModel.shared
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var fanned = false

    var body: some View {
        let fan = Array(calendars.prefix(5))
        let middle = Double(fan.count - 1) / 2
        ScrollView {
            VStack(spacing: 8) {
                ZStack {
                    ForEach(fan.indices, id: \.self) { i in
                        let d = Double(i) - middle
                        RoundedRectangle(cornerRadius: 16)
                            .fill(Color(rgb: model.color(fan[i].id)))
                            .frame(width: 80, height: 112)
                            .shadow(color: .black.opacity(0.2), radius: 8, y: 4)
                            .rotationEffect(.degrees(fanned ? d * 7 : 0))
                            .offset(x: fanned ? d * 30 : 0, y: fanned ? abs(d) * 5 : 90)
                            .scaleEffect(fanned ? 1 : 0.8)
                            .opacity(fanned ? 1 : 0)
                            .animation(
                                reduceMotion ? nil : .spring(response: 0.45, dampingFraction: 0.55).delay(Double(i) * 0.06),
                                value: fanned)
                    }
                }
                .frame(height: 144)
                .accessibilityHidden(true)
                Text(CasyStrings.tourDoneTitle)
                    .font(.title2.weight(.heavy))
                    .foregroundStyle(Theme.foreground.color)
                Text(CasyStrings.tourDoneBody)
                    .font(.subheadline)
                    .foregroundStyle(Theme.mutedForeground.color)
                if failed > 0 {
                    VStack(alignment: .leading, spacing: 6) {
                        Notice(CasyStrings.tourSomeFailed(failed), tone: .error)
                        Button(CasyStrings.tourRetry, action: retry)
                            .font(.subheadline.weight(.semibold))
                    }
                    .padding(.top, 12)
                }
            }
            .multilineTextAlignment(.center)
            .padding(.horizontal, 24)
            .padding(.top, 24)
        }
        .overlay { Confetti().ignoresSafeArea() }
        .onAppear { fanned = true }
        .accessibilityIdentifier("tour.done")
    }
}
