import CasyCore
import CasyUI
import SwiftUI
import UIKit

/// "Hvor mange skal kunne" (#259) in the Planlæg sheet: a number, not people
/// picked one by one. A slider with a step per count, from about two thirds
/// of those coming to everyone, each with the first date it finds (never the
/// date itself, which the pile reveals). Meetings only, with three or more.
struct PlanHowMany: View {
    /// The room above it: 16 in the sheet, 12 under a genvej about to run.
    var top: CGFloat = 16
    @Bindable private var model = PlanModel.shared

    private var of: Int { requiredCount(model.members, model.peopleChoice) }
    private var count: Int {
        model.peopleChoice.atLeast.map { min($0, of) } ?? of
    }
    private var shown: Bool { model.activeGroup != nil && !model.settings.multiDay && of > minCount }

    var body: some View {
        if shown {
            let steps =
                model.counts
                ?? (0...(of - lowestCount(of, model.peopleChoice.atLeast))).map {
                    CountOption(count: of - $0, of: of, first: nil)
                }
            VStack(alignment: .leading, spacing: 0) {
                Text(CasyStrings.planHowManyLabel)
                    .textCase(.uppercase)
                    .font(.system(size: 12, weight: .medium))
                    .tracking(0.3)
                    .foregroundStyle(Theme.mutedForeground.color)
                    .padding(.horizontal, 4)
                    .padding(.bottom, 6)
                HowManySlider(options: steps, loading: model.counts == nil, count: count) { n in
                    var choice = model.peopleChoice
                    choice.atLeast = n == of ? nil : n
                    model.updatePeople(choice)
                }
                .background(Theme.card.color, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay { RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.border.color, lineWidth: 1) }
                if count < of {
                    Text(CasyStrings.planHowManyFootnote)
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.mutedForeground.color)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, 4)
                        .padding(.top, 6)
                }
            }
            .padding(.top, top)
        }
    }
}

/// The slider itself: the knob follows the finger, a tick is felt at each step,
/// and let go it springs onto the nearest. The count is picked as the finger lifts.
private struct HowManySlider: View {
    let options: [CountOption]
    let loading: Bool
    let count: Int
    let onPick: (Int) -> Void

