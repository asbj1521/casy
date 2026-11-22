import CasyCore
import CasyUI
import Foundation

// The welcome animation's made-up world (#228, #282): src/components/welcome/
// phone/demo.ts, geometry.ts, throws.ts and dayCell.ts, and WelcomeStage's
// timeline (AT), in the same numbers.

enum WelcomeDemo {
    /// The made-up group, the same name in both languages.
    static let groupName = "Uni-Gruppen"

    struct Person {
        let id: String
        let name: String
        let color: String
    }

    /// You first, then the five friends whose paper calendars land on your
    /// phone, one colour each: their face, their pen and their bars.
    static let people = [
        Person(id: "you", name: "", color: "0, 122, 255"),
        Person(id: "philip", name: "Philip", color: "52, 199, 89"),
        Person(id: "emilie", name: "Emilie", color: "175, 82, 222"),
        Person(id: "elias", name: "Elias", color: "255, 149, 0"),
        Person(id: "claes", name: "Claes", color: "255, 59, 48"),
        Person(id: "simon", name: "Simon", color: "48, 176, 199"),
    ]
    static var friends: ArraySlice<Person> { people.dropFirst() }
    static func colorOf(_ id: String) -> String { people.first { $0.id == id }?.color ?? "" }

    /// The example month: next month, so its days are all still to come.
    static func month(_ now: Int64) -> Int64 { startOfMonth(now, appTimeZone, 1) }

    /// Who is busy when: every day someone, except three Fridays, the only
    /// days that light up. Never more than three on a day.
    static func plan(_ month: Int64) -> (free: [Int64], items: [[MonthItem]]) {
        let end = startOfMonth(month, appTimeZone, 1)
        var days: [Int64] = []
        var d = month
        while d < end {
            days.append(d)
            d = addDays(d, 1, appTimeZone)
        }
        let free = Array(days.filter { localDate($0, appTimeZone).dow == 5 }.dropFirst().prefix(3))
        var items: [[MonthItem]] = people.map { _ in [] }
        for (i, day) in days.enumerated() where !free.contains(day) {
            var busy: [Int] = [i % 6]
            if i % 3 != 2, !busy.contains((i + 2) % 6) { busy.append((i + 2) % 6) }
            if i % 5 == 0, !busy.contains((i + 3) % 6) { busy.append((i + 3) % 6) }
            for who in busy.sorted() {
                items[who].append(
                    MonthItem(calendarId: people[who].id, start: day, end: addDays(day, 1, appTimeZone), label: ""))
            }
        }
        return (free, items)
    }

    /// The hours of the event in the vote.
    static let eventHours = (from: 19.0, to: 22.0)

    /// The vote on the free days, for the app's real card, nothing ever sent:
    /// most of the friends have answered, as they have when you get to it.
    static func vote(_ free: [Int64], title: String) -> SuggestedEvent {
        let others = friends.map(\.id)
        let at = { (day: Int64, hour: Double) -> String in
            let l = localDate(day, appTimeZone)
            return isoString(wallTime(l.year, l.month, l.day, hour, appTimeZone))
        }
        return SuggestedEvent(
            id: "welcome", group: EventGroupRef(id: "welcome", name: groupName), title: title,
            settings: EventSettings(kind: .single, durationMinutes: 180, startHour: eventHours.from),
            status: .pending, mode: .vote, createdBy: EventCreator(id: "you", name: "", isYou: true),
            createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
            candidates: free.enumerated().map { i, day in
                CandidateDate(
                    id: String(day), start: at(day, eventHours.from), end: at(day, eventHours.to),
                    answers: Dictionary(
                        uniqueKeysWithValues: others.enumerated().filter { k, _ in (k + i) % 5 != 4 }.map {
                            ($0.element, EventResponse.accepted)
                        }))
            },
            invitees: friends.map { EventInvitee(profileId: $0.id, name: $0.name, isYou: false) })
    }

    // MARK: The phone (geometry.ts)

    /// Its screen: laid out at a real phone's size and only ever scaled down.
    static let screen = CGSize(width: 390, height: 844)
    static let screenRadius: CGFloat = 56
    /// From the phone's outer edge to the screen: the metal band, then the black bezel.
    static let edge: CGFloat = 14
    static let band: CGFloat = 4
    static let device = CGSize(width: screen.width + edge * 2, height: screen.height + edge * 2)
    static let deviceRadius: CGFloat = screenRadius + edge
    /// Above the first week, on the phone's month and the paper alike.
    static let headerHeight: CGFloat = 176
    /// Where the home page's two capsules sit, under the Dynamic Island.
    static let pillTop: CGFloat = 58
    /// The group screen's member rows, for the faces that fly into them.
    static let rows = (left: CGFloat(16), top: CGFloat(300), height: CGFloat(62), face: CGFloat(44))
    /// A week with three lanes of bars (weekRowPx(3)).
    static let weekRow: CGFloat = 1 + 40 + CGFloat(monthLanes) * monthLanePoints + monthMorePoints

    /// The middle of a day's number on the phone's month, in the screen's points.
    static func dayCell(_ day: Int64, month: Int64) -> CGPoint {
        let l = localDate(month, appTimeZone)
        let weeks = monthLayout(l.year, l.month, appTimeZone).weeks
        for (w, week) in weeks.enumerated() {
            if let c = week.firstIndex(where: { $0.date == day }) {
                return CGPoint(
                    x: (CGFloat(c) + 0.5) / 7 * screen.width, y: headerHeight + CGFloat(w) * weekRow + 1 + 20)
            }
        }
        return CGPoint(x: screen.width / 2, y: screen.height / 2)
    }

