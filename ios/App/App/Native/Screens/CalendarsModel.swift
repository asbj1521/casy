import CasyAPI
import CasyCore
import CasyUI
import EventKit
import SwiftUI

/// How the page's send of the phone's calendars went (`NativePhoneSync`).
struct PhoneSyncOutcome {
    /// "synced", "denied", "gone", "skipped" or "failed".
    var state: String
    var calendars = 0
    var busyBlocks = 0
    var error: String?
    /// This phone's connection as the page knows it after the send.
    var connectionId: String?
}

/// Your calendars (#200), shared by Kalendere, Forbundne kalendere and the
/// tour: the list as calendar-busy gives it over the months searched, the
/// accounts as calendar-status does, and the primary calendar. What the page
/// keeps on this phone (the holidays' tick, the calendars the tour has been
/// through, this phone's own connection) comes with the sheet's opening and
/// goes back as it changes; every change to your calendars is told to the
/// page (`onChanged`), which fetches its own copies again.
@MainActor @Observable
final class CalendarsModel {
    static let shared = CalendarsModel()

    private(set) var data: OverviewData?
    private(set) var connections: [CalendarConnection]?
    private(set) var primary: PrimaryCalendar?
    private(set) var primaryKnown = false
    /// Why the primary calendar didn't load, as the server said it.
    private(set) var primaryFailure: String?
    private(set) var failure: String?
    /// This phone's calendars in Apple Calendar's colours, which win (#220).
    private(set) var phoneColors: [String: String] = [:]
    /// Why the last tick didn't save, if it didn't.
    var visibilityFailure: String?
    /// The holidays in the year ahead, counted as the list is fetched.
    private var holidayCount = 0

    private(set) var holidaysHidden = false
    private(set) var tourSeen: Set<String> = []
    /// This phone's own connection, once it sends its calendars.
    private(set) var thisPhone: String?
    /// A provider picked before arriving (`?connect=apple`): its form opens once.
    private var connectOnce: String?

    /// The bridge's: tell the page a choice it keeps, that the calendars changed,
    /// ask it to send the phone's calendars, and that this phone was removed.
    var onPrefs: ((_ holidaysHidden: Bool?, _ tourSeen: [String]?) -> Void)?
    var onChanged: (() -> Void)?
    var syncPhone: ((_ create: Bool) async -> PhoneSyncOutcome)?
    var onPhoneForgotten: (() -> Void)?

    func reset() {
        data = nil
        connections = nil
        primary = nil
        primaryKnown = false
        failure = nil
        phoneColors = [:]
        visibilityFailure = nil
    }

    /// What the page handed over as the sheet opened.
    func begin(holidaysHidden: Bool, tourSeen: [String], thisPhone: String?, connect: String?) {
        connectOnce = connect
        self.holidaysHidden = holidaysHidden
        self.tourSeen = Set(tourSeen)
        self.thisPhone = thisPhone
        visibilityFailure = nil
    }

    /// The provider picked before arriving, the first time it is asked for.
    func takeConnect() -> String? {
        defer { connectOnce = nil }
        return connectOnce
    }

    /// Every calendar with its tick: the built-in holidays first, named in the reader's language.
    var calendars: [OverviewCalendar] {
        guard let data else { return [] }
        return [
            .holidays(
                name: CasyStrings.calendarsHolidayCalendar, total: holidayCount,
                included: !holidaysHidden)
        ] + data.calendars
    }

    /// Only the connected ones.
    var connectedCount: Int? { data?.calendars.count }

    /// "r, g, b" for each, as My calendar colours it.
    var colors: [String: String] { calendarColors(data?.calendars ?? [], own: phoneColors) }

    func color(_ calendarId: String) -> String { colors[calendarId] ?? "113, 113, 122" }

    /// The calendars still wanting a look, which Kalendere counts.
    var toSort: Int { unsortedCalendars(calendars, seen: tourSeen).count }

    /// The months every search looks at: the list's totals count them.
    private static var window: (from: String, to: String) {
        let month = startOfMonth(Native.now, appTimeZone)
        return (isoString(month), isoString(startOfMonth(month, appTimeZone, 12)))
    }

    func load() async {
        guard let api = await Native.api() else {
            failure = CasyStrings.loadCalendarsFailed
            return
        }
        let window = Self.window
        async let busy = api.calendarBusy(from: window.from, to: window.to, errorMessage: CasyStrings.loadCalendarsFailed)
        async let status = api.calendarConnections(errorMessage: CasyStrings.addToCalendarLoadStatusFailed)
        async let chosen = api.primaryCalendar(errorMessage: CasyStrings.addToCalendarLoadPrimaryFailed)
        do {
            let fresh = try await busy
            holidayCount = holidaysInYearAhead(appTimeZone, now: Native.now)
            data = fresh
            failure = nil
            phoneColors = await Task.detached(priority: .userInitiated) {
                DayOfCalendar.phoneColors(fresh.calendars)
            }.value
        } catch {
            if data == nil { failure = error.localizedDescription }
        }
        if let fresh = try? await status { connections = fresh }
        do {
            primary = try await chosen
            primaryKnown = true
            primaryFailure = nil
        } catch {
            primaryFailure = error.localizedDescription
            print("calendar-primary failed:", error)
        }
    }

    /// Only the accounts and the primary calendar, after connecting, removing or syncing.
    func loadAccounts() async {
        guard let api = await Native.api() else { return }
        async let status = api.calendarConnections()
        async let chosen = api.primaryCalendar()
        if let fresh = try? await status { connections = fresh }
        do {
            primary = try await chosen
            primaryKnown = true
            primaryFailure = nil
        } catch {
            primaryFailure = error.localizedDescription
            print("calendar-primary failed:", error)
        }
    }

