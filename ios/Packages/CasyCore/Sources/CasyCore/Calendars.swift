// The calendar list's rules (#200): calendarOverview.ts's grouping and own
// categories, calendarTour.ts (the guided setup), accountSummary.ts's
// syncedAgo and appleCredentials.ts's password check.

import Foundation

extension OverviewCalendar {
    /// The always-present holiday calendar: computed, not connected, no account.
    /// `name` in the reader's language, `total` the holidays in the year ahead.
    public static func holidays(name: String, total: Int, included: Bool) -> OverviewCalendar {
        OverviewCalendar(
            id: holidayCalendarId, name: name, originalName: nil, renamed: false, writable: false, purpose: nil,
            categoryName: nil, purposeGuessed: nil, priority: "normal", included: included, total: total,
            provider: "builtin", account: nil, connectionId: holidayCalendarId, externalId: nil)
    }
}

/// The categories a calendar can have, in the order the picker lists them.
public let calendarCategories = ["work", "school", "personal", "other"]

/// What a calendar's category reads as: its owner's name, its kind, or `none`.
public func categoryLabel(
    purpose: String?, categoryName: String?, categories: (String) -> String, none: String
) -> String {
    if let categoryName, !categoryName.isEmpty { return categoryName }
    return purpose.map(categories) ?? none
}

/// A category of the person's own (#220): its name, and the kind scheduling reads.
public struct OwnCategory: Codable, Sendable, Equatable, Hashable {
    public var name: String
    public var purpose: String

    public init(name: String, purpose: String) {
        self.name = name
        self.purpose = purpose
    }
}

/// The person's own categories, from what their calendars are set to, once each
/// (a different case is the same one), the first calendar's kind standing for
/// it, sorted by name as JavaScript's `localeCompare` does.
public func ownCategories(_ calendars: [OverviewCalendar]) -> [OwnCategory] {
    var seen: [String: OwnCategory] = [:]
    var order: [String] = []
    for c in calendars {
        guard let name = c.categoryName, !name.isEmpty, let purpose = c.purpose, !purpose.isEmpty else { continue }
        let key = name.lowercased()
        if seen[key] != nil { continue }
        seen[key] = OwnCategory(name: name, purpose: purpose)
        order.append(key)
    }
    return order.compactMap { seen[$0] }.sorted { localeOrder($0.name, $1.name) }
}

/// `a.localeCompare(b) < 0`, as Node and the web view order words.
func localeOrder(_ a: String, _ b: String) -> Bool {
    a.compare(b, options: [], range: nil, locale: Locale(identifier: "en_US")) == .orderedAscending
}

/// One brand's calendars in the list (`CalendarGroup`).
public struct CalendarGroup: Codable, Sendable, Equatable, Identifiable {
    /// The provider this group holds, which is also its stable key.
    public var id: String
    public var label: String
    public var calendars: [OverviewCalendar]
}

/// The brands the calendar list is grouped by, in the order they are shown.
private let brands: [(provider: String, label: String)] = [
    ("google", "Google"), ("outlook", "Outlook"), ("apple", "Apple"), ("ics", "Special"), ("device", "Phone"),
    ("builtin", "Built in"),
]

/// One group per brand, in a fixed order, the empty ones left out; a provider
/// this list doesn't know gets a group of its own at the end.
public func groupCalendarsByBrand(_ calendars: [OverviewCalendar]) -> [CalendarGroup] {
    var groups = brands.map { b in
        CalendarGroup(id: b.provider, label: b.label, calendars: calendars.filter { $0.provider == b.provider })
    }
    let known = Set(brands.map(\.provider))
    for c in calendars where !known.contains(c.provider) {
        if let i = groups.firstIndex(where: { $0.id == c.provider }) {
            groups[i].calendars.append(c)
        } else {
            groups.append(CalendarGroup(id: c.provider, label: c.provider, calendars: [c]))
        }
    }
    return groups.filter { !$0.calendars.isEmpty }
}

/// What a group's tick shows: all ticked, none, or a mix (the dash).
public enum GroupTick: String, Codable, Sendable {
    case all, none, some
}

public func groupVisibility(_ group: CalendarGroup) -> GroupTick {
    let unticked = group.calendars.filter { !$0.included }.count
    if unticked == 0 { return .all }
    return unticked == group.calendars.count ? .none : .some
}

/// How many holidays fall between `now` and a year ahead: the count beside the
/// built-in holiday calendar.
public func holidaysInYearAhead(_ timeZone: String, now: Int64) -> Int {
    let today = localDate(now, timeZone)
    let yearAhead = wallTime(today.year + 1, today.month, today.day, 0, timeZone)
    let last = localDate(yearAhead - 1, timeZone).year
    return (today.year...max(today.year, last)).reduce(0) { sum, year in
        sum + danishHolidays(year, timeZone).filter { $0.date >= now && $0.date < yearAhead }.count
    }
}

// MARK: - A change to one calendar

/// One change to one calendar, as the list and the tour make them (`CalendarChange`).
public enum CalendarChange: Sendable, Equatable {
    /// With a name, the owner's own category (#220); without, the name goes.
    case purpose(String?, categoryName: String? = nil)
    case priority(String)
    case included(Bool)
    /// A name of its owner's, or nil for the provider's own.
    case name(String?)
}

extension CalendarChange: Codable {
    enum CodingKeys: String, CodingKey { case purpose, categoryName, priority, included, name }