    /// The list of dates, as Planlæg lays it over the month, under the toolbar.
    static let list = (top: CGFloat(112), left: CGFloat(16), height: CGFloat(66), gap: CGFloat(8))
    static func rowTop(_ i: Int) -> CGFloat { list.top + CGFloat(i) * (list.height + list.gap) }

    /// How far the month must have scrolled for each date's circle to be level with its row.
    static func listScrolls(_ days: [Int64], month: Int64) -> [CGFloat] {
        var scroll: CGFloat = 0
        return days.enumerated().map { i, day in
            scroll = max(scroll, dayCell(day, month: month).y - (rowTop(i) + list.height / 2))
            return scroll
        }
    }

    // MARK: The throws (throws.ts)

    static let fly: [Double] = [0.82, 0.54, 0.42, 0.36, 0.32]
    static let leaveAfter: [Double] = [0.72, 0.42, 0.32, 0.26]
    /// The landing: past the spot a little, back, and settled.
    static let hit = 0.48
    static let throwsAt: [(at: Double, fly: Double, landed: Double)] = {
        var at = 0.0
        return fly.enumerated().map { k, f in
            let start = at
            at += k < leaveAfter.count ? leaveAfter[k] : 0
            return (start, f, start + f)
        }
    }()
    static let stackDone = throwsAt.last!.landed + hit

    // MARK: The timeline (WelcomeStage's AT), in seconds from a round's start

    static let flyFor = 0.42
    static let sendFor = 0.55
    static let flightFor = 0.95
    static let dissolveFor = 1.15
    static let finaleHold = 2.0
    /// The glass drop's fall onto the calendars, from `digital` to the hit.
    static let dropFall = 0.34
    /// The wave it makes: how high, how long from crest to crest, how fast, and for how long.
    static let ripple = (amplitude: 22.0, wavelength: 160.0, speed: 430.0, lasts: 1.8)
    static let popAt = (0..<5).map { 0.3 + Double($0) * 0.13 }
    static let flyAt = (0..<5).map { 1.35 + Double($0) * 0.13 }

    struct Times {
        let joined: [Double]
        let leave, home, throwsStart: Double
        let thrown, landed: [Double]
        let squared, merged, digital, dissolve, press, shine, list: Double
        let scrolls, taken: [Double]
        let button, pressed, sent, back, badge, pillPressed, vote: Double
        let answers: [Double]
        /// A thumb taking hold of each card, a moment before it is swiped away.
        let grabs: [Double]
        let agreed, collapsed, flying, landing, thudDone, finale: Double
        let sends, arrived: [Double]
        let finaleOut, end: Double

        /// Every moment something changes, for the clock to stop at.
        var moments: [Double] {
            (popAt + flyAt + joined + [leave, home] + thrown + landed
                + [squared, merged, digital, dissolve, press, shine, list] + scrolls + taken
                + [button, pressed, sent, back, badge, pillPressed, vote] + grabs + answers
                + [agreed, collapsed, flying, landing, thudDone, finale] + sends + arrived + [finaleOut]).sorted()
        }
    }

    static let at: Times = {
        let joined = flyAt.map { $0 + flyFor }
        let leave = joined.last! + 0.4
        let home = leave + 0.42
        let throwsStart = home + 0.3
        let thrown = throwsAt.map { throwsStart + $0.at }
        let landed = throwsAt.map { throwsStart + $0.landed }
        let squared = throwsStart + stackDone + 0.15
        let merged = squared + 0.2
        let digital = merged + 0.28
        let dissolve = digital + 0.22
        let press = dissolve + dissolveFor - 0.1
        let shine = press + 0.35
        let list = shine + 0.9
        let scrolls = (0..<3).map { list + 0.3 + Double($0) * 0.72 }
        let taken = scrolls.map { $0 + 0.45 }
        let button = taken[2] + 0.4
        let pressed = button + 0.75
        let sent = pressed + 0.3
        let back = sent + 0.3
        let badge = sent + 0.85
        let pillPressed = badge + 0.55
        let vote = pillPressed + 0.22
        let answers = [vote + 1.35, vote + 2.3, vote + 3.15]
        let grabs = answers.map { $0 - 0.45 }
        let agreed = answers[2] + 0.7
        let collapsed = agreed + 1.5
        let flying = collapsed + 0.45
        let landing = flying + flightFor
        let thudDone = landing + 0.2
        let finale = landing + 0.75
        let sends = (0..<5).map { finale + 0.55 + Double($0) * 0.17 }
        let arrived = sends.map { $0 + sendFor }
        let finaleOut = arrived.last! + finaleHold
        return Times(
            joined: joined, leave: leave, home: home, throwsStart: throwsStart, thrown: thrown, landed: landed,
            squared: squared, merged: merged, digital: digital, dissolve: dissolve, press: press, shine: shine,
            list: list, scrolls: scrolls, taken: taken, button: button, pressed: pressed, sent: sent, back: back,
            badge: badge, pillPressed: pillPressed, vote: vote, answers: answers, grabs: grabs, agreed: agreed,
            collapsed: collapsed, flying: flying, landing: landing, thudDone: thudDone, finale: finale,
            sends: sends, arrived: arrived, finaleOut: finaleOut, end: finaleOut + 0.28)
    }()
}
