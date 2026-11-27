import CasyAPI
import CasyCore
import Foundation

/// Tid til hinanden's stars on the home page (#171), found by the app itself (#202;
/// the page's usePrimeDates): the few stretches coming up when a whole group of yours
/// is free (CasyCore's primeCandidates), each group's busy times read as Planlæg reads
/// them and its best stretches scored once by everyone's important events (#119), then
/// the best few (pickPrimeDates). Shown only once the scores are in, so the stars don't
/// jump. Other people's busy times are kept in memory only, a few hours at most.
@MainActor @Observable
final class HomeStars {
    static let shared = HomeStars()

    /// Found here, not by the page: as the rest of the app's own background work.
    static var on: Bool { AppCoordinator.nativeLabels }

    /// The stars, best first; empty until worked out.
    private(set) var stars: [PrimeDate] = []

    /// How long a group's busy times and scores are good for: stars are about the next weeks.
    private static let fresh: TimeInterval = 3 * 3600
    /// How many of a group's stretches are scored: its best, which are the ones that can win.
    private static let scored = 10

    @ObservationIgnored private var readAt: Date = .distantPast
    @ObservationIgnored private var running: Task<Void, Never>?

    /// Worked out again if it is a few hours old (or `force`, as after a pull to refresh).
    func refresh(force: Bool = false) {
        guard force || Date().timeIntervalSince(readAt) > Self.fresh, running == nil else { return }
        running = Task {
            defer { running = nil }
            if let found = await find() {
                stars = found
                readAt = Date()
            }
        }
    }

    func reset() {
        running?.cancel()
        running = nil
        stars = []
        readAt = .distantPast
    }

    /// The star on a day, if there is one.
    func star(on day: Int64) -> PrimeDate? { stars.first { $0.day == day } }

    private func find() async -> [PrimeDate]? {
        guard let api = await Native.api() else { return nil }
        let now = Native.now
        let window = searchWindow(now: now, appTimeZone)
        guard let groups = try? await api.groups() else { return nil }
        if EventsModel.shared.events == nil { await EventsModel.shared.load() }
        let events = EventsModel.shared.events ?? []
        // Only groups that can have stars: four or more, not switched off.
        let wanted = groups.filter { $0.primeDates != false && $0.members.count >= primeMinGroupSize }
        var candidates: [[PrimeDate]] = []
        var scores: [String: [Int64: Double]] = [:]
        for group in wanted {
            guard let busy = try? await api.groupBusy(group.id, from: window.start, to: window.end) else { continue }
            let own = events.filter { $0.group.id == group.id && ($0.status == .pending || $0.status == .scheduled) }
            let prime = PrimeGroup(
                id: group.id, memberIds: group.members.map(\.profileId),
                busy: busy.busy.mapValues { $0.map { PrimeSpan(start: $0.start, end: $0.end) } },
                connected: busy.connected,
                eventDates: own.flatMap { e in
                    (e.currentDate.map { [PrimeSpan(start: $0.start, end: $0.end)] } ?? [])
                        + e.candidates.map { PrimeSpan(start: $0.start, end: $0.end) }
                },
                voting: own.contains { $0.status == .pending })
            let list = primeCandidates(prime, now: now, appTimeZone)
            candidates.append(list)
            // The best stretches of a day scored, as the paper pile scores a vote's dates.
            let best = Array(list.filter { $0.kind == "hours" }.prefix(Self.scored))
            guard !best.isEmpty,
                let answer = try? await api.rankDates(
                    groupId: group.id,
                    settings: EventSettings(kind: .single, durationMinutes: Int(primeMinHours * 60), startHour: anyTimeEarliestHour),
                    profile: nil,
                    dates: best.map { SentDate(start: isoString($0.start), end: isoString($0.end), answer: nil) }),
                answer.counted > 0, answer.scores.count == best.count
            else { continue }
            scores[group.id] = Dictionary(uniqueKeysWithValues: zip(best.map(\.start), answer.scores))
        }
        if Task.isCancelled { return nil }
        return pickPrimeDates(candidates, scores: scores)
    }
}
