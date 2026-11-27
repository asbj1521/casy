import EventKit
import UIKit

/// One calendar on the phone, as read.
struct PhoneCalendarInfo {
    let id: String
    let name: String
    let account: String
    let subscribed: Bool
    /// The phone lets Casy add events to it (not a subscription or a read-only share).
    let writable: Bool
}

/// One event's timing: all that is sent to the server.
struct PhoneEventInfo {
    let calendarId: String
    let allDay: Bool
    let free: Bool
    let cancelled: Bool
    let declined: Bool
    /// Timed events: epoch ms.
    let start: Double?
    let end: Double?
    /// All-day events: the phone's calendar dates, end exclusive ("2026-10-12").
    let startDay: String?
    let endDay: String?
}

/// What the app's own calendar views show about an event, beside its timing.
/// Read only by `readDetails`, for the page on this phone: never part of what
/// `read` returns, which is what is sent to Casy's server.
struct PhoneEventDetails {
    let timing: PhoneEventInfo
    let title: String
    let location: String
    let notes: String
}

/// The theme chosen in Settings (#129): "light", "dark", or "system" to follow
/// the phone. Applied to the app's whole interface, so the status bar, the
/// keyboard and the colour behind the page (LaunchBackground) follow it and the
/// page's own `prefers-color-scheme` says the same, and kept here so the
/// next launch starts in it, before the page has run.
enum AppAppearance {
    static let key = "casy.appearance"

    static func style(_ choice: String?) -> UIUserInterfaceStyle {
        switch choice {
        case "light": return .light
        case "dark": return .dark
        default: return .unspecified
        }
    }

    static func stored() -> UIUserInterfaceStyle {
        style(UserDefaults.standard.string(forKey: key))
    }
}

/// Reading the phone's calendars with EventKit, for the page (the plugin
/// below) and for the background refresh (PhoneCalendarBackground) alike.
///
/// `read` returns only timing: when an event starts and ends, whether it is
/// all-day, marked free, cancelled or declined, and which calendar it is in.
/// That is what the page and the background refresh send to the server.
/// `readDetails` adds the title, place and notes, for the app's own views on
/// this phone; attendees are never read.
enum PhoneCalendarReader {
    /// "granted", "prompt" (never asked) or "denied" (refused, restricted by a
    /// parent or a company, or only allowed to add events, which can't read).
    static func accessState() -> String {
        let status = EKEventStore.authorizationStatus(for: .event)
        if status == .notDetermined { return "prompt" }
        return status == .fullAccess ? "granted" : "denied"
    }

    /// A colour as the page writes one, "r, g, b"; whatever space EventKit
    /// keeps it in, in plain sRGB through UIColor.
    static func rgb(of color: CGColor?) -> String {
        guard let color else { return "" }
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        guard UIColor(cgColor: color).getRed(&red, green: &green, blue: &blue, alpha: nil) else {
            return ""
        }
        let channel = { (value: CGFloat) in Int((min(max(value, 0), 1) * 255).rounded()) }
        return "\(channel(red)), \(channel(green)), \(channel(blue))"
    }

    /// The kind of account a calendar belongs to, never its name or address.
    static func accountKind(of source: EKSource?) -> String {
        guard let source else { return "other" }
        switch source.sourceType {
        case .exchange: return "exchange"
        case .local: return "local"
        case .subscribed: return "subscribed"
        case .calDAV, .mobileMe: return source.title == "iCloud" ? "icloud" : "other"
        default: return "other"
        }
    }

    /// Every calendar on the phone and its events between `from` and `to`
    /// (epoch ms). Recurring events come back as their single occurrences.
    static func read(store: EKEventStore, from: Double, to: Double)
        -> (calendars: [PhoneCalendarInfo], events: [PhoneEventInfo])
    {
        let calendars = readable(store)
        let list = calendars.map {
            PhoneCalendarInfo(
                id: $0.calendarIdentifier,
                name: $0.title,
                account: $0.source?.title ?? "",
                subscribed: $0.type == .subscription,
                writable: $0.allowsContentModifications && !$0.isImmutable
                    && $0.type != .subscription)
        }
        let dates = DayDates()
        let events = occurrences(store: store, calendars: calendars, from: from, to: to)
            .compactMap { timing(of: $0, dates: dates) }
        return (list, events)
    }

