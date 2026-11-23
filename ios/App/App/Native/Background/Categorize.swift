import CasyAPI
import CasyCore
import EventKit
import Foundation
import UIKit

/// Calendars sorted with AI in the background (#118, #282; the web's
/// useAutoCategorize): a calendar nobody has given a category gets work,
/// school, personal or other, with a few of this phone's titles and its
/// account kind to go by. Never one whose category was picked or cleared by
/// hand: the server only fills untouched ones. Each calendar is asked about
/// at most once a launch, so a failing call isn't repeated in a loop; only
/// for someone who said yes to the AI or a tester.
@MainActor
final class CategorizeWork {
    static let shared = CategorizeWork()

    /// Whether the app sorts in this build (the page then doesn't): with the labels.
    static var on: Bool { NativeBridgePlugin.nativeLabels }

    /// Told when calendars got a category, for what shows them to read again.
    var changed: () -> Void = {}

    private var asked: Set<String> = []
    private var userId: String?
    private var running = false
    private var watching: [NSObjectProtocol] = []

    private init() {
        watching = [
            NotificationCenter.default.addObserver(
                forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main
            ) { _ in MainActor.assumeIsolated { CategorizeWork.shared.kick() } }
        ]
    }

    /// Signed in as `userId`: a new person starts with nothing asked.
    func signedIn(_ userId: String?) {
        if userId != self.userId {
            self.userId = userId
            asked = []
        }
        kick()
    }

    /// A look now: signed in, back in the app, or calendars connected or changed.
    func kick() {
        guard Self.on, !running, userId != nil else { return }
        running = true
        Task {
            defer { running = false }
            await run()
        }
    }

    private func run() async {
        guard let api = await Native.api(), let me = try? await api.whoAmI(),
            (me.aiTester ?? me.eventLabels) == true || me.aiConsent == true,
            let connections = try? await api.calendarConnections()
        else { return }
        let sorting = connections.map { c in
            SortConnection(
                id: c.id, status: c.status,
                calendar_sources: c.calendar_sources.map {
                    SortSource(id: $0.id, purpose: $0.purpose, purpose_source: $0.purpose_source, external_id: $0.external_id)
                })
        }
        let pending = uncategorised(sorting).filter { !asked.contains($0) }
        guard !pending.isEmpty else { return }
        asked.formUnion(pending)
        var titles: [String: [String]]?
        var kinds: [String: String]?
        let access = EKEventStore.authorizationStatus(for: .event)
        if let phone = LabelsWork.shared.thisPhone, access == .fullAccess || access == .authorized {
            let ids = phoneSourceIds(sorting, phone)
            let now = Native.now
            // A store of its own: one made before the calendars were allowed sees none.
            let store = EKEventStore()
            let events = PhoneCalendarReader.readDetails(
                store: store, from: Double(now - 60 * 86_400_000), to: Double(now + 120 * 86_400_000)
            ).map(LabelsWork.withDetails)
            titles = sampleTitles(events, ids, wanted: Set(pending), now: now)
            kinds = accountKindsFor(
                PhoneCalendarReader.readable(store).map { ($0.calendarIdentifier, PhoneCalendarReader.accountKind(of: $0.source)) },
                ids, pending: Set(pending))
        }
        guard let categorized = try? await api.categorizeCalendars(titles: titles, accountKinds: kinds),
            !categorized.isEmpty
        else { return }
        changed()
    }
}
