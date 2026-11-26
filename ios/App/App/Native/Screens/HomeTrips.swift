import CasyAPI
import CasyCore
import CasyUI
import EventKit
import Foundation
import UIKit

/// The trips Casy found (#115), worked out by the app itself (#202; the web's
/// useTrips): the legs TripsWork read paired into trips and questions, the
/// answers kept on the phone, the bars on the home month, and the trip sheet's
/// answers carried out here. Where it runs, the page finds none.
@MainActor @Observable
final class HomeTrips {
    static let shared = HomeTrips()

    /// Where the app finds them: where it reads the legs.
    static var on: Bool { TripsWork.on }

    /// Every trip and question, as marks, less accepted ones your calendar holds as events.
    private(set) var marks: [TripMark] = []
    /// Which guess the questions' bars show, moving on with each pulse.
    private(set) var step = 0
    private(set) var answers = TripAnswers()
    private(set) var detected = DetectedTrips(trips: [], questions: [])

    @ObservationIgnored private var userId: String?
    /// Which loose ends are still worth asking about: fixed for the launch, as the page's.
    @ObservationIgnored private let now = Native.now
    @ObservationIgnored private var pulse: Timer?
    /// The home month has glided to a trip waiting for an answer: once a launch.
    @ObservationIgnored private var revealed = false

    // MARK: Signed in

    func signedIn(_ userId: String?) {
        guard userId != self.userId else { return }
        self.userId = userId
        answers = userId.map(Self.read) ?? TripAnswers()
        refresh()
    }

    /// The answers the page kept before the app found the trips, handed over once: the app's win.
    func adopt(_ userId: String, answers given: TripAnswers) {
        guard Self.read(userId) == TripAnswers(), given != TripAnswers() else { return }
        Self.write(userId, given)
        if userId == self.userId {
            answers = given
            refresh()
        }
    }

    /// The AI's consent withdrawn, or signed out (nil): the answers go too.
    func forget(_ userId: String?) {
        Self.remove(userId)
        if userId == nil || userId == self.userId {
            answers = TripAnswers()
            refresh()
        }
    }

    /// For testers (Your data): every answer forgotten, so each trip is asked about again.
    func resetAnswers() {
        guard let userId else { return }
        Self.remove(userId)
        answers = TripAnswers()
        revealed = false
        refresh()
    }

    // MARK: Found

    /// The legs, the phone's events or the answers changed: found again.
    func refresh() {
        guard Self.on else { return }
        let work = TripsWork.shared
        if userId == nil {
            detected = DetectedTrips(trips: [], questions: [])
        } else {
            let legs = phoneLegs(work.events, work.labels, work.book, work.names, answers)
            detected = detectTrips(legs, answers, now: now, inCalendar: casyTripSpans(work.events))
        }
        keepAccepted()
        remark()
    }

    /// Your calendar's items changed: an accepted trip put in it shows once, as that event.
    func calendarChanged() { remark() }

    private func remark() {
        let fresh = withoutTripsInCalendar(tripMarks(detected, Self.lang), items: HomeModel.shared.ownItems)
        guard fresh != marks else { return }
        marks = fresh
        pulsing()
        HomeModel.shared.tripsChanged()
        // The sheet open on one: as it is now (an answer that doesn't settle it brings its next question).
        if let open = TripModel.shared.mark, let live = fresh.first(where: { $0.id == open.id }) {
            TripModel.shared.show(live)
        }
    }

    /// Every accepted trip saved as itself, so it stays whatever happens to its legs (#132).
    private func keepAccepted() {
        let accepted = tripMarks(detected, Self.lang).filter {
            $0.kind == "trip" && $0.trip?.accepted == true && !($0.trip?.legs.isEmpty ?? true)
        }
        var next = answers
        for m in accepted {
            let k = next.kept[m.id]
            if k == nil || k?.start != m.start || k?.end != m.end || k?.city != m.city {
                next.kept[m.id] = KeptTrip(start: m.start, end: m.end, city: m.city, eventId: k?.eventId)
            }
        }
        guard next != answers else { return }
        change { _ in next }
    }

    /// The bars on the month: a question's guessing length moves on with each pulse.
    var bars: [MonthItem] {
        tripBars(
            marks,
            TripBarWords(
                pending: CasyStrings.tripBarPending, accepted: CasyStrings.tripTitle, back: CasyStrings.tripBarReturn,
                outbound: CasyStrings.tripBarOutbound),
            step: step)
    }

    /// One pulse of a bar (`animate-trip-pulse`); still under reduced motion.
    private func pulsing() {
        let asking = marks.contains { $0.kind == "question" } && !UIAccessibility.isReduceMotionEnabled
        if asking, pulse == nil {
            pulse = Timer.scheduledTimer(withTimeInterval: 1.8, repeats: true) { _ in
                MainActor.assumeIsolated {
                    HomeTrips.shared.step += 1
                    HomeModel.shared.tripsChanged()
                }
            }
        } else if !asking {
            pulse?.invalidate()
            pulse = nil
        }
    }

    /// A tap on a day: the trip waiting for an answer there, if any.
    func waiting(on day: Int64) -> TripMark? {
        guard Self.on, let mark = markOn(marks, day: day), isPending(mark) else { return nil }
        return mark
    }

    /// The first time the home page opens with something waiting: the day to glide to.
    func reveal() -> Int64? {
        guard Self.on, !revealed, let day = revealDay(marks) else { return nil }
        revealed = true
        return day
    }