    /// The keys calendar-set-purpose reads, a nil written as null where it means something.
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .purpose(let purpose, let categoryName):
            try c.encode(purpose, forKey: .purpose)
            if let categoryName { try c.encode(categoryName, forKey: .categoryName) }
        case .priority(let priority): try c.encode(priority, forKey: .priority)
        case .included(let included): try c.encode(included, forKey: .included)
        case .name(let name): try c.encode(name, forKey: .name)
        }
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        if c.contains(.purpose) {
            self = .purpose(
                try c.decodeIfPresent(String.self, forKey: .purpose),
                categoryName: try c.decodeIfPresent(String.self, forKey: .categoryName))
        } else if let priority = try c.decodeIfPresent(String.self, forKey: .priority) {
            self = .priority(priority)
        } else if let included = try c.decodeIfPresent(Bool.self, forKey: .included) {
            self = .included(included)
        } else {
            self = .name(try c.decodeIfPresent(String.self, forKey: .name))
        }
    }
}

// MARK: - The guided setup (#221)

/// The slider, lowest first: not counting, then the three priorities.
public let tourStops = ["off", "skip", "normal", "never"]

/// What a card says about one calendar.
public struct TourChoice: Codable, Sendable, Equatable {
    public var purpose: String?
    public var categoryName: String?
    /// One of `tourStops`.
    public var stop: String

    public init(purpose: String?, categoryName: String?, stop: String) {
        self.purpose = purpose
        self.categoryName = categoryName
        self.stop = stop
    }
}

/// The calendars it goes through: every real one, those switched off too.
public func tourCalendars(_ calendars: [OverviewCalendar]) -> [OverviewCalendar] {
    calendars.filter { $0.provider != "builtin" }
}

public func choiceOf(_ c: OverviewCalendar) -> TourChoice {
    TourChoice(purpose: c.purpose, categoryName: c.categoryName, stop: c.included ? c.priority : "off")
}

/// What to save for a card. Confirming Casy's guess saves it too, so the AI
/// leaves it alone; having no category and leaving it so saves nothing.
public func changesFrom(_ c: OverviewCalendar, _ choice: TourChoice) -> [CalendarChange] {
    var changes: [CalendarChange] = []
    let sameCategory = choice.purpose == c.purpose && choice.categoryName == c.categoryName
    if !sameCategory || (c.purposeGuessed == true && choice.purpose != nil) {
        let named = choice.categoryName.flatMap { $0.isEmpty ? nil : $0 }
        changes.append(named.map { .purpose(choice.purpose, categoryName: $0) } ?? .purpose(choice.purpose))
    }
    if choice.stop == "off" {
        if c.included { changes.append(.included(false)) }
    } else {
        if !c.included { changes.append(.included(true)) }
        if choice.stop != c.priority { changes.append(.priority(choice.stop)) }
    }
    return changes
}

/// White on a calendar's colour ("r, g, b") while it reads at 3:1, as Apple's
/// blue does; near-black on anything lighter.
public func textOn(_ rgb: String) -> String {
    let parts = rgb.split(separator: ",").map { part -> Double in
        let c = (Double(part.trimmingCharacters(in: .whitespaces)) ?? 0) / 255
        return c <= 0.03928 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4)
    }
    let channel = { (i: Int) in i < parts.count ? parts[i] : 0 }
    let luminance = 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2)
    return luminance > 0.3 ? "#1c1c1e" : "#ffffff"
}

/// The calendars still wanting a look, which the Kalendere button counts:
/// counting, with no category or only Casy's guess, and not gone through yet.
public func unsortedCalendars(_ calendars: [OverviewCalendar], seen: Set<String>) -> [OverviewCalendar] {
    tourCalendars(calendars).filter {
        $0.included && ($0.purpose == nil || $0.purposeGuessed == true) && !seen.contains($0.id)
    }
}

/// What the tour goes through: only those wanting a look, or with none left, all of them.
public func tourSteps(_ calendars: [OverviewCalendar], seen: Set<String>) -> [OverviewCalendar] {
    let unsorted = unsortedCalendars(calendars, seen: seen)
    return unsorted.isEmpty ? tourCalendars(calendars) : unsorted
}

// MARK: - Accounts

/// How fresh an account's busy times are (`syncedAgo`).
public enum SyncedAgo: Sendable, Equatable {
    case justNow
    case minutes(Int)
    case hours(Int)
    case days(Int)

    /// From whole minutes ago.
    public init(minutes: Int) {
        if minutes < 1 {
            self = .justNow
        } else if minutes < 60 {
            self = .minutes(minutes)
        } else if minutes / 60 < 24 {
            self = .hours(minutes / 60)
        } else {
            self = .days(minutes / 60 / 24)
        }
    }

    public var minutes: Int {
        switch self {
        case .justNow: 0
        case .minutes(let n): n
        case .hours(let n): n * 60
        case .days(let n): n * 24 * 60
        }
    }
}

/// Nil when it never synced.
public func syncedAgo(_ iso: String?, now: Int64) -> SyncedAgo? {
    guard let iso, let at = parseInstant(iso) else { return nil }
    return SyncedAgo(minutes: Int(max(0, (now - at) / 60_000)))
}

/// An app-specific password's shape, abcd-efgh-ijkl-mnop, dashes or not: advice, never a block.
public func looksLikeAppSpecificPassword(_ value: String) -> Bool {
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    let letters = trimmed.unicodeScalars.allSatisfy { ("a"..."z").contains($0) || ("A"..."Z").contains($0) }
    if trimmed.count == 16 { return letters }
    let groups = trimmed.split(separator: "-", omittingEmptySubsequences: false)
    return groups.count == 4
        && groups.allSatisfy { $0.count == 4 && $0.unicodeScalars.allSatisfy { ("a"..."z").contains($0) || ("A"..."Z").contains($0) } }
}

/// What an app-specific password looks like, for showing people; not a real one.
public let appPasswordExample = "abcd-efgh-ijkl-mnop"
