import CasyAPI
import CasyCore
import CasyUI
import EventKit
import Foundation
import UIKit

/// The phone's calendars kept current in Casy by the app itself (#282; the
/// web's usePhoneCalendarSync and syncPhone): the server can't fetch them, so
/// the app reads them and sends the busy blocks (CasyCore's phoneBusy) when it
/// opens, when it comes back (at most every two minutes) and when the phone's
/// calendars change, once this phone is connected. "Connect this phone"
/// (Kalendere) makes the connection. After a send, the server's calendar work
/// for this phone is carried out (agreed events into a primary calendar on it,
/// #105; PhoneCalendarWriter) and reported. The phone's own token is fetched
/// for the background refresh between opens (PhoneCalendarBackground).
///
/// The phone's id and its connection were the page's: it hands them over with
/// `setSession`, and hears of a new or lost connection (`connection`).
@MainActor
final class PhoneSyncWork {
    static let shared = PhoneSyncWork()

    static var on: Bool { AppCoordinator.nativeLabels }

    /// Tells the page this phone's connection for someone (nil: none any more).
    var connection: (_ userId: String, _ connectionId: String?) -> Void = { _, _ in }
    /// Tells the page and the native screens Casy's calendars changed.
    var changed: () -> Void = {}

    private var userId: String?
    private var lastSent: Date = .distantPast
    private var settle: Task<Void, Never>?
    private var running: Task<PhoneSyncOutcome, Never>?
    private var watching: [NSObjectProtocol] = []

    private static let minGap: TimeInterval = 2 * 60
    private static let changeSettle: Duration = .seconds(10)
    private static let deviceKey = "casy.phone.deviceId"
    private static func connectionKey(_ userId: String) -> String { "casy.phone.connection.\(userId)" }

    private init() {
        let center = NotificationCenter.default
        watching = [
            center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { _ in
                MainActor.assumeIsolated { PhoneSyncWork.shared.send(soon: true) }
            },
            center.addObserver(forName: .EKEventStoreChanged, object: nil, queue: .main) { _ in
                MainActor.assumeIsolated { PhoneSyncWork.shared.changedOnPhone() }
            },
        ]
    }

    // MARK: Who and which phone

    /// This phone's own random id: which phone a connection is.
    var deviceId: String {
        if let id = UserDefaults.standard.string(forKey: Self.deviceKey) { return id }
        let id = UUID().uuidString.lowercased()
        UserDefaults.standard.set(id, forKey: Self.deviceKey)
        return id
    }

    /// This phone's connection for the signed-in person, if it is connected.
    var thisPhone: String? { userId.flatMap { UserDefaults.standard.string(forKey: Self.connectionKey($0)) } }

    /// The page's phone id and connection kept where the app has none yet, before
    /// anyone signs in (PageCarryOver, #202): signing in then finds them.
    static func adopt(userId: String?, device: String?, connection: String?) {
        if UserDefaults.standard.string(forKey: deviceKey) == nil, let device, !device.isEmpty {
            UserDefaults.standard.set(device, forKey: deviceKey)
        }
        if let userId, UserDefaults.standard.string(forKey: connectionKey(userId)) == nil, let connection,
            !connection.isEmpty
        {
            UserDefaults.standard.set(connection, forKey: connectionKey(userId))
        }
    }

    /// Signed in (or out): the page's phone id and connection taken over where the
    /// app has none yet, then a send, as the page did on opening.
    func signedIn(_ userId: String?, pageDevice: String?, pageConnection: String?) {
        if UserDefaults.standard.string(forKey: Self.deviceKey) == nil, let pageDevice, !pageDevice.isEmpty {
            UserDefaults.standard.set(pageDevice, forKey: Self.deviceKey)
        }
        if let userId, UserDefaults.standard.string(forKey: Self.connectionKey(userId)) == nil, let pageConnection {
            UserDefaults.standard.set(pageConnection, forKey: Self.connectionKey(userId))
        }
        let fresh = userId != self.userId
        self.userId = userId
        LabelsWork.shared.thisPhone = thisPhone
        if fresh { send(soon: false) }
    }

    private func remember(_ connectionId: String?) {
        guard let userId else { return }
        UserDefaults.standard.set(connectionId, forKey: Self.connectionKey(userId))
        LabelsWork.shared.thisPhone = connectionId
        connection(userId, connectionId)
    }

    /// This phone's connection removed (Kalendere): nothing is sent any more, the background either.
    func forget() {
        remember(nil)
        PhoneCalendarBackground.clear()
    }

    // MARK: Sending

    /// A send now, if connected; `soon`: not within two minutes of the last.
    func send(soon: Bool) {
        guard Self.on, userId != nil, thisPhone != nil else { return }
        if soon && Date().timeIntervalSince(lastSent) < Self.minGap { return }
        Task { _ = await sync(create: false) }
    }