    /// "I dag" pressed: no gliding to a trip this launch.
    func noReveal() { revealed = true }

    // MARK: Answered on the trip sheet

    func act(_ action: TripAction) {
        #if DEBUG
            NSLog("casy trips: answered %@", String(describing: action))
        #endif
        switch action {
        case .accept(let id):
            change { a in
                var a = a
                a.accepted = a.accepted.filter { $0 != id } + [id]
                a.dismissed.removeAll { $0 == id }
                return a
            }
        case .decline(let id):
            change { a in
                var a = a
                a.kept[id] = nil
                a.accepted.removeAll { $0 == id }
                a.dismissed = a.dismissed.filter { $0 != id } + [id]
                return a
            }
        case .home(let city):
            change { a in
                var a = a
                a.home = city
                return a
            }
        case .returned(let id, let day):
            change { a in
                var a = a
                a.returns[id] = day
                return a
            }
        case .left(let id, let day):
            change { a in
                var a = a
                a.outbounds[id] = day
                return a
            }
        case .addToCalendar(let id):
            guard let mark = marks.first(where: { $0.id == id }) ?? TripModel.shared.mark else { return }
            Task { await addToCalendar(mark) }
        }
    }

    private func change(_ update: (TripAnswers) -> TripAnswers) {
        guard let userId else { return }
        answers = update(answers)
        Self.write(userId, answers)
        refresh()
    }

    /// Læg i min kalender, into the calendar just chosen: it becomes the primary calendar.
    func add(_ id: String, into calendarId: String) {
        guard let mark = marks.first(where: { $0.id == id }) ?? TripModel.shared.mark else { return }
        TripModel.shared.adding = true
        Task { await addToCalendar(mark, choosing: calendarId) }
    }

    /// An accepted trip written into the phone's own calendar: Casy's primary when it is
    /// on this phone; with no primary yet, the one of this phone's calendars the person
    /// picks, which becomes the primary (as an agreed event's Tilføj til min kalender);
    /// else iOS's default for new events. The trip remembers the event.
    private func addToCalendar(_ mark: TripMark, choosing: String? = nil) async {
        let model = TripModel.shared
        var target: String?
        if let api = await Native.api() {
            let phone = ((try? await api.calendarConnections()) ?? []).filter { $0.id == LabelsWork.shared.thisPhone }
            let sources = phone.flatMap(\.calendar_sources)
            if let choosing {
                do {
                    _ = try await api.setPrimaryCalendar(choosing)
                } catch {
                    model.adding = false
                    model.failure = error.localizedDescription
                    return
                }
                target = sources.first { $0.id == choosing }?.external_id
            } else {
                do {
                    if let primary = try await api.primaryCalendar() {
                        target = sources.first { $0.id == primary.calendarId }?.external_id
                    } else {
                        let options = calendarChoices(phone, primaryId: nil)
                        if !options.isEmpty {
                            model.adding = false
                            model.choices = options
                            return
                        }
                    }
                } catch {
                    // Unknown whether one was chosen: never ask over it; iOS's default.
                }
            }
        }
        let access = EKEventStore.authorizationStatus(for: .event)
        let store = EKEventStore()
        guard access == .fullAccess || access == .authorized,
            let calendar = target.flatMap(store.calendar(withIdentifier:)) ?? store.defaultCalendarForNewEvents,
            calendar.allowsContentModifications
        else {
            model.adding = false
            model.failure = CasyStrings.tripAddFailed
            return
        }
        let event = EKEvent(eventStore: store)
        event.title = CasyStrings.tripTitle(mark.city)
        event.notes = CasyStrings.tripCalendarNote
        event.startDate = Date(timeIntervalSince1970: Double(mark.start) / 1000)
        event.endDate = Date(timeIntervalSince1970: Double(mark.end) / 1000)
        event.availability = .busy
        event.calendar = calendar
        do {
            try store.save(event, span: .thisEvent, commit: true)
        } catch {
            model.adding = false
            model.failure = CasyStrings.tripAddFailed
            return
        }
        change { a in
            var a = a
            a.kept[mark.id] = KeptTrip(start: mark.start, end: mark.end, city: mark.city, eventId: event.eventIdentifier ?? "")
            return a
        }
        model.addedTo = calendar.title
        model.adding = false
    }

    private static var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    // MARK: Kept on the phone, per account (the web's `{ v: 1, answers }`)

    private struct Kept: Codable {
        var v = 1
        var answers: TripAnswers
    }

    private static func file(_ userId: String) -> URL? {
        let safe = userId.filter { $0.isLetter || $0.isNumber || $0 == "-" }
        return try? FileManager.default.url(
            for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true
        )
        .appendingPathComponent("trips", isDirectory: true).appendingPathComponent("\(safe).answers.json")
    }

    private static func read(_ userId: String) -> TripAnswers {
        guard let url = file(userId), let data = try? Data(contentsOf: url),
            let kept = try? JSONDecoder().decode(Kept.self, from: data), kept.v == 1
        else { return TripAnswers() }
        return kept.answers
    }

    private static func write(_ userId: String, _ answers: TripAnswers) {
        guard let url = file(userId), let data = try? JSONEncoder().encode(Kept(answers: answers)) else { return }
        try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var marked = url
        try? marked.setResourceValues(values)
    }

    private static func remove(_ userId: String?) {
        guard let userId, let url = file(userId) else { return }
        try? FileManager.default.removeItem(at: url)
    }
}
