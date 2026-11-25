// The paper pile (#126), translated from src/lib/paperPile.ts (#282): every
// member's month as a sheet (free, free only by giving something up, busy,
// or not searched), the days free for everyone shining through; the pile's
// timing, how the thrown calendars lie and get knocked, and the order the
// dates are checked and ranked in. And comfortNotes.ts: what the comfort
// rules found about a date, in words. Kept equal to the TypeScript by the
// parity fixtures (paperPile.cases.ts).

import Foundation

/// A day on one sheet: "free", "soft", "busy" or "off".
public struct PileSheet: Codable, Sendable, Equatable {
    public var profileId: String
    public var name: String
    public var isYou: Bool
    /// Every day of the month, the 1st first.
    public var days: [String]
}

public struct Pile: Codable, Sendable, Equatable {
    public var year: Int
    /// 0-based.
    public var month: Int
    public var label: String
    /// Empty cells before the 1st, the week starting on Monday.
    public var lead: Int
    /// Yours first, then the others in the group's order.
    public var sheets: [PileSheet]
    /// Per day: free for enough of the people searched.
    public var through: [Bool]
}

/// The month `year`/`month` as a pile: a sheet for everyone the search looks at, yours first.
public func buildPile(
    _ participants: [Participant], _ search: EventSettings, you: String?, year: Int, month: Int, timeZone: String,
    todayMs: Int64, windowEndMs: Int64, window: (start: String, end: String), lang: Lang = .da
) -> Pile {
    let searched = peopleForSearch(participants, search.people).searched
    let ordered = searched.filter { $0.profileId == you } + searched.filter { $0.profileId != you }
    var alone = search
    alone.people = nil
    let sheets = ordered.map { p in
        PileSheet(
            profileId: p.profileId, name: p.name, isYou: p.profileId == you,
            days: monthAvailability(
                [p], alone, year: year, month: month, timeZone: timeZone, todayMs: todayMs, windowEndMs: windowEndMs,
                lang: lang
            ).days.map { sheetDay($0, inWindow($0, window)) })
    }
    let group = monthAvailability(
        participants, search, year: year, month: month, timeZone: timeZone, todayMs: todayMs, windowEndMs: windowEndMs,
        lang: lang)
    let first = localDate(wallTime(year, month, 1, 0, timeZone), timeZone)
    return Pile(
        year: year, month: month, label: group.label, lead: (first.dow + 6) % 7, sheets: sheets,
        through: group.days.map { d in
            group.enough > 0 && d.freeCount >= group.enough && !d.excluded && !d.isPast && inWindow(d, window)
        })
}

/// The month the pile shows: the one holding most of the dates about to be offered, the earliest on a tie.
public func candidateMonth(_ starts: [String], fallback: String, _ timeZone: String) -> (year: Int, month: Int) {
    var counts: [(month: Int64, count: Int)] = []
    for start in starts {
        let month = startOfMonth(parseInstant(start) ?? 0, timeZone)
        if let i = counts.firstIndex(where: { $0.month == month }) {
            counts[i].count += 1
        } else {
            counts.append((month, 1))
        }
    }
    var best = startOfMonth(parseInstant(fallback) ?? 0, timeZone)
    var most = 0
    for (month, count) in counts where count > most || (count == most && month < best) {
        best = month
        most = count
    }
    let d = localDate(best, timeZone)
    return (d.year, d.month)
}

private func sheetDay(_ day: DayCell, _ searched: Bool) -> String {
    if !searched || day.excluded || day.isPast { return "off" }
    if day.freeCount > 0 { return "free" }
    return day.conditionalCount > 0 ? "soft" : "busy"
}

private func inWindow(_ day: DayCell, _ window: (start: String, end: String)) -> Bool {
    let ms = parseInstant(day.date) ?? 0
    return ms >= (parseInstant(window.start) ?? 0) && ms < (parseInstant(window.end) ?? 0)
}

/// The pile's timing, in seconds (PILE_TIMING).
public enum PileTiming {
    public static let yours = 0.6
    public static let inPlace = 0.12
    public static let firstLand = 0.32
    public static let speedUp = 0.85
    public static let fastestLand = 0.16
    public static let gap = 0.18
    public static let impact = 0.4
    public static let settle = 0.2
    public static let press = 1.0
    public static let reveal = 1.0
    public static let fly = 0.9
    public static let checkFirst = 0.55
    public static let checkSpeedUp = 0.8
    public static let checkFastest = 0.2
    public static let ranked = 0.5
}

/// When each of `dates` dates gets its result, from the start of the checks.
public func checkTimes(_ dates: Int) -> [Double] {
    var times: [Double] = []
    var at = 0.0
    for i in 0..<max(0, dates) {
        at += max(PileTiming.checkFastest, PileTiming.checkFirst * pow(PileTiming.checkSpeedUp, Double(i)))
        times.append(at)
    }
    return times
}

public struct PileLand: Codable, Sendable, Equatable {
    public var at: Double
    public var duration: Double

    public init(at: Double, duration: Double) {
        self.at = at
        self.duration = duration
    }
}

