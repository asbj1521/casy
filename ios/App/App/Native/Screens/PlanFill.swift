import CasyCore
import Foundation

/// The sheet's rows the AI fills in, in the order they stand (#173).
enum FillKey: Sendable { case name, kind, time, flex, days, tripDays, startDay, months }
/// A row's own picker, opened while the AI uses it.
enum FillSheet: Sendable { case time, days, startDay }
/// A stepper's button the AI is pressing.
enum FillPress: Sendable { case flexLess, flexMore, tripLess, tripMore }

/// What the sheet holds, before the AI answered and after.
struct PlanState: Sendable {
    var name: String
    var settings: SchedulerSettings
}

/// One moment of the filling in: what the sheet shows, and for how long.
struct Frame: Sendable {
    var name: String
    var settings: SchedulerSettings
    var lit: FillKey?
    var sheet: FillSheet?
    var press: FillPress?
    var ms: Int
}

struct PlanFill: Sendable {
    var frames: [Frame]
    var tick: Int
    /// Nil past the last frame, where the plan shows as it is.
    var frame: Frame? { frames.indices.contains(tick) ? frames[tick] : nil }
}

/// The web's timings (useAiFill.ts).
enum FillTiming {
    /// A picker growing open or shrinking shut.
    static let sheet = 480
    /// A wheel rolling to its value.
    static let wheel = 750
    /// A tap: a stepper's button, a day, a month.
    static let tap = 300
    /// A letter deleted, a letter typed.
    static let delete = 18
    static let type = 45
    /// The longest the name may take either way.
    static let nameTicks = 14
    /// The most taps a stepper gets before it takes bigger steps.
    static let maxTaps = 8
}

private let presets: [[Int]] = [allDows, [1, 2, 3, 4, 5], [6, 0], [5, 6]]
private func sameDays(_ a: [Int], _ b: [Int]) -> Bool { a.count == b.count && a.allSatisfy(b.contains) }

/// The AI's filling in as a person would do it by hand, frame by frame (the
/// web's `script`): the name deleted and typed, Aftale or Tur switched, the
/// time picker opened and its wheels rolled, Kan rykkes' plus pressed half an
/// hour at a time, the day picker's quick pick or days tapped, the months
/// tapped. Only what changed is done.
func fillScript(from: PlanState, to: PlanState) -> [Frame] {
    var frames: [Frame] = []
    var name = from.name
    var s = from.settings
    let b = to.settings
    func push(
        _ change: (inout SchedulerSettings) -> Void, _ ms: Int, lit: FillKey? = nil,
        sheet: FillSheet? = nil, press: FillPress? = nil
    ) {
        change(&s)
        frames.append(Frame(name: name, settings: s, lit: lit, sheet: sheet, press: press, ms: ms))
    }
    func cut(_ text: String, _ share: Double) -> String {
        String(text.prefix(Int((Double(text.count) * share).rounded())))
    }

    if from.name != to.name {
        let del = min(FillTiming.nameTicks, from.name.count)
        if del > 0 {
            for i in 1...del {
                name = cut(from.name, 1 - Double(i) / Double(del))
                push({ _ in }, FillTiming.delete, lit: .name)
            }
        }
        let type = min(FillTiming.nameTicks * 2, to.name.count)
        if type > 0 {
            for i in 1...type {
                name = cut(to.name, Double(i) / Double(type))
                push({ _ in }, FillTiming.type, lit: .name)
            }
        }
    }

    if s.multiDay != b.multiDay { push({ $0.multiDay = b.multiDay }, FillTiming.sheet, lit: .kind) }

    if !b.multiDay {
        if s.startHour != b.startHour || s.anyTime != b.anyTime || s.durationMinutes != b.durationMinutes {
            push({ _ in }, FillTiming.sheet, lit: .time, sheet: .time)
            if s.startHour != b.startHour || s.anyTime != b.anyTime {
                // The flexibility goes along with the hour, as a new hour picked by hand keeps it.
                let flex = flexOf(s) ?? 0
                push(
                    {
                        $0.startHour = b.startHour
                        $0.anyTime = b.anyTime
                        $0.startWindow = flexWindow(b.startHour, flex)
                    }, FillTiming.wheel, lit: .time, sheet: .time)
            }
            if s.durationMinutes != b.durationMinutes {
                push({ $0.durationMinutes = b.durationMinutes }, FillTiming.wheel, lit: .time, sheet: .time)
            }
            push({ _ in }, FillTiming.sheet, lit: .time)
        }
        if !b.anyTime {
            let want = flexOf(b) ?? 0
            var flex = flexOf(s) ?? 0
            while flex != want {
                let up = flex < want
                flex += up ? 30 : -30
                let hour = s.startHour
                let next = flex
                push({ $0.startWindow = flexWindow(hour, next) }, FillTiming.tap, lit: .flex, press: up ? .flexMore : .flexLess)
            }
        }
        if !sameDays(s.dows, b.dows) {
            push({ _ in }, FillTiming.sheet, lit: .days, sheet: .days)
            if presets.contains(where: { sameDays($0, b.dows) }) {
                push({ $0.dows = b.dows }, FillTiming.tap * 2, lit: .days, sheet: .days)
            } else {
                // Day by day: the new ones on first, so at least one is always on.
                for d in allDows where b.dows.contains(d) && !s.dows.contains(d) {
                    push({ $0.dows.append(d) }, FillTiming.tap, lit: .days, sheet: .days)
                }
                for d in allDows where !b.dows.contains(d) && s.dows.contains(d) {
                    push({ $0.dows.removeAll { $0 == d } }, FillTiming.tap, lit: .days, sheet: .days)
                }
            }
            push({ _ in }, FillTiming.sheet, lit: .days)
        }
    } else {
        if s.days != b.days {
            let step = max(1, Int((Double(abs(b.days - s.days)) / Double(FillTiming.maxTaps)).rounded(.up)))
            while s.days != b.days {
                let up = s.days < b.days
                let days = up ? min(b.days, s.days + step) : max(b.days, s.days - step)
                push({ $0.days = days }, FillTiming.tap, lit: .tripDays, press: up ? .tripMore : .tripLess)
            }
        }
        if s.startDow != b.startDow {
            push({ _ in }, FillTiming.sheet, lit: .startDay, sheet: .startDay)
            push({ $0.startDow = b.startDow }, FillTiming.tap * 2, lit: .startDay, sheet: .startDay)
            push({ _ in }, FillTiming.sheet, lit: .startDay)
        }
    }

    if s.period != b.period {
        // A run of months is tapped as a person does: its first, then its last.
        if let period = b.period, period.days != true, period.from != period.to {
            push({ $0.period = Period(from: period.from, to: period.from) }, FillTiming.tap * 3 / 2, lit: .months)
        }
        push({ $0.period = b.period }, FillTiming.tap * 3 / 2, lit: .months)
    }
    return frames
}