    /// Tick or untick calendars: one, or a whole brand group. The tick moves at
    /// once and back if saving fails; the holidays' stays on this phone.
    func setVisible(_ ids: [String], _ visible: Bool) async {
        visibilityFailure = nil
        if ids.contains(holidayCalendarId) {
            holidaysHidden = !visible
            onPrefs?(!visible, nil)
        }
        let connected = ids.filter { $0 != holidayCalendarId }
        guard !connected.isEmpty, let before = data else { return }
        data?.calendars = before.calendars.map { c in
            var c = c
            if connected.contains(c.id) { c.included = visible }
            return c
        }
        do {
            guard let api = await Native.api() else { throw APIError.failed(status: 401, message: CasyStrings.calendarsSaveIncludedFailed) }
            try await withThrowingTaskGroup(of: Void.self) { group in
                for id in connected {
                    group.addTask {
                        try await api.updateCalendar(id, .included(visible), errorMessage: CasyStrings.calendarsSaveIncludedFailed)
                    }
                }
                try await group.waitForAll()
            }
        } catch {
            data?.calendars = before.calendars
            visibilityFailure = error.localizedDescription
        }
        await settled()
    }

    /// One change to one calendar, its own words for a failure, then everything as it is now.
    func update(_ calendarId: String, _ change: CalendarChange) async throws {
        guard let api = await Native.api() else { throw APIError.failed(status: 401, message: Self.failure(change)) }
        try await api.updateCalendar(calendarId, change, errorMessage: Self.failure(change))
        await settled()
    }

    /// Several saved together and nothing fetched (the tour); `settled()` afterwards.
    func save(_ calendarId: String, _ changes: [CalendarChange]) async throws {
        guard let api = await Native.api() else { throw APIError.failed(status: 401, message: CasyStrings.calendarsSaveCategoryFailed) }
        for change in changes {
            try await api.updateCalendar(calendarId, change, errorMessage: Self.failure(change))
        }
    }

    private static func failure(_ change: CalendarChange) -> String {
        switch change {
        case .purpose: CasyStrings.calendarsSaveCategoryFailed
        case .priority: CasyStrings.calendarsSavePriorityFailed
        case .included: CasyStrings.calendarsSaveIncludedFailed
        case .name: CasyStrings.calendarsSaveNameFailed
        }
    }

    /// After anything that changed your calendars: the list here, and the page's.
    func settled() async {
        await load()
        onChanged?()
    }

    /// The tour has been through one: Kalendere stops counting it.
    func seen(_ calendarId: String) {
        tourSeen.insert(calendarId)
        onPrefs?(nil, Array(tourSeen))
    }

    // MARK: - Accounts

    /// The phone's calendars sent by the page: connecting it, or once more now.
    func sendPhone(create: Bool) async -> PhoneSyncOutcome {
        let outcome =
            await syncPhone?(create)
            ?? PhoneSyncOutcome(state: "failed", error: CasyStrings.phoneSaveFailed, connectionId: thisPhone)
        thisPhone = outcome.connectionId
        // The labels follow this phone's connection (#282).
        LabelsWork.shared.thisPhone = outcome.connectionId
        await settled()
        return outcome
    }

    /// Every account fetched now, the phone's first: only its app can send it.
    func syncAll() async throws -> [Bool] {
        var outcomes: [Bool] = []
        if thisPhone != nil {
            let phone = await syncPhone?(false)
            outcomes.append(phone?.state == "synced")
        }
        guard let api = await Native.api() else { throw APIError.failed(status: 401, message: CasyStrings.syncFailed) }
        defer { Task { await settled() } }
        outcomes += try await api.syncCalendars(errorMessage: CasyStrings.syncFailed).map(\.ok)
        return outcomes
    }

    func remove(_ account: CalendarConnection) async throws {
        guard let api = await Native.api() else { throw APIError.failed(status: 401, message: CasyStrings.removeAccountFailed) }
        try await api.disconnectCalendar(account.id, errorMessage: CasyStrings.removeAccountFailed)
        // Removing this phone's own connection also stops it sending.
        if account.id == thisPhone {
            thisPhone = nil
            LabelsWork.shared.thisPhone = nil
            onPhoneForgotten?()
        }
        await settled()
    }

    func addLink(url: String, name: String) async throws -> LinkAdded {
        guard let api = await Native.api() else { throw APIError.failed(status: 401, message: CasyStrings.addLinkFailed) }
        let added = try await api.addCalendarLink(url: url, name: name, errorMessage: CasyStrings.addLinkFailed)
        await settled()
        return added
    }

    func connectApple(email: String, password: String) async throws -> AppleConnected {
        guard let api = await Native.api() else { throw APIError.failed(status: 401, message: CasyStrings.connectAppleFailed) }
        let added = try await api.connectApple(username: email, password: password, errorMessage: CasyStrings.connectAppleFailed)
        await settled()
        return added
    }

    /// A calendar made primary, or nil to stop using one.
    func setPrimary(_ calendarId: String?) async throws {
        guard let api = await Native.api() else { throw APIError.failed(status: 401, message: CasyStrings.addToCalendarSetPrimaryFailed) }
        primary = try await api.setPrimaryCalendar(calendarId, errorMessage: CasyStrings.addToCalendarSetPrimaryFailed)
        primaryKnown = true
        onChanged?()
    }

    func setAutoAdd(_ on: Bool) async throws {
        guard let api = await Native.api() else { throw APIError.failed(status: 401, message: CasyStrings.primaryAutoAddFailed) }
        primary = try await api.setAutoAdd(on, errorMessage: CasyStrings.primaryAutoAddFailed)
        onChanged?()
    }
}
