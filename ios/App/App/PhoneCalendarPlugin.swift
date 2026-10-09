import Capacitor
import EventKit
import UIKit

/// The phone's own calendars, read with EventKit: every account the phone
/// holds (iCloud, Google, Exchange, subscriptions) through one permission,
/// with no app-specific password. Registered by MainViewController and used
/// from the page through `src/lib/phoneCalendar.ts`.
///
/// Only timing leaves this file: when an event starts and ends, whether it is
/// all-day, marked free, cancelled or declined, and which calendar it is in.
/// Titles, notes, places and attendees are never read into what is returned.
/// What counts as busy is decided on the page (`phoneBusy.ts`), where it is
/// tested, so the rules match the server's for every other calendar.
@objc(PhoneCalendarPlugin)
public class PhoneCalendarPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PhoneCalendarPlugin"
    public let jsName = "PhoneCalendar"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "access", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAccess", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise),
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

    /// "granted", "prompt" (never asked) or "denied" (refused, restricted by a
    /// parent or a company, or only allowed to add events, which can't read).
    private func accessState() -> String {
        let status = EKEventStore.authorizationStatus(for: .event)
        if status == .notDetermined { return "prompt" }
        if #available(iOS 17.0, *) {
            return status == .fullAccess ? "granted" : "denied"
        }
        return status == .authorized ? "granted" : "denied"
    }

    @objc func access(_ call: CAPPluginCall) {
        call.resolve(["state": accessState()])
    }

    /// Shows iOS's own question once; after that iOS answers by itself with
    /// what the person chose, and only Settings can change it (openSettings).
    @objc func requestAccess(_ call: CAPPluginCall) {
        let done: (Bool, Error?) -> Void = { [weak self] _, _ in
            call.resolve(["state": self?.accessState() ?? "denied"])
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

    /// Every calendar on the phone and its events between `from` and `to`
    /// (epoch ms). Recurring events come back as their single occurrences.
    @objc func read(_ call: CAPPluginCall) {
        guard let from = call.getDouble("from"), let to = call.getDouble("to"), from < to else {
            call.reject("from and to are required")
            return
        }
        guard accessState() == "granted" else {
            call.reject("Calendar access is not granted", "denied")
            return
        }
        DispatchQueue.global(qos: .userInitiated).async { [store] in
            // Birthdays are whole days every year; they would block everyone's
            // birthday for the person, and aren't plans.
            let calendars = store.calendars(for: .event).filter { $0.type != .birthday }
            let predicate = store.predicateForEvents(
                withStart: Date(timeIntervalSince1970: from / 1000),
                end: Date(timeIntervalSince1970: to / 1000),
                calendars: calendars)

            // All-day events are dates, not instants: sent as the phone's own
            // calendar dates (the page places them in Danish time, as the server
            // does for dates in other calendars).
            let days = Calendar.current
            let dayFormat = DateFormatter()
            dayFormat.calendar = Calendar(identifier: .gregorian)
            dayFormat.locale = Locale(identifier: "en_US_POSIX")
            dayFormat.timeZone = days.timeZone
            dayFormat.dateFormat = "yyyy-MM-dd"

            var events: [[String: Any]] = []
            for event in calendars.isEmpty ? [] : store.events(matching: predicate) {
                guard let start = event.startDate, let end = event.endDate,
                    let calendarId = event.calendar?.calendarIdentifier
                else { continue }
                var item: [String: Any] = [
                    "calendarId": calendarId,
                    "allDay": event.isAllDay,
                    "free": event.availability == .free,
                    "cancelled": event.status == .canceled,
                    "declined": event.attendees?.contains {
                        $0.isCurrentUser && $0.participantStatus == .declined
                    } ?? false,
                ]
                if event.isAllDay {
                    // EventKit ends an all-day event at 23:59:59 on its last day;
                    // the day after is the exclusive end the page expects.
                    let first = days.startOfDay(for: start)
                    var after = days.startOfDay(for: end)
                    if end > after { after = days.date(byAdding: .day, value: 1, to: after) ?? after }
                    if after <= first { after = days.date(byAdding: .day, value: 1, to: first) ?? first }
                    item["startDay"] = dayFormat.string(from: first)
                    item["endDay"] = dayFormat.string(from: after)
                } else {
                    item["start"] = start.timeIntervalSince1970 * 1000
                    item["end"] = end.timeIntervalSince1970 * 1000
                }
                events.append(item)
            }

            let list: [[String: Any]] = calendars.map {
                [
                    "id": $0.calendarIdentifier,
                    "name": $0.title,
                    "account": $0.source?.title ?? "",
                    "subscribed": $0.type == .subscription,
                ]
            }
            call.resolve(["calendars": list, "events": events])
        }
    }
}
