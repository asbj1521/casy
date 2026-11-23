// Sorting calendars with AI in the background (#118): src/lib/autoCategorize.ts.
// Which calendars still need a category, and a few of this phone's event titles
// per calendar to sort them by. Pure; the app calls calendar-categorize
// (Background/Categorize.swift), which checks everything again.

import Foundation

/// A linked account as the sorting reads it (`CalendarConnectionStatus`, its own keys).
public struct SortConnection: Codable, Sendable, Equatable {
    public var id: String
    /// "pending", "connected" or "error".
    public var status: String
    public var calendar_sources: [SortSource]

    public init(id: String, status: String, calendar_sources: [SortSource]) {
        self.id = id
        self.status = status
        self.calendar_sources = calendar_sources
    }
}

public struct SortSource: Codable, Sendable, Equatable {
    public var id: String
    public var purpose: String?
    public var purpose_source: String?
    public var external_id: String?

    public init(id: String, purpose: String?, purpose_source: String?, external_id: String?) {
        self.id = id
        self.purpose = purpose
        self.purpose_source = purpose_source
        self.external_id = external_id
    }
}

/// Titles sent per calendar (the server keeps at most as many).
public let sampleTitlesPerCalendar = 15

/// The calendars nobody has categorised: no category, and no record of anyone setting one.
public func uncategorised(_ connections: [SortConnection]) -> [String] {
    connections.filter { $0.status == "connected" }
        .flatMap(\.calendar_sources)
        .filter { $0.purpose == nil && $0.purpose_source == nil }
        .map(\.id)
}

/// The server's id for each of this phone's calendars, by EventKit id.
public func phoneSourceIds(_ connections: [SortConnection], _ connectionId: String) -> [String: String] {
    var ids: [String: String] = [:]
    for c in connections where c.id == connectionId {
        for s in c.calendar_sources { if let e = s.external_id, !e.isEmpty { ids[e] = s.id } }
    }
    return ids
}

/// Up to `sampleTitlesPerCalendar` distinct titles for each wanted calendar,
/// those nearest `now` first, cancelled events left out.
public func sampleTitles(
    _ events: [PhoneEventWithDetails], _ serverIdOf: [String: String], wanted: Set<String>, now: Int64
) -> [String: [String]] {
    func when(_ e: PhoneEventWithDetails) -> Int64 {
        if let start = e.event.start { return start }
        if let day = e.event.startDay, let noon = parseInstant("\(day)T12:00:00Z") { return noon }
        // Date.parse of a day that isn't one is NaN, which sorts as JavaScript's does: kept in place.
        return e.event.startDay == nil ? now : Int64.min
    }
    // Stable, as the web's sort: equally near keeps the phone's order.
    let nearest = events.enumerated().sorted { a, b in
        let da = when(a.element), db = when(b.element)
        if da == Int64.min || db == Int64.min { return a.offset < b.offset }
        let na = abs(da - now), nb = abs(db - now)
        return na != nb ? na < nb : a.offset < b.offset
    }.map(\.element)
    var titles: [String: [String]] = [:]
    for event in nearest {
        guard let id = serverIdOf[event.event.calendarId], wanted.contains(id),
            let title = event.title?.trimmingCharacters(in: .whitespacesAndNewlines), !title.isEmpty,
            !event.event.cancelled
        else { continue }
        var list = titles[id] ?? []
        if list.count < sampleTitlesPerCalendar && !list.contains(title) { list.append(title) }
        titles[id] = list
    }
    return titles
}

/// The kind of account behind each calendar asked about, by the server's id (#220).
public func accountKindsFor(
    _ info: [(id: String, accountKind: String)], _ serverIdOf: [String: String], pending: Set<String>
) -> [String: String] {
    var kinds: [String: String] = [:]
    for calendar in info {
        if let id = serverIdOf[calendar.id], pending.contains(id) { kinds[id] = calendar.accountKind }
    }
    return kinds
}
