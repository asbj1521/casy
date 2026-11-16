#if DEBUG
    import CasyCore
    import CasyUI
    import Foundation
    import UIKit

    /// How the UI tests start a native screen signed in, against the fake
    /// backend (scripts/native/ui-tests.sh). A Debug build only: a Release
    /// build can't be pointed anywhere but the real project.
    ///
    /// `-casyBackend <url>` lends a made-up login, `-casyOpenScreen <name>`
    /// opens a screen, `-casyPushPermission <prompt|granted|denied>` answers
    /// for iOS, whose real prompt shows once, `-casyLang <da|en>`, and
    /// `-casyNow <ISO instant>` fixes the clock the event rules read.
    /// `-casyOpenScreen calendars:accounts` opens Kalendere on one of its
    /// screens, and `-casyPhoneSync <synced|denied>` answers for the page when
    /// it is asked to send the phone's calendars.
    enum TestLaunch {
        private static let defaults = UserDefaults.standard

        static var backend: URL? {
            defaults.string(forKey: "casyBackend").flatMap(URL.init(string:))
        }
        static var isActive: Bool { backend != nil }
        static var screen: String? { defaults.string(forKey: "casyOpenScreen") }
        static var pushPermission: String? { defaults.string(forKey: "casyPushPermission") }
        /// `-casyPushAnswer <granted|denied|failed>`: how turning notifications on goes, without the page.
        static var pushAnswer: String? { defaults.string(forKey: "casyPushAnswer") }
        static var lang: String? { defaults.string(forKey: "casyLang") }
        /// `-casyTheme <light|dark>`: Casy's own light or dark, for screenshots.
        static var theme: String? { defaults.string(forKey: "casyTheme") }
        static var phoneSync: String { defaults.string(forKey: "casyPhoneSync") ?? "synced" }

        /// `-casyTrip <trip|return|home>`: the trip sheet on a made-up trip, as
        /// the page would send it; its answers change it here as the page would.
        @MainActor static var trip: TripMark? { sample(defaults.string(forKey: "casyTrip")) }

        @MainActor private static func sample(_ kind: String?) -> TripMark? {
            let out = Leg(
                id: "leg-out", mode: "flight", from: "copenhagen", to: "rome", start: day(12, 7), end: day(12, 10),
                count: 1, names: .init(from: "Copenhagen", to: "Rome"))
            let home = Leg(
                id: "leg-home", mode: "train", from: "rome", to: "copenhagen", start: day(18, 15), end: day(19, 9),
                count: 1, names: .init(from: "Rome", to: "Copenhagen"))
            switch kind {
            case "trip":
                let trip = Trip(
                    id: out.id, start: out.start, end: home.end, legs: [out, home], answered: false, accepted: false,
                    city: nil, inCalendar: nil)
                return TripMark(kind: "trip", id: out.id, trip: trip, question: nil, start: trip.start, end: trip.end, city: "Rom")
            case "return":
                let question = TripQuestion(
                    kind: "return", id: out.id, legs: [out], cities: nil, earliest: out.end, latest: nil)
                return TripMark(
                    kind: "question", id: out.id, trip: nil, question: question, start: out.start, end: out.end, city: "Rom")
            case "home":
                let question = TripQuestion(
                    kind: "home", id: out.id, legs: [out, home], cities: ["copenhagen", "rome"], earliest: nil, latest: nil)
                return TripMark(
                    kind: "question", id: out.id, trip: nil, question: question, start: out.start, end: home.end,
                    city: "Rom")
            default: return nil
            }
        }

        /// `-casyPrime <group id>`: Tid til hinanden's sheet on Friday 16 October, 18:00 to 22:00.
        static var prime: PrimeDate? {
            defaults.string(forKey: "casyPrime").map {
                PrimeDate(
                    groupId: $0, kind: "hours", day: day(16, 0), start: day(16, 18), end: day(16, 22), value: 1)
            }
        }

        /// 10:00 on that day of October 2026, Danish time.
        private static func day(_ d: Int, _ hour: Double) -> Int64 { wallTime(2026, 9, d, hour, appTimeZone) }

        /// What the page would do with an answer: the trip as it then is.
        @MainActor static func answer(_ action: TripAction) {
            let model = TripModel.shared
            guard var mark = model.mark else { return }
            switch action {
            case .accept:
                mark.trip?.accepted = true
            case .returned(_, let back), .left(_, let back):
                guard let legs = mark.question?.legs, let first = legs.first else { return }
                mark = TripMark(
                    kind: "trip", id: mark.id,
                    trip: Trip(id: mark.id, start: first.start, end: back, legs: legs, answered: true, accepted: true, city: nil, inCalendar: nil),
                    question: nil, start: first.start, end: back, city: mark.city)
            case .home:
                mark = sample("trip") ?? mark
            case .addToCalendar:
                mark.trip?.inCalendar = true
                model.addedTo = "Kalender"
            case .decline:
                return
            }
            model.show(mark)
        }
        static var now: Int64? { defaults.string(forKey: "casyNow").flatMap(parseInstant) }

        /// `-casyTestPicture YES`: Fotobibliotek hands over a made-up photo, as
        /// the system's photo picker runs outside the app, where tests can't reach.
        static var samplePicture: UIImage? {
            guard defaults.bool(forKey: "casyTestPicture") else { return nil }
            return UIGraphicsImageRenderer(size: CGSize(width: 1200, height: 800)).image { context in
                UIColor.systemOrange.setFill()
                context.fill(CGRect(x: 0, y: 0, width: 1200, height: 800))
                UIColor.systemBlue.setFill()
                context.fill(CGRect(x: 400, y: 200, width: 400, height: 400))
            }
        }

        static func connection() -> SessionBox.Connection? {
            backend.map {
                SessionBox.Connection(
                    projectURL: $0, apiKey: "test-key", accessToken: "test-token",
                    expiresAt: .distantFuture, userId: "test-user", email: "test@example.com")
            }
        }
    }
#endif
