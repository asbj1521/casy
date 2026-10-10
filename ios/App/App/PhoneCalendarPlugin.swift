import Capacitor
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
        if #available(iOS 17.0, *) {
            return status == .fullAccess ? "granted" : "denied"
        }
        return status == .authorized ? "granted" : "denied"
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
    private static func readable(_ store: EKEventStore) -> [EKCalendar] {
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

/// The phone's own calendars, read with EventKit: every account the phone
/// holds (iCloud, Google, Exchange, subscriptions) through one permission,
/// with no app-specific password. Registered by MainViewController and used
/// from the page through `src/lib/phoneCalendar.ts`. What counts as busy is
/// decided on the page (`phoneBusy.ts`), where it is tested; the background
/// refresh repeats those rules in PhoneCalendarBackground.swift.
@objc(PhoneCalendarPlugin)
public class PhoneCalendarPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PhoneCalendarPlugin"
    public let jsName = "PhoneCalendar"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "access", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAccess", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readDetails", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "backgroundState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setBackground", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearBackground", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "applyWrites", returnType: CAPPluginReturnPromise),
    ]

    /// One store for the app's life: EventKit only posts change notifications
    /// while a store exists, and making one asks for nothing by itself.
    private let store = EKEventStore()

    override public func load() {
        NotificationCenter.default.addObserver(
            self, selector: #selector(storeChanged), name: .EKEventStoreChanged, object: store)
    }

    /// Something in the phone's calendars changed (an event added here, or an
    /// account syncing in the background): the page decides whether to send it.
    @objc private func storeChanged() {
        notifyListeners("change", data: [:])
    }

    @objc func access(_ call: CAPPluginCall) {
        call.resolve(["state": PhoneCalendarReader.accessState()])
    }

    /// Shows iOS's own question once; after that iOS answers by itself with
    /// what the person chose, and only Settings can change it (openSettings).
    @objc func requestAccess(_ call: CAPPluginCall) {
        let done: (Bool, Error?) -> Void = { _, _ in
            call.resolve(["state": PhoneCalendarReader.accessState()])
        }
        if #available(iOS 17.0, *) {
            store.requestFullAccessToEvents(completion: done)
        } else {
            store.requestAccess(to: .event, completion: done)
        }
    }

    /// Casy's page in the Settings app, where calendar access is switched on.
    @objc func openSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url)
            }
            call.resolve()
        }
    }

    @objc func read(_ call: CAPPluginCall) {
        guard let from = call.getDouble("from"), let to = call.getDouble("to"), from < to else {
            call.reject("from and to are required")
            return
        }
        guard PhoneCalendarReader.accessState() == "granted" else {
            call.reject("Calendar access is not granted", "denied")
            return
        }
        DispatchQueue.global(qos: .userInitiated).async { [store] in
            let (calendars, events) = PhoneCalendarReader.read(store: store, from: from, to: to)
            call.resolve([
                "calendars": calendars.map {
                    [
                        "id": $0.id, "name": $0.name, "account": $0.account,
                        "subscribed": $0.subscribed, "writable": $0.writable,
                    ]
                },
                "events": events.map(PhoneCalendarReader.dictionary),
            ])
        }
    }

    /// Every event with its title, place and notes, for the app's own
    /// calendar views on this phone (src/lib/phoneEvents.ts). What `read`
    /// returns is what goes to the server; this never does.
    @objc func readDetails(_ call: CAPPluginCall) {
        guard let from = call.getDouble("from"), let to = call.getDouble("to"), from < to else {
            call.reject("from and to are required")
            return
        }
        guard PhoneCalendarReader.accessState() == "granted" else {
            call.reject("Calendar access is not granted", "denied")
            return
        }
        DispatchQueue.global(qos: .userInitiated).async { [store] in
            let events = PhoneCalendarReader.readDetails(store: store, from: from, to: to)
            call.resolve([
                "events": events.map { e -> [String: Any] in
                    var item = PhoneCalendarReader.dictionary(e.timing)
                    item["title"] = e.title
                    item["location"] = e.location
                    item["notes"] = e.notes
                    return item
                }
            ])
        }
    }

    /// Whether the background refresh has what it needs to send.
    @objc func backgroundState(_ call: CAPPluginCall) {
        call.resolve(["configured": PhoneCalendarBackground.isConfigured])
    }

    /// What the background refresh sends with: where, the site's public key,
    /// this phone's id and label, and the phone's own device token (kept in
    /// the Keychain). Starts the refresh.
    @objc func setBackground(_ call: CAPPluginCall) {
        guard let url = call.getString("url"), let apiKey = call.getString("apiKey"),
            let deviceId = call.getString("deviceId"), let label = call.getString("label"),
            let token = call.getString("token")
        else {
            call.reject("url, apiKey, deviceId, label and token are required")
            return
        }
        let saved = PhoneCalendarBackground.save(
            config: .init(url: url, apiKey: apiKey, deviceId: deviceId, label: label), token: token)
        if saved { PhoneCalendarBackground.schedule() }
        call.resolve(["configured": saved])
    }

    /// Carry out the server's calendar work (agreed events to add, change or
    /// take out) and look over the entries to check; answers the reports.
    @objc func applyWrites(_ call: CAPPluginCall) {
        guard PhoneCalendarReader.accessState() == "granted" else {
            call.reject("Calendar access is not granted", "denied")
            return
        }
        let tasks = call.getArray("tasks", [String: Any].self) ?? []
        let check = call.getArray("check", [String: Any].self) ?? []
        DispatchQueue.global(qos: .userInitiated).async { [store] in
            call.resolve([
                "reports": PhoneCalendarWriter.apply(store: store, tasks: tasks, check: check)
            ])
        }
    }

    /// Signed out, or this phone removed: nothing is sent in the background any more.
    @objc func clearBackground(_ call: CAPPluginCall) {
        PhoneCalendarBackground.clear()
        call.resolve()
    }
}