    /// The phone's calendars changed: a send once the rest of the change (an account syncing) is in.
    private func changedOnPhone() {
        settle?.cancel()
        settle = Task {
            try? await Task.sleep(for: Self.changeSettle)
            if !Task.isCancelled { send(soon: false) }
        }
    }

    /// Read the phone's calendars and send them. `create` is "Connect this phone":
    /// it asks for access if iOS hasn't yet, and makes the connection.
    func sync(create: Bool) async -> PhoneSyncOutcome {
        // A send under way is shared, unless this one connects and that one only updates (#132).
        if let running, !create { return await running.value }
        let before = running
        let task = Task { () -> PhoneSyncOutcome in
            _ = await before?.value
            return await run(create: create)
        }
        running = task
        let outcome = await task.value
        if running == task { running = nil }
        return outcome
    }

    private func run(create: Bool) async -> PhoneSyncOutcome {
        lastSent = Date()
        let readable = { () -> Bool in
            let s = EKEventStore.authorizationStatus(for: .event)
            return s == .fullAccess || s == .authorized
        }
        if create && !readable() { _ = try? await EKEventStore().requestFullAccessToEvents() }
        guard readable() else { return PhoneSyncOutcome(state: "denied") }
        guard let api = await Native.api(), let session = await SessionBox.shared.current() else {
            return PhoneSyncOutcome(state: "failed", error: CasyStrings.phoneSaveFailed)
        }

        let window = phoneWindow(Native.now)
        // A store of its own: one made before the calendars were allowed sees none.
        let store = EKEventStore()
        let (calendars, events) = PhoneCalendarReader.read(store: store, from: Double(window.from), to: Double(window.to))
        let read = PhoneRead(
            calendars: calendars.map {
                PhoneCalendar(id: $0.id, name: $0.name, account: $0.account, subscribed: $0.subscribed, writable: $0.writable)
            },
            events: events.map {
                PhoneEvent(
                    calendarId: $0.calendarId, allDay: $0.allDay, free: $0.free, cancelled: $0.cancelled,
                    declined: $0.declined, start: $0.start.map { Int64($0) }, end: $0.end.map { Int64($0) },
                    startDay: $0.startDay, endDay: $0.endDay)
            })
        let pushes = phoneBusy(read, window)
        // No calendars at all is more likely a hiccup than the truth.
        if !create && pushes.isEmpty { return PhoneSyncOutcome(state: "skipped") }

        let label = UIDevice.current.userInterfaceIdiom == .pad ? "iPad" : "iPhone"
        let result: PhonePush
        do {
            result = try await api.pushPhoneCalendars(
                deviceId: deviceId, label: label, create: create,
                issueToken: !PhoneCalendarBackground.isConfigured, calendars: pushes,
                errorMessage: CasyStrings.phoneSaveFailed)
        } catch {
            return PhoneSyncOutcome(state: "failed", error: error.localizedDescription, connectionId: thisPhone)
        }
        if result.gone == true {
            forget()
            return PhoneSyncOutcome(state: "gone")
        }
        remember(result.connectionId)
        if let token = result.deviceToken {
            let saved = PhoneCalendarBackground.save(
                config: .init(
                    url: session.projectURL.absoluteString, apiKey: session.apiKey, deviceId: deviceId, label: label),
                token: token)
            if saved { PhoneCalendarBackground.schedule() }
        }
        changed()
        CategorizeWork.shared.kick()
        LabelsWork.shared.kick()
        // Agreed events for a primary calendar on this phone (#105): never at the cost of the send.
        await writeCalendar(api, store: store)
        return PhoneSyncOutcome(
            state: "synced", calendars: result.calendars ?? 0, busyBlocks: result.busyBlocks ?? 0,
            connectionId: result.connectionId)
    }

    /// The server's calendar work for this phone, carried out and reported back.
    private func writeCalendar(_ api: EdgeFunctions, store: EKEventStore) async {
        guard let work = try? await api.phoneWritesToDo(deviceId: deviceId), work.gone != true else { return }
        let tasks = work.tasks.compactMap(\.anyObject) as? [[String: Any]] ?? []
        let check = work.check.compactMap(\.anyObject) as? [[String: Any]] ?? []
        if tasks.isEmpty && check.isEmpty { return }
        let reports = PhoneCalendarWriter.apply(store: store, tasks: tasks, check: check)
        guard !reports.isEmpty, let sent = JSONValue(any: reports) else { return }
        if (try? await api.reportPhoneWrites(deviceId: deviceId, reports: sent)) != nil { changed() }
    }
}

extension JSONValue {
    /// As JSONSerialization reads it, for what takes plain dictionaries (the calendar writer).
    var anyObject: Any? {
        guard let data = try? JSONEncoder().encode(self) else { return nil }
        return try? JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed])
    }

    /// From what JSONSerialization can write.
    init?(any: Any) {
        guard JSONSerialization.isValidJSONObject(any), let data = try? JSONSerialization.data(withJSONObject: any),
            let value = try? JSONDecoder().decode(JSONValue.self, from: data)
        else { return nil }
        self = value
    }
}
