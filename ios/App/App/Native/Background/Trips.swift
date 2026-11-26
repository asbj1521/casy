import CasyAPI
import CasyCore
import Foundation

/// Trip detection's background half made natively (#115, #282; the web's
/// useAutoTripLegs): the phone's events the labels call a flight or travel are
/// read by `trip-legs` (which way, between which cities), each distinct title
/// and place once, and the legs are kept on the phone. Runs after each label
/// run (LabelsWork), as new labels arrive.
///
/// The page hands over the book it kept (`adopt`) and keeps the app's copy
/// (`mirror`); HomeTrips pairs the legs into trips (#202).
@MainActor
final class TripsWork {
    static let shared = TripsWork()

    static var on: Bool { NativeBridgePlugin.nativeLabels }

    private(set) var book: LegBook = [:]
    private(set) var status = "not started"
    /// What the last run was given, for HomeTrips: the phone's events, its counted calendars, the labels.
    private(set) var events: [PhoneEventWithDetails] = []
    private(set) var names: [String: String] = [:]
    private(set) var labels: LabelBook = [:]
    /// Tells the page the legs changed (its copy, which it pairs into trips).
    var mirror: (_ userId: String, _ book: LegBook) -> Void = { _, _ in }

    private var userId: String?
    private var asked: Set<String> = []
    private var running = false
    private var lastRun = "none yet"

    /// Signed in as `userId` (nil: nobody): that person's legs, read from the phone.
    func signedIn(_ userId: String?) {
        guard userId != self.userId else { return }
        self.userId = userId
        asked = []
        book = userId.map { Self.read($0) } ?? [:]
        events = []
        names = [:]
        labels = [:]
        HomeTrips.shared.signedIn(userId)
    }

    /// The legs the page kept before the app read them, handed over once: the app's win.
    func adopt(_ userId: String, legs: LegBook) {
        var kept = Self.read(userId)
        let before = kept
        for (key, leg) in legs where kept[key] == nil { kept[key] = leg }
        guard kept != before else { return }
        Self.write(userId, kept)
        if userId == self.userId {
            book = kept
            mirror(userId, book)
            HomeTrips.shared.refresh()
        }
    }

    /// For testing (Dine data's "reset trips"): the journeys forgotten and read again at once.
    func readAgain() {
        guard let userId else { return }
        asked = []
        book = [:]
        Self.write(userId, book)
        mirror(userId, book)
        HomeTrips.shared.refresh()
        LabelsWork.shared.kick()
    }

    /// The AI's consent withdrawn for `userId`, or signed out (nil): the legs go.
    func clear(_ userId: String?) {
        Self.remove(userId)
        if userId == nil || userId == self.userId {
            book = [:]
            asked = []
        }
        HomeTrips.shared.forget(userId)
    }

    /// After a label run: the phone's events, its counted calendars and the labels as they are.
    func run(api: EdgeFunctions, events: [PhoneEventWithDetails], names: [String: String], labels: LabelBook) async {
        guard Self.on, !running, let userId else { return }
        running = true
        defer { running = false }
        self.events = events
        self.names = names
        self.labels = labels
        HomeTrips.shared.refresh()
        // Tidied against the travel events on the phone, never the calendars the
        // server lists (#132); not before any label is read.
        if !labels.isEmpty, let tidy = tidyLegBook(book, present: presentLegKeys(events, labels)) { save(tidy) }
        let candidates = travelCandidates(events, labels, names, now: Native.now)
        let batches = legBatches(candidates, book, asked: asked)
        guard !batches.isEmpty else {
            let journeys = book.values.filter { $0.mode != "none" && $0.confidence != "low" }.count
            status = "idle: travel events counted=\(candidates.count) read=\(book.count) of which journeys=\(journeys); last run: \(lastRun)"
            return
        }
        for batch in batches { for c in batch { asked.insert(c.key) } }
        do {
            for batch in batches {
                let legs = try await api.readTripLegs(batch.map(\.event))
                guard userId == self.userId else { return }
                var next = book
                for (i, c) in batch.enumerated() where i < legs.count {
                    if let leg = legs[i] { next[c.key] = leg }
                }
                save(next)
                lastRun = "ok, \(legs.compactMap { $0 }.count) of \(batch.count) read"
            }
        } catch {
            lastRun = "FAILED: \(error.localizedDescription)"
        }
        status = lastRun
        #if DEBUG
            NSLog("casy trips: %@", status)
        #endif
    }

    private func save(_ next: LegBook) {
        guard let userId, next != book else { return }
        book = next
        Self.write(userId, book)
        mirror(userId, book)
        HomeTrips.shared.refresh()
    }

    // MARK: Kept on the phone, per account (the web's `{ v: 1, legs }`)

    private struct Kept: Codable {
        var v = 1
        var legs: LegBook
    }

    private static var folder: URL? {
        try? FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            .appendingPathComponent("trips", isDirectory: true)
    }

    private static func file(_ userId: String) -> URL? {
        let safe = userId.filter { $0.isLetter || $0.isNumber || $0 == "-" }
        return folder?.appendingPathComponent("\(safe).json")
    }

    private static func read(_ userId: String) -> LegBook {
        guard let url = file(userId), let data = try? Data(contentsOf: url),
            let kept = try? JSONDecoder().decode(Kept.self, from: data), kept.v == 1
        else { return [:] }
        return kept.legs
    }

    private static func write(_ userId: String, _ legs: LegBook) {
        guard let folder, let url = file(userId), let data = try? JSONEncoder().encode(Kept(legs: legs)) else { return }
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        try? data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var marked = url
        try? marked.setResourceValues(values)
    }

    private static func remove(_ userId: String?) {
        guard let folder else { return }
        if let userId, let url = file(userId) {
            try? FileManager.default.removeItem(at: url)
        } else {
            try? FileManager.default.removeItem(at: folder)
        }
    }
}
