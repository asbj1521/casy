import CasyCore
import Foundation

/// What the page kept on this phone besides the login, made the app's once it
/// has no page (#202): someone updating from the App Store's page-only app
/// keeps their language, this phone's calendar connection (or they would be
/// asked to connect it again, making a second one), what the AI made of their
/// calendar and their answers about trips (or it would all be asked again), and
/// how often we asked them for notifications and a rating. Each goes to where
/// the app keeps it, as the page hands it over while it is there (the bridge's
/// labelsFromPage, legsFromPage, asksFromPage), and never over what the app
/// has already. Read once, at the first launch without the page (AppSession).
enum PageCarryOver {
    /// `values`: the page's storage by key (src/lib's readers name each); `userId`:
    /// whose login the page held, for what it kept per account.
    @MainActor static func adopt(_ values: [String: String], userId: String?) {
        // The language (src/i18n/lang.ts); the appearance the page also gave the app as it changed.
        if UserDefaults.standard.string(forKey: "casy.lang") == nil, let lang = values["casy-lang"],
            ["da", "en"].contains(lang)
        {
            NativePreferences.shared.lang = lang
        }
        if UserDefaults.standard.string(forKey: AppAppearance.key) == nil, let theme = values["casy-theme"],
            ["light", "dark"].contains(theme)
        {
            NativePreferences.shared.theme = theme
        }

        // This phone (src/lib/phoneCalendar.ts): its id, and its connection for this account.
        let phone = userId.flatMap { values["casy-phone-calendar:\($0)"] }
        PhoneSyncWork.adopt(userId: userId, device: values["casy-device-id"], connection: phone)
        #if DEBUG
            if TestLaunch.isActive { HomeModel.shared.testAction = "carried phone \(phone ?? "none")" }
        #endif

        // The asks counted (pushAsk.ts: {asked, last}; appReview.ts: an ISO time).
        let ask = values["casy-push-ask"].flatMap { decode(PushAskState.self, $0) }
        let reviewed = values["casy-review-asked"].flatMap { ISO8601DateFormatter.supabase.date(from: $0) }
        Asks.shared.adopt(
            pushAsked: ask?.asked ?? 0, pushLast: ask?.last,
            reviewAsked: reviewed.map { $0.timeIntervalSince1970 * 1000 })

        guard let userId else { return }
        // What the AI made of this phone's calendar (eventLabels.ts, tripLegBook.ts: `{ v: 1, … }`).
        let labels = values["casy-event-labels:\(userId)"].flatMap { decode(Versioned<LabelBook>.self, $0) }
        let corrections = values["casy-label-corrections:\(userId)"].flatMap {
            decode(VersionedCorrections.self, $0)
        }
        if labels?.v == 1 || corrections?.v == 1 {
            LabelsWork.shared.adopt(
                userId, labels: labels?.v == 1 ? labels?.labels ?? [:] : [:],
                corrections: corrections?.v == 1 ? corrections?.corrections ?? [] : [])
        }
        if let legs = values["casy-trip-legs:\(userId)"].flatMap({ decode(VersionedLegs.self, $0) }), legs.v == 1 {
            TripsWork.shared.adopt(userId, legs: legs.legs ?? [:])
        }
        if let answers = values["casy-trip-answers:\(userId)"].flatMap({ decode(VersionedAnswers.self, $0) }),
            answers.v == 1, let given = answers.answers
        {
            HomeTrips.shared.adopt(userId, answers: given)
        }
        // The calendars gone through in the tour (calendarTour.ts: an array of ids).
        if let seen = values["casy-calendar-tour-seen:\(userId)"].flatMap({ decode([String].self, $0) }),
            UserDefaults.standard.stringArray(forKey: "casy.calendarTourSeen.\(userId)") == nil
        {
            UserDefaults.standard.set(seen, forKey: "casy.calendarTourSeen.\(userId)")
        }
    }

    private struct PushAskState: Decodable {
        var asked: Int?
        var last: Double?
    }

    private struct Versioned<Book: Decodable>: Decodable {
        var v: Int?
        var labels: Book?
    }

    private struct VersionedCorrections: Decodable {
        var v: Int?
        var corrections: [PhoneLabelCorrection]?
    }

    private struct VersionedLegs: Decodable {
        var v: Int?
        var legs: LegBook?
    }

    private struct VersionedAnswers: Decodable {
        var v: Int?
        var answers: TripAnswers?
    }

    private static func decode<T: Decodable>(_ type: T.Type, _ text: String) -> T? {
        try? JSONDecoder().decode(type, from: Data(text.utf8))
    }
}
