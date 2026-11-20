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
        /// The welcome opens on its animation, as the page does with
        /// `__casySkipIntro`, unless `-casyKeepIntro YES` asks for the intro.
        static var skipIntro: Bool { isActive && !defaults.bool(forKey: "casyKeepIntro") }
        static var screen: String? { defaults.string(forKey: "casyOpenScreen") }
        static var pushPermission: String? { defaults.string(forKey: "casyPushPermission") }
        /// `-casyPushAnswer <granted|denied|failed>`: how turning notifications on goes, without the page.
        static var pushAnswer: String? { defaults.string(forKey: "casyPushAnswer") }
        static var lang: String? { defaults.string(forKey: "casyLang") }
        /// `-casyAgreed <event id>`: that agreed event said on the home page however often it has been (#282).
        static var agreed: String? { defaults.string(forKey: "casyAgreed") }
        /// `-casyTheme <light|dark>`: Casy's own light or dark, for screenshots.
        static var theme: String? { defaults.string(forKey: "casyTheme") }
        static var phoneSync: String { defaults.string(forKey: "casyPhoneSync") ?? "synced" }
        /// `-casyNativeHome YES`: the native home page, the page's part played
        /// here (a vote's pencilled date, a starred day, the vote pill), and
        /// each press written where the test can read it (`home.lastAction`).
        static var nativeHome: Bool { defaults.bool(forKey: "casyNativeHome") && !webOnly }
        /// `-casyWebOnly YES` (#280): no screen is native, so the page draws every
        /// one itself, as before the rewrite: the reference a parity shot
        /// compares the native screen with (docs/native-visual-parity.md).
        static var webOnly: Bool { defaults.bool(forKey: "casyWebOnly") }
        /// `-casyPageAuth YES`: sign-in's steps go to the page, signed out, as in real use (#282).
        static var pageAuth: Bool { defaults.bool(forKey: "casyPageAuth") }

        /// What a parity launch (#280) puts in the page before its first line
        /// runs, as e2e/fixtures.ts does in Playwright: the page's storage
        /// (`-casyWebSession`: the fake backend's `/parity/session` JSON in base64,
        /// Mia's session and her phone's connection), the
        /// clock stopped at `-casyNow`, Casy's "random" choices seeded, the theme
        /// and language, and the address `-casyWebPath` (`/?day=2026-10-15`) put
        /// in place before the router reads it. Both modes of a parity shot run
        /// it: web only, the page draws the screen; native, it hands the native
        /// screen its data as in real use. Nil without a session handed over.
        static var webScript: String? {
            guard isActive, defaults.string(forKey: "casyWebSession") != nil else { return nil }
            // `-casyKeepIntro YES`: the welcome's intro plays, as for a real first visit.
            var lines = (defaults.bool(forKey: "casyKeepIntro") ? [] : ["window.__casySkipIntro = true;"]) + [seededRandom]
            if let now {
                // Date() and Date.now() say `now`; timers and animations still run.
                lines.append(
                    """
                    (() => {
                      const fixed = \(now);
                      const Real = Date;
                      class Stopped extends Real {
                        constructor(...args) { if (args.length === 0) super(fixed); else super(...args); }
                        static now() { return fixed; }
                      }
                      window.Date = Stopped;
                    })();
                    """)
            }
            var stored: [String: String] = [:]
            if let encoded = defaults.string(forKey: "casyWebSession"),
                let data = Data(base64Encoded: encoded),
                let given = try? JSONSerialization.jsonObject(with: data) as? [String: String]
            {
                stored = given
            }
            if let theme { stored["casy-theme"] = theme }
            if let lang { stored["casy-lang"] = lang }
            // Once per launch (a reload inside the test keeps what it changed): the
            // simulator keeps the page's storage between runs, remembered queries
            // too, so it starts empty and holds only what this shot asks for.
            var fresh = ["localStorage.clear();"]
            for (key, value) in stored.sorted(by: { $0.key < $1.key }) {
                fresh.append("localStorage.setItem(\(literal(key)), \(literal(value)));")
            }
            if let path = defaults.string(forKey: "casyWebPath") {
                fresh.append("history.replaceState(null, \"\", \(literal(path)));")
            }
            fresh.append("sessionStorage.setItem(\"parity-seeded\", \"1\");")
            lines.append(
                "if (!sessionStorage.getItem(\"parity-seeded\")) {\n  \(fresh.joined(separator: "\n  "))\n}")
            return lines.joined(separator: "\n")
        }

        /// The browser tests' seeded generator (e2e/fixtures.ts), for Math.random
        /// and Casy's own choices (src/lib/appRandom.ts), so every load is the same.
        private static let seededRandom = """
            (() => {
              const seeded = (start) => {
                let seed = start;
                return () => {
                  seed = (seed + 0x6d2b79f5) | 0;
                  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
                  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
                  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
                };
              };
              Math.random = seeded(20261007);
              window.__casyRandom = seeded(20261007);
            })();
            """

        /// `text` as a JavaScript string literal.
        private static func literal(_ text: String) -> String {
            let data = (try? JSONSerialization.data(withJSONObject: [text])) ?? Data("[\"\"]".utf8)
            return String(String(decoding: data, as: UTF8.self).dropFirst().dropLast())
        }

        /// What the page would answer a sign-in step (#282): "forkert1" is a
        /// wrong password, "password1" a leaked one, a new account waits for
        /// its email, and Apple signs in.
        static func authAnswer(_ action: String, email: String, password: String) -> AuthAnswer {
            switch action {
            case "password":
                return password == "forkert1"
                    ? .failed("Forkert e-mail eller adgangskode.") : AuthAnswer(outcome: "in")
            case "signUp": return AuthAnswer(outcome: "confirm")
            case "leaked": return AuthAnswer(outcome: "done", count: password == "password1" ? 52_256 : 0)
            case "apple": return AuthAnswer(outcome: "in")
            case "link", "reset", "resend": return AuthAnswer(outcome: "sent")
            default: return AuthAnswer(outcome: "done")
            }
        }

        @MainActor static var homePage: HomeFromPage {
            var page = HomeFromPage()
            page.shown = true
            page.tell = true
            page.dataAt = 1
            page.extras = [
                MonthItem(calendarId: "vote:v1", start: day(14, 17), end: day(14, 19), label: "Fredagsbar", pencil: true)
            ]
            page.colors = ["vote:v1": "234, 88, 12"]
            page.starred = [startOfDay(day(16, 12), appTimeZone)]
            page.pill = CasyStrings.homeVoteAnswer("Fredagsbar")
            // `-casyImportant YES`: a critical exam the morning after the vote's first date (#114).
            if defaults.bool(forKey: "casyImportant") {
                page.important = [
                    LabelledEvent(
                        title: "Eksamen i statistik", start: day(15, 9), end: day(15, 13), allDay: false,
                        label: EventLabel(
                            kind: "exam", importance: "critical", prepDays: 2, avoidBefore: ["alcohol", "lateNight"],
                            recoveryDays: 0, strain: "heavy", confidence: "high", reason: ""))
                ]
            }
            return page
        }

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
            let person = webPerson
            return backend.map {
                SessionBox.Connection(
                    projectURL: $0, apiKey: "test-key", accessToken: "test-token",
                    expiresAt: .distantFuture, userId: person?.id ?? "test-user",
                    email: person?.email ?? "test@example.com")
            }
        }

        /// Who the page is signed in as in a parity launch (#281): Mia, from the
        /// session handed over, so a native screen shows her email as the web's does.
        private static var webPerson: (id: String, email: String?)? {
            guard let encoded = defaults.string(forKey: "casyWebSession"),
                let data = Data(base64Encoded: encoded),
                let stored = try? JSONSerialization.jsonObject(with: data) as? [String: String],
                let token = stored.first(where: { $0.key.hasSuffix("-auth-token") })?.value,
                let session = try? JSONSerialization.jsonObject(with: Data(token.utf8)) as? [String: Any],
                let user = session["user"] as? [String: Any],
                let id = user["id"] as? String
            else { return nil }
            return (id, user["email"] as? String)
        }
    }
#endif
