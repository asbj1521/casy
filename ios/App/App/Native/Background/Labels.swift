import CasyAPI
import CasyCore
import CasyUI
import EventKit
import Foundation
import UIKit

/// Event labels made natively (#112, #282; the web's useAutoLabel): each
/// distinct title in this phone's counted calendars not labelled yet (or
/// marked stale by a correction) goes to calendar-label in batches, soonest
/// first, with the person's corrections in hand, and the labels are kept on
/// the phone, under a hash of title and calendar (EventLabels.swift).
///
/// The app is the one that labels: the page hands over the book it kept
/// (`adopt`), then only keeps a copy for what it still draws itself (the day
/// facts, the web's day rows), sent back whenever the book changes (`mirror`).
/// A correction made on the page ("Forkert?") comes here too (`corrected`).
///
/// Only for someone who said yes to the AI using their calendar (#120), or an
/// admin or AI tester, and only with this phone connected (`thisPhone`, from
/// the page until the phone's sync is native). What a failing call left is
/// tried on the next run: the app coming back, the phone's calendars changing.
@MainActor @Observable
final class LabelsWork {
    static let shared = LabelsWork()

    /// Whether the app labels in this build (the page then doesn't): with the native screens.
    static var on: Bool { NativeBridgePlugin.nativeLabels }

    private(set) var book: LabelBook = [:]
    private(set) var corrections: [PhoneLabelCorrection] = []
    /// One line for testers in Dine data: which condition holds, which doesn't.
    private(set) var status = "not started" {
        didSet {
            #if DEBUG
                NSLog("casy labels: %@", status)
            #endif
        }
    }
    /// Your events that matter (high or critical, #114), for a vote's date to be warned against.
    private(set) var important: [LabelledEvent] = []

    /// This phone's connection for the signed-in person, as the page knows it.
    var thisPhone: String? {
        didSet { if thisPhone != oldValue { kick() } }
    }
    /// Tells the page the book changed (its copy, for what it still draws).
    var mirror: (_ userId: String, _ book: LabelBook) -> Void = { _, _ in }

    private var userId: String?
    /// Titles asked about since the app was opened: each at most once a launch.
    private var asked: Set<String> = []
    private var running = false
    private var again = false
    private var lastRun = "none yet"
    private var watching: [NSObjectProtocol] = []

    private init() {
        let center = NotificationCenter.default
        watching = [
            center.addObserver(forName: .EKEventStoreChanged, object: nil, queue: .main) { _ in
                MainActor.assumeIsolated { LabelsWork.shared.kick() }
            },
            center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { _ in
                MainActor.assumeIsolated { LabelsWork.shared.kick() }
            },
        ]
    }

    // MARK: Who and what

    /// Signed in as `userId` (nil: nobody): that person's book, read from the phone.
    func signedIn(_ userId: String?) {
        guard userId != self.userId else { return kick() }
        self.userId = userId
        asked = []
        let kept = userId.map(Self.read) ?? Kept()
        book = kept.labels
        corrections = kept.corrections
        refreshImportant(events: nil)
        kick()
    }

    /// The book the page kept before the app labelled (handed over once): what
    /// the app has wins, the page's fills in, and corrections join, newest first.
    func adopt(_ userId: String, labels: LabelBook, corrections fromPage: [PhoneLabelCorrection]) {
        var kept = Self.read(userId)
        let before = kept
        for (key, label) in labels where kept.labels[key] == nil { kept.labels[key] = label }
        for c in fromPage.sorted(by: { $0.at < $1.at }) where !kept.corrections.contains(where: { $0.key == c.key && $0.at >= c.at }) {
            kept.corrections = addCorrection(kept.corrections, c)
        }
        guard kept != before else { return }
        Self.write(userId, kept)
        if userId == self.userId {
            book = kept.labels
            corrections = kept.corrections
            refreshImportant(events: nil)
            mirror(userId, book)
            kick()
        }
    }

    /// A correction made on the page ("Forkert?"): kept as theirs, sent with every
    /// later call, and the rest of its calendar labelled again with it in hand.
    func corrected(_ userId: String, correction: PhoneLabelCorrection, count: Int) {
        guard userId == self.userId else { return }
        corrections = addCorrection(corrections, correction)
        let label = StoredLabel(label: correction.label, count: count, corrected: true, calendarId: correction.calendarId)
        let marked = markCalendarStale(updateBook(book, [(correction.key, label)]), correction.calendarId)
        for key in marked.keys { asked.remove(key) }
        save(marked.book)
        kick()
    }

    /// The AI's consent withdrawn (#120) for `userId`, or signed out (nil: everyone):
    /// everything the AI made of this phone's calendar goes.
    func clear(_ userId: String?) {
        Self.remove(userId)
        if userId == nil || userId == self.userId {
            book = [:]
            corrections = []
            asked = []
            important = []
        }
    }

    var count: Int { book.count }

    // MARK: The run

    /// A run soon (several asks in a moment make one), or once the one going ends.
    func kick() {
        guard Self.on else { return }
        if running {
            again = true
            return
        }
        Task { await run() }
    }