public struct PileTimeline: Codable, Sendable, Equatable {
    public var lands: [PileLand]
    public var pressAt: Double
    public var revealAt: Double
    public var liftAt: Double
    public var rankAt: Double
    public var doneAt: Double
}

/// When everything happens, for `others` calendars thrown and `dates` dates checked.
public func pileTimeline(_ others: Int, dates: Int = 0, start: Double = PileTiming.yours) -> PileTimeline {
    let T = PileTiming.self
    var lands: [PileLand] = []
    var at = start
    for i in 0..<max(0, others) {
        let duration = max(T.fastestLand, T.firstLand * pow(T.speedUp, Double(i)))
        lands.append(PileLand(at: at, duration: duration))
        at += duration + (i < others - 1 ? (T.gap * duration) / T.firstLand : 0)
    }
    let lastHit = others > 0 ? at + T.impact : at
    let pressAt = lastHit + T.settle
    let revealAt = pressAt + T.press
    let liftAt = revealAt + T.reveal
    let rankAt = liftAt + T.fly
    let doneAt = rankAt + (dates > 0 ? checkTimes(dates)[dates - 1] + T.ranked : 0)
    return PileTimeline(lands: lands, pressAt: pressAt, revealAt: revealAt, liftAt: liftAt, rankAt: rankAt, doneAt: doneAt)
}

/// What ranks a date in the list.
public struct RankedFacts: Codable, Sendable, Equatable {
    public var pickedAt: Int?
    public var conflicts: Int
    public var cost: Double
    public var warnings: Int
    public var start: Int64

    public init(pickedAt: Int?, conflicts: Int, cost: Double, warnings: Int, start: Int64) {
        self.pickedAt = pickedAt
        self.conflicts = conflicts
        self.cost = cost
        self.warnings = warnings
        self.start = start
    }
}

/// The list with the first `checked` dates checked: offered ones at the top, waiting ones, the rest at the bottom.
public func liveOrder(_ ranked: [Int], checked: Int, offered: [Bool]) -> [Int] {
    let waiting = offered.indices.filter { $0 >= checked }
    return ranked.filter { $0 < checked && offered[$0] } + waiting + ranked.filter { $0 < checked && !offered[$0] }
}

/// The list best first, as indexes into `dates` ("hassle" or "soon").
public func rankOrder(_ dates: [RankedFacts], priority: String = "hassle") -> [Int] {
    func offered(_ d: RankedFacts) -> Int { d.pickedAt == nil ? 1 : 0 }
    func before(_ a: RankedFacts, _ b: RankedFacts) -> Int {
        if offered(a) != offered(b) { return offered(a) - offered(b) }
        if priority == "soon" { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0 }
        func cmp(_ x: Double, _ y: Double) -> Int { x < y ? -1 : x > y ? 1 : 0 }
        if let pa = a.pickedAt, let pb = b.pickedAt {
            let c = a.conflicts - b.conflicts
            if c != 0 { return c }
            let k = cmp(a.cost, b.cost)
            if k != 0 { return k }
            return pa - pb
        }
        let c = a.conflicts - b.conflicts
        if c != 0 { return c }
        let w = a.warnings - b.warnings
        if w != 0 { return w }
        return a.start < b.start ? -1 : a.start > b.start ? 1 : 0
    }
    // A stable sort, as JavaScript's.
    return dates.enumerated().sorted { x, y in
        let c = before(x.element, y.element)
        return c != 0 ? c < 0 : x.offset < y.offset
    }.map(\.offset)
}

/// Which side calendar `k` is thrown from: left (-1), then right (1), and so on.
public func throwSide(_ k: Int) -> Double { k % 2 == 0 ? -1 : 1 }

/// JavaScript's Math.round: halves up, towards +infinity.
private func jsRound1(_ n: Double) -> Double { (n * 10 + 0.5).rounded(.down) / 10 }

/// How far calendar `k` has been knocked once `landed` calendars have landed: points and degrees.
public func jostle(_ k: Int, _ landed: Int) -> (x: Double, rotate: Double) {
    var x = 0.0
    var rotate = 0.0
    if landed > k + 1 {
        for j in (k + 1)..<landed {
            let push = -throwSide(j) * pow(0.7, Double(j - k - 1))
            x += push * 3
            rotate += push * 0.6
        }
    }
    return (jsRound1(x), jsRound1(rotate))
}

/// How opaque the whole pile gets.
public let pileOpacity = 0.92

/// How opaque each of `layers` layers is, so together they reach `pileOpacity`.
public func layerAlpha(_ layers: Int) -> Double {
    if layers <= 0 { return 0 }
    return 1 - pow(1 - pileOpacity, 1 / Double(layers))
}

/// How crooked sheet `index` lies: degrees and points. Yours (0) lies straight.
public func sheetTilt(_ index: Int) -> (rotate: Double, x: Double, y: Double) {
    if index == 0 { return (0, 0, 0) }
    func spread(_ k: Double) -> Double { (Double(index) * k).truncatingRemainder(dividingBy: 1) }
    let side: Double = index % 2 == 0 ? 1 : -1
    return (
        jsRound1(side * (2 + 5 * spread(0.618034))),
        jsRound1((spread(0.414214) * 2 - 1) * 8),
        jsRound1((spread(0.732051) * 2 - 1) * 10)
    )
}