    @State private var drag: Double?

    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }
    private var steps: [CountOption] { options.reversed() }
    private var last: Int { steps.count - 1 }
    private var picked: Int { max(0, steps.firstIndex { $0.count == count } ?? 0) }
    private static let maxLabels = 9

    var body: some View {
        if last >= 1 {
            let pos = drag ?? Double(picked)
            let step = Int(pos.rounded())
            let shownStep = steps[min(max(step, 0), last)]
            let everyone = steps[last]
            let pct = pos / Double(last)
            let sooner: Int = {
                guard let first = shownStep.first, let all = everyone.first, shownStep.count != everyone.count else { return 0 }
                return daysSooner(first.slot.start, than: all.slot.start, appTimeZone)
            }()
            let date: String = {
                if loading { return "…" }
                guard let first = shownStep.first else { return CasyStrings.planHowManyNone }
                if sooner > 0 { return CasyStrings.planHowManySooner(sooner) }
                let name = monthName(parseInstant(first.slot.start) ?? 0, lang)
                return name.prefix(1).uppercased() + name.dropFirst()
            }()
            GeometryReader { geo in
                let width = geo.size.width
                VStack(spacing: 0) {
                    // What the step buys rides over the knob, kept inside the card at the ends.
                    ZStack(alignment: .bottomLeading) {
                        Color.clear
                        Text(date)
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(sooner > 0 ? Theme.primary.color : Theme.foreground.color)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .frame(minWidth: 120)
                            .fixedSize()
                            .background(Theme.background.color, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                            .overlay { RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.border.color, lineWidth: 1) }
                            .shadow(color: .black.opacity(0.05), radius: 1, y: 1)
                            .offset(x: min(max(CGFloat(pct) * width, 60), max(width - 60, 60)) - 60, y: -8)
                    }
                    .frame(width: width, height: 52)
                    .animation(drag == nil ? .spring(response: 0.3, dampingFraction: 0.65) : nil, value: pct)
                    track(pos: pos, pct: pct, width: width)
                    labels(step: step, width: width)
                }
            }
            .frame(height: 116)
            .padding(.horizontal, 16)
            .padding(.top, 4)
            .padding(.bottom, 8)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(CasyStrings.planHowManyLabel)
            .accessibilityValue(
                "\(shownStep.count == shownStep.of ? CasyStrings.planHowManyAll(shownStep.of) : CasyStrings.planHowManySome(shownStep.count, shownStep.of)), \(date)"
            )
            .accessibilityAdjustableAction { direction in
                let to = direction == .increment ? picked + 1 : picked - 1
                if (0...last).contains(to) { onPick(steps[to].count) }
            }
            .accessibilityIdentifier("plan.howMany")
        }
    }

    private func track(pos: Double, pct: Double, width: CGFloat) -> some View {
        ZStack(alignment: .leading) {
            Capsule().fill(Theme.secondary.color).frame(height: 6)
            Capsule().fill(Theme.cta.color).frame(width: CGFloat(pct) * width, height: 6)
            ForEach(0...last, id: \.self) { i in
                Circle()
                    .fill(Double(i) <= pos ? Theme.cta.color : Theme.mutedForeground.color.opacity(0.3))
                    .frame(width: 10, height: 10)
                    .offset(x: CGFloat(i) / CGFloat(last) * width - 5)
            }
            Circle()
                .fill(Color.white)
                .overlay { Circle().strokeBorder(Color.black.opacity(0.05), lineWidth: 1) }
                .shadow(color: .black.opacity(0.18), radius: 3, y: 2)
                .frame(width: 28, height: 28)
                .scaleEffect(drag == nil ? 1 : 1.1)
                .offset(x: CGFloat(pct) * width - 14)
        }
        .frame(height: 44)
        .contentShape(Rectangle())
        .animation(drag == nil ? .spring(response: 0.3, dampingFraction: 0.65) : nil, value: pct)
        .gesture(
            DragGesture(minimumDistance: 0, coordinateSpace: .local)
                .onChanged { value in
                    let next = Double(min(max(value.location.x, 0), width) / max(width, 1)) * Double(last)
                    if Int(next.rounded()) != Int((drag ?? Double(picked)).rounded()) {
                        UISelectionFeedbackGenerator().selectionChanged()
                    }
                    drag = next
                }
                .onEnded { _ in
                    guard let drag else { return }
                    let to = min(max(Int(drag.rounded()), 0), last)
                    self.drag = nil
                    if steps[to].count != count { onPick(steps[to].count) }
                }
        )
    }

    /// The counts under their steps; with many, only the ends.
    private func labels(step: Int, width: CGFloat) -> some View {
        ZStack(alignment: .topLeading) {
            ForEach(Array(steps.enumerated()), id: \.offset) { i, option in
                if steps.count <= Self.maxLabels || i == 0 || i == last {
                    Text(i == last ? CasyStrings.planHowManyAll(option.of) : String(option.count))
                        .font(.system(size: 12, weight: i == step ? .bold : .medium))
                        .foregroundStyle(i == step ? Theme.foreground.color : Theme.mutedForeground.color)
                        .fixedSize()
                        .modifier(LabelAt(x: CGFloat(i) / CGFloat(last) * width, anchor: i == 0 ? 0 : i == last ? 1 : 0.5))
                }
            }
        }
        .frame(height: 20, alignment: .topLeading)
        .accessibilityHidden(true)
    }
}

/// A label placed by its start (0), middle (0.5) or end (1) at `x`.
private struct LabelAt: ViewModifier {
    let x: CGFloat
    let anchor: CGFloat
    @State private var size: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { size = $0 }
            .offset(x: x - size * anchor)
    }
}