    private func run() async {
        guard !running else { return }
        running = true
        defer {
            running = false
            if again {
                again = false
                kick()
            }
        }
        let flag = { (v: Bool) in v ? "yes" : "NO" }
        let access = EKEventStore.authorizationStatus(for: .event)
        let readable = access == .fullAccess || access == .authorized
        guard let userId, let api = await Native.api(), let thisPhone, readable else {
            status = "waiting: signed in=\(flag(userId != nil)) phone=\(flag(thisPhone != nil)) calendar access=\(flag(readable)) (\(access.rawValue))"
            return
        }
        guard let me = try? await api.whoAmI() else {
            status = "waiting: who am I failed; last run: \(lastRun)"
            return
        }
        let allowed = (me.aiTester ?? me.eventLabels) == true || me.aiConsent == true
        guard allowed else {
            status = "waiting: allowed=NO"
            return
        }
        let now = Native.now
        let window = searchWindow(now: now)
        guard let overview = try? await api.calendarBusy(from: window.start, to: window.end) else {
            status = "waiting: calendars=NO; last run: \(lastRun)"
            return
        }
        var names: [String: String] = [:]
        for c in overview.calendars where c.connectionId == thisPhone && c.included {
            if let id = c.externalId { names[id] = c.name }
        }
        let events = Self.readEvents(from: window.start, to: window.end)
        let candidates = labelCandidates(events, names, now: now)
        if let tidy = tidyBook(book, present: presentKeys(events), candidates) { save(tidy) }
        refreshImportant(events: events)
        let batches = batchesToLabel(candidates, book, asked: asked)
        guard !batches.isEmpty else {
            status =
                "idle: phone calendars=\(names.count) events=\(events.count) titles=\(candidates.count) "
                + "labelled=\(book.count) asked this launch=\(asked.count); last run: \(lastRun)"
            return
        }
        for batch in batches { for c in batch { asked.insert(c.key) } }
        status = "asking: \(batches.joined().count) titles in \(batches.count) calls"
        do {
            for batch in batches {
                // Read afresh each time: a correction may have come in meanwhile.
                let labels = try await api.labelEvents(batch.map(\.event), corrections: correctionsToSend(corrections))
                guard userId == self.userId else { return }
                let added: [(key: String, label: StoredLabel)] = batch.enumerated().compactMap { i, c in
                    guard i < labels.count, let label = labels[i] else { return nil }
                    return (c.key, StoredLabel(label: label, count: c.event.count, calendarId: c.calendarId))
                }
                save(updateBook(book, added))
                lastRun = "ok, \(added.count) of \(batch.count) labelled"
                status = "answered: \(added.count) of \(batch.count) labelled"
            }
            refreshImportant(events: events)
        } catch {
            lastRun = "FAILED: \(error.localizedDescription)"
            status = lastRun
        }
    }

    private func save(_ next: LabelBook) {
        guard let userId, next != book else { return }
        book = next
        Self.write(userId, Kept(labels: book, corrections: corrections))
        mirror(userId, book)
    }

    /// The labelled events that matter, from the phone's events as they are now.
    private func refreshImportant(events: [PhoneEventWithDetails]?) {
        guard !book.isEmpty else {
            important = []
            return
        }
        let window = searchWindow(now: Native.now)
        let all = events ?? Self.readEvents(from: window.start, to: window.end)
        important = labelledEvents(all, book).filter { $0.label.importance == "high" || $0.label.importance == "critical" }
    }

    /// This phone's events with their titles, as the page reads them (readDetails).
    /// A store of its own each time: one made before the calendars were allowed
    /// goes on seeing none of them.
    private static func readEvents(from: String, to: String) -> [PhoneEventWithDetails] {
        guard let start = parseInstant(from), let end = parseInstant(to) else { return [] }
        let store = EKEventStore()
        return PhoneCalendarReader.readDetails(store: store, from: Double(start), to: Double(end)).map { d in
            let t = d.timing
            return PhoneEventWithDetails(
                event: PhoneEvent(
                    calendarId: t.calendarId, allDay: t.allDay, free: t.free, cancelled: t.cancelled,
                    declined: t.declined, start: t.start.map { Int64($0) }, end: t.end.map { Int64($0) },
                    startDay: t.startDay, endDay: t.endDay),
                title: d.title, location: d.location, notes: d.notes)
        }
    }

    // MARK: Kept on the phone, per account

    struct Kept: Codable, Equatable {
        var v = 1
        var labels: LabelBook = [:]
        var corrections: [PhoneLabelCorrection] = []
    }

    private static var folder: URL? {
        try? FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            .appendingPathComponent("labels", isDirectory: true)
    }

    private static func file(_ userId: String) -> URL? {
        // The id is the server's uuid; anything else is kept out of the path.
        let safe = userId.filter { $0.isLetter || $0.isNumber || $0 == "-" }
        return folder?.appendingPathComponent("\(safe).json")
    }

    private static func read(_ userId: String) -> Kept {
        guard let url = file(userId), let data = try? Data(contentsOf: url),
            let kept = try? JSONDecoder().decode(Kept.self, from: data), kept.v == 1
        else { return Kept() }
        return kept
    }

    private static func write(_ userId: String, _ kept: Kept) {
        guard let folder, let url = file(userId), let data = try? JSONEncoder().encode(kept) else { return }
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        // Never leaves this phone: kept out of backups, and unreadable while it is locked.
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
