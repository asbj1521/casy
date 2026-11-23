#if DEBUG
    import EventKit
    import Foundation

    /// A phone calendar for the native labels' UI test (#282, `-casySeedPhone`):
    /// asks for calendar access (the test answers iOS's prompt), fills a
    /// "Casy test" calendar on this simulator with a few events, and tells the
    /// fake backend its EventKit id, so the backend lists it as this phone's.
    @MainActor
    enum TestPhone {
        static let connection = "conn-phone"
        static let titles = ["Eksamen i fysik", "Padel", "Tandlæge", "Fly til Oslo"]

        static func seed() async -> Bool {
            guard (try? await EKEventStore().requestFullAccessToEvents()) == true else { return false }
            // A store made after the yes: the one that asked sees no calendars yet.
            let store = EKEventStore()
            let name = "Casy test"
            let calendar =
                store.calendars(for: .event).first { $0.title == name }
                ?? {
                    let made = EKCalendar(for: .event, eventStore: store)
                    made.title = name
                    made.source =
                        store.sources.first { $0.sourceType == .local }
                        ?? store.defaultCalendarForNewEvents?.source
                    try? store.saveCalendar(made, commit: true)
                    return made
                }()
            // The same events every run: what is there already goes first.
            let now = Date(timeIntervalSince1970: Double(Native.now) / 1000)
            let old = store.events(
                matching: store.predicateForEvents(
                    withStart: now.addingTimeInterval(-30 * 86_400), end: now.addingTimeInterval(120 * 86_400),
                    calendars: [calendar]))
            for e in old { try? store.remove(e, span: .thisEvent, commit: false) }
            for (i, title) in titles.enumerated() {
                let e = EKEvent(eventStore: store)
                e.calendar = calendar
                e.title = title
                e.startDate = now.addingTimeInterval(Double(i + 2) * 86_400)
                e.endDate = e.startDate.addingTimeInterval(2 * 3600)
                try? store.save(e, span: .thisEvent, commit: false)
            }
            try? store.commit()
            guard let backend = TestLaunch.backend else { return false }
            var tell = URLRequest(url: backend.appendingPathComponent("reset"))
            tell.httpMethod = "POST"
            tell.httpBody = try? JSONSerialization.data(withJSONObject: [
                "phoneCalendar": ["externalId": calendar.calendarIdentifier, "name": name]
            ])
            return (try? await URLSession.shared.data(for: tell)) != nil
        }
    }
#endif