    /// The same events with what they are: title, place and notes (notes cut
    /// at `notesLimit` characters; invitations can carry pages of dial-in
    /// text). For this phone's own views only.
    static func readDetails(store: EKEventStore, from: Double, to: Double) -> [PhoneEventDetails] {
        let dates = DayDates()
        return occurrences(store: store, calendars: readable(store), from: from, to: to)
            .compactMap { event in
                guard let timing = timing(of: event, dates: dates) else { return nil }
                return PhoneEventDetails(
                    timing: timing,
                    title: event.title ?? "",
                    location: event.location ?? "",
                    notes: String((event.notes ?? "").prefix(notesLimit)))
            }
    }

    static let notesLimit = 1000

    /// Birthdays are whole days every year; they would block everyone's
    /// birthday for the person, and aren't plans.
    static func readable(_ store: EKEventStore) -> [EKCalendar] {
        store.calendars(for: .event).filter { $0.type != .birthday }
    }

    private static func occurrences(
        store: EKEventStore, calendars: [EKCalendar], from: Double, to: Double
    ) -> [EKEvent] {
        if calendars.isEmpty { return [] }
        let predicate = store.predicateForEvents(
            withStart: Date(timeIntervalSince1970: from / 1000),
            end: Date(timeIntervalSince1970: to / 1000),
            calendars: calendars)
        return store.events(matching: predicate)
    }

    /// All-day events are dates, not instants: sent as the phone's own
    /// calendar dates (placed in Danish time afterwards, as the server does
    /// for dates in other calendars).
    private struct DayDates {
        let days = Calendar.current
        let format: DateFormatter

        init() {
            format = DateFormatter()
            format.calendar = Calendar(identifier: .gregorian)
            format.locale = Locale(identifier: "en_US_POSIX")
            format.timeZone = Calendar.current.timeZone
            format.dateFormat = "yyyy-MM-dd"
        }
    }

    private static func timing(of event: EKEvent, dates: DayDates) -> PhoneEventInfo? {
        guard let start = event.startDate, let end = event.endDate,
            let calendarId = event.calendar?.calendarIdentifier
        else { return nil }
        let declined =
            event.attendees?.contains {
                $0.isCurrentUser && $0.participantStatus == .declined
            } ?? false
        var startDay: String?
        var endDay: String?
        if event.isAllDay {
            // EventKit ends an all-day event at 23:59:59 on its last day;
            // the day after is the exclusive end expected.
            let days = dates.days
            let first = days.startOfDay(for: start)
            var after = days.startOfDay(for: end)
            if end > after { after = days.date(byAdding: .day, value: 1, to: after) ?? after }
            if after <= first { after = days.date(byAdding: .day, value: 1, to: first) ?? first }
            startDay = dates.format.string(from: first)
            endDay = dates.format.string(from: after)
        }
        return PhoneEventInfo(
            calendarId: calendarId,
            allDay: event.isAllDay,
            free: event.availability == .free,
            cancelled: event.status == .canceled,
            declined: declined,
            start: event.isAllDay ? nil : start.timeIntervalSince1970 * 1000,
            end: event.isAllDay ? nil : end.timeIntervalSince1970 * 1000,
            startDay: startDay,
            endDay: endDay)
    }

    /// An event's timing as the page reads it.
    static func dictionary(_ e: PhoneEventInfo) -> [String: Any] {
        var item: [String: Any] = [
            "calendarId": e.calendarId, "allDay": e.allDay, "free": e.free,
            "cancelled": e.cancelled, "declined": e.declined,
        ]
        if let start = e.start, let end = e.end {
            item["start"] = start
            item["end"] = end
        }
        if let startDay = e.startDay, let endDay = e.endDay {
            item["startDay"] = startDay
            item["endDay"] = endDay
        }
        return item
    }
}
