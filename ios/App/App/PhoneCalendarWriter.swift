import EventKit
import Foundation

/// Agreed events in the phone's own calendar (#105): carries out the work the
/// server hands out (calendar-phone's `writes`, built by phoneWrites.ts) and
/// says how each piece went, for `written`. Used by the page, through the
/// plugin's applyWrites, and by the background refresh alike.
///
/// Every entry carries a link back to its event (its URL). That is how an
/// entry is found when iOS has changed its id, and how a second "add" after a
/// lost answer finds the first instead of making a copy.
enum PhoneCalendarWriter {
    /// The start of every link Casy puts on its entries (eventUrl in phoneWrites.ts).
    static let casyPrefix = "https://casy.app/events/"

    /// Do `tasks` and look over `check`; one report per change to tell the server.
    static func apply(store: EKEventStore, tasks: [[String: Any]], check: [[String: Any]])
        -> [[String: Any]]
    {
        var found = CasyEntries(store: store)
        var reports: [[String: Any]] = []

        for task in tasks {
            guard let op = task["op"] as? String, let proposalId = task["proposalId"] as? String
            else { continue }
            let url = task["url"] as? String ?? ""
            let existing = found.entry(id: task["eventId"] as? String, url: url)
            do {
                switch op {
                case "add", "update":
                    guard let entry = task["entry"] as? [String: Any] else { continue }
                    if op == "update" && existing == nil {
                        // Not there to change: deleted by hand.
                        reports.append(["proposalId": proposalId, "outcome": "gone"])
                        continue
                    }
                    let calendarId = task["calendarId"] as? String ?? ""
                    let event: EKEvent
                    if let existing {
                        event = existing
                    } else {
                        guard let calendar = store.calendar(withIdentifier: calendarId) else {
                            throw WriteError.noCalendar
                        }
                        event = EKEvent(eventStore: store)
                        event.calendar = calendar
                    }
                    try fill(event, entry: entry, url: url)
                    try store.save(event, span: .thisEvent, commit: true)
                    found.remember(event, url: url)
                    reports.append([
                        "proposalId": proposalId,
                        "outcome": op == "add" ? "added" : "updated",
                        "eventId": event.calendarItemIdentifier,
                    ])
                case "remove":
                    if let existing {
                        try store.remove(existing, span: .thisEvent, commit: true)
                        found.forget(url: url)
                    }
                    reports.append(["proposalId": proposalId, "outcome": "removed"])
                default:
                    continue
                }
            } catch {
                reports.append(["proposalId": proposalId, "outcome": "failed"])
            }
        }

        // Entries that should be there: gone if deleted by hand, but only
        // judged while their calendar is on the phone at all.
        for item in check {
            guard let proposalId = item["proposalId"] as? String,
                let calendarId = item["calendarId"] as? String,
                store.calendar(withIdentifier: calendarId) != nil
            else { continue }
            let id = item["eventId"] as? String
            let url = item["url"] as? String ?? ""
            if let id, store.calendarItem(withIdentifier: id) is EKEvent { continue }
            if let moved = found.entry(id: nil, url: url) {
                // There, under a new id: remembered, so it can be changed later.
                reports.append([
                    "proposalId": proposalId, "outcome": "updated",
                    "eventId": moved.calendarItemIdentifier,
                ])
            } else {
                reports.append(["proposalId": proposalId, "outcome": "gone"])
            }
        }
        return reports
    }

    private enum WriteError: Error {
        case noCalendar
        case badTime
    }

    private static let isoWithFraction: ISO8601DateFormatter = {
        let format = ISO8601DateFormatter()
        format.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return format
    }()
    private static let iso = ISO8601DateFormatter()

    private static func instant(_ text: Any?) -> Date? {
        guard let text = text as? String else { return nil }
        return isoWithFraction.date(from: text) ?? iso.date(from: text)
    }

    /// A "YYYY-MM-DD" date at the start of that day on the phone.
    private static func day(_ text: Any?) -> Date? {
        guard let text = text as? String else { return nil }
        let parts = text.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return Calendar.current.date(
            from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }

    /// The entry's words and times, as the server wrote them (eventIcs.ts).
    private static func fill(_ event: EKEvent, entry: [String: Any], url: String) throws {
        event.title = entry["title"] as? String ?? "Casy"
        event.location = entry["location"] as? String
        event.notes = entry["notes"] as? String
        event.url = URL(string: url)
        event.availability = .busy
        if entry["allDay"] as? Bool == true {
            // Whole days: EventKit wants the last day itself as the end.
            guard let first = day(entry["startDay"]), let after = day(entry["endDay"]),
                after > first
            else { throw WriteError.badTime }
            event.isAllDay = true
            event.timeZone = nil
            event.startDate = first
            event.endDate = after.addingTimeInterval(-1)
        } else {
            guard let start = instant(entry["start"]), let end = instant(entry["end"]), end > start
            else { throw WriteError.badTime }
            event.isAllDay = false
            event.startDate = start
            event.endDate = end
        }
    }
}

/// Casy's entries on the phone, found by id or, failing that, by their link.
/// The search by link reads the calendars once, and only if it is needed.
private struct CasyEntries {
    let store: EKEventStore
    private var byUrl: [String: EKEvent]?

    init(store: EKEventStore) {
        self.store = store
    }

    mutating func entry(id: String?, url: String) -> EKEvent? {
        if let id, let event = store.calendarItem(withIdentifier: id) as? EKEvent {
            return event
        }
        return url.isEmpty ? nil : all()[url]
    }

    mutating func remember(_ event: EKEvent, url: String) {
        var map = all()
        map[url] = event
        byUrl = map
    }

    mutating func forget(url: String) {
        var map = all()
        map[url] = nil
        byUrl = map
    }

    /// Every entry carrying a Casy link, from a month back to well over a year ahead.
    private mutating func all() -> [String: EKEvent] {
        if let byUrl { return byUrl }
        let now = Date()
        let predicate = store.predicateForEvents(
            withStart: now.addingTimeInterval(-31 * 86_400),
            end: now.addingTimeInterval(400 * 86_400),
            calendars: nil)
        var map: [String: EKEvent] = [:]
        for event in store.events(matching: predicate) {
            if let link = event.url?.absoluteString, link.hasPrefix(PhoneCalendarWriter.casyPrefix) {
                map[link] = event
            }
        }
        byUrl = map
        return map
    }
}