// MARK: - comfortNotes.ts

/// The words comfortNotes needs.
public struct ComfortWords: Sendable {
    public var you: String
    public var tightBefore: @Sendable (String) -> String
    public var tightAfter: @Sendable (String) -> String
    public var squeezed: @Sendable (String) -> String
    public var earlyAfterLate: @Sendable (String) -> String
    public var schoolNight: String
    public var afterDark: String
    public var familyDay: String
    public var longWeekend: String
    public var soon: String
    public var farAhead: String

    public init(
        you: String, tightBefore: @escaping @Sendable (String) -> String,
        tightAfter: @escaping @Sendable (String) -> String, squeezed: @escaping @Sendable (String) -> String,
        earlyAfterLate: @escaping @Sendable (String) -> String, schoolNight: String, afterDark: String,
        familyDay: String, longWeekend: String, soon: String, farAhead: String
    ) {
        self.you = you
        self.tightBefore = tightBefore
        self.tightAfter = tightAfter
        self.squeezed = squeezed
        self.earlyAfterLate = earlyAfterLate
        self.schoolNight = schoolNight
        self.afterDark = afterDark
        self.familyDay = familyDay
        self.longWeekend = longWeekend
        self.soon = soon
        self.farAhead = farAhead
    }
}

/// A sentence, and whether it is a mark against the date.
public struct ComfortNote: Codable, Sendable, Equatable {
    public var text: String
    public var notable: Bool
}

private let saidFrom = comfortMedium / 2

/// What the comfort rules found about a date, as sentences: only what matters, never what the warnings say.
public func comfortNotes(
    _ penalties: [Penalty], nameOf: (String) -> String, you: String?, _ lang: Lang, _ words: ComfortWords,
    warnings: [EdgeWarning]?
) -> [ComfortNote] {
    var notes: [ComfortNote] = []
    func has(_ kind: String) -> Bool { warnings?.contains { $0.kind == kind } ?? false }

    // Per rule, per person (in the order first met), what it cost them.
    var costs: [(rule: String, people: [(id: String, points: Double)])] = []
    for p in penalties {
        guard let who = p.who else { continue }
        let r = costs.firstIndex { $0.rule == p.rule } ?? {
            costs.append((p.rule, []))
            return costs.count - 1
        }()
        if let i = costs[r].people.firstIndex(where: { $0.id == who }) {
            costs[r].people[i].points += p.points
        } else {
            costs[r].people.append((who, p.points))
        }
    }
    func people(_ rule: String) -> [(id: String, points: Double)] { costs.first { $0.rule == rule }?.people ?? [] }
    let squeezed = Set(people("sandwiched").filter { $0.points >= saidFrom }.map(\.id))
    func who(_ rule: String) -> (list: String, none: Bool) {
        let ids = people(rule == "squeezed" ? "sandwiched" : rule)
            .filter { $0.points >= saidFrom && !(squeezed.contains($0.id) && (rule == "tightBefore" || rule == "tightAfter")) }
            .map(\.id)
            .enumerated()
            .sorted { a, b in
                let ya = a.element == you ? 1 : 0
                let yb = b.element == you ? 1 : 0
                return ya != yb ? ya > yb : a.offset < b.offset
            }
            .map(\.element)
        return (nameList(ids.map { $0 == you ? words.you : nameOf($0) }, lang), ids.isEmpty)
    }
    for rule in ["squeezed", "tightBefore", "tightAfter", "earlyAfterLate"] {
        if rule == "earlyAfterLate" && has("earlyMorning") { continue }
        if (rule == "tightBefore" || rule == "squeezed") && has("backToBack") { continue }
        let found = who(rule)
        if found.none { continue }
        let text: String
        switch rule {
        case "squeezed": text = words.squeezed(found.list)
        case "tightBefore": text = words.tightBefore(found.list)
        case "tightAfter": text = words.tightAfter(found.list)
        default: text = words.earlyAfterLate(found.list)
        }
        notes.append(ComfortNote(text: text, notable: true))
    }
    func sum(_ rule: String) -> Double { penalties.filter { $0.rule == rule }.reduce(0) { $0 + $1.points } }
    if sum("schoolNight") > 0 { notes.append(ComfortNote(text: words.schoolNight, notable: true)) }
    if sum("afterDark") > 0 { notes.append(ComfortNote(text: words.afterDark, notable: true)) }
    if sum("dayOfYear") > 0 && !has("newYearsDay") { notes.append(ComfortNote(text: words.familyDay, notable: true)) }
    if sum("dayOfYear") < 0 { notes.append(ComfortNote(text: words.longWeekend, notable: false)) }
    if sum("notice") > 0 { notes.append(ComfortNote(text: words.soon, notable: true)) }
    if sum("farAhead") >= saidFrom { notes.append(ComfortNote(text: words.farAhead, notable: false)) }
    return notes
}
