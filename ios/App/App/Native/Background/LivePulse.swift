import CasyAPI
import Foundation
import UIKit

/// Keeps what the app shows up to date with what other people do (#202, the
/// web's useLiveUpdates and livePace): watches the pulse, a hash of everything
/// you can see that others change, and when it moves fetches your events,
/// invitations and groups again (and the starred days when someone joined or
/// left a group).
///
/// When to ask the pulse: while the app is open it listens on Realtime
/// (`PulseSocket`), which says when something changed, and asks on its own
/// only every 5 minutes. Without Realtime (connecting, or it failed) it asks
/// often right after something happened and less and less while nothing
/// does: every 5 seconds for a minute, then 15, 30, at most 60. A minute
/// after the app leaves the screen the socket closes; back, it asks at once.
@MainActor
final class LivePulse {
    static let shared = LivePulse()

    static var on: Bool {
        #if DEBUG
            if TestLaunch.isActive { return TestLaunch.live }
        #endif
        return AppCoordinator.nativeLabels
    }

    /// For Dine data's testing rows: how the app hears about changes now.
    private(set) var status = "off"

    private var userId: String?
    private var socket: PulseSocket?
    private var listening: Task<Void, Never>?
    private var pacing: Task<Void, Never>?
    private var debounce: Task<Void, Never>?
    private var hiddenTimer: Task<Void, Never>?
    private var live = false
    private var lastActive = Date()
    private var lastSeen: String?
    private var asking = false
    /// Told to ask while an ask was on its way: once more right after it.
    private var askAgain = false
    private var observers: [NSObjectProtocol] = []

    private static let pollSteps: [(quietFor: TimeInterval, every: TimeInterval)] = [
        (0, 5), (60, 15), (180, 30), (600, 60),
    ]
    private static let safetyPoll: TimeInterval = 300
    private static let hiddenGrace: Duration = .seconds(60)
    private static let signalDebounce: Duration = .milliseconds(300)

    /// The wait before asking again (the web's pollDelay).
    static func pollDelay(quiet: TimeInterval, live: Bool) -> TimeInterval {
        if live { return safetyPoll }
        return pollSteps.last { quiet >= $0.quietFor }?.every ?? pollSteps[0].every
    }

    private static let socketLog: (@Sendable (String) -> Void)? = {
        #if DEBUG
            return { NSLog("LivePulse socket %@", $0) }
        #else
            return nil
        #endif
    }()

    /// Who is signed in now: someone else starts from scratch, nobody stops it.
    func signedIn(_ id: String?) {
        guard Self.on, id != userId else { return }
        stop()
        userId = id
        lastSeen = nil
        guard id != nil else { return }
        watchTheApp()
        if UIApplication.shared.applicationState != .background { startSocket() }
        lastActive = Date()
        schedule(after: 0)
    }

    /// Something of yours just changed: others are likely to answer soon, so ask now and often again.
    func touched() {
        guard userId != nil else { return }
        lastActive = Date()
        schedule(after: 0)
    }

    private func stop() {
        stopSocket()
        pacing?.cancel()
        debounce?.cancel()
        hiddenTimer?.cancel()
        askAgain = false
        for observer in observers { NotificationCenter.default.removeObserver(observer) }
        observers = []
        status = "off"
    }

    private func watchTheApp() {
        let center = NotificationCenter.default
        observers = [
            center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { _ in
                MainActor.assumeIsolated { LivePulse.shared.cameBack() }
            },
            center.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { _ in
                MainActor.assumeIsolated { LivePulse.shared.wentAway() }
            },
        ]
    }

    private func cameBack() {
        hiddenTimer?.cancel()
        guard userId != nil else { return }
        lastActive = Date()
        startSocket()
        schedule(after: 0)
    }

    private func wentAway() {
        #if DEBUG
            NSLog("LivePulse: the app left the screen")
        #endif
        hiddenTimer?.cancel()
        hiddenTimer = Task {
            try? await Task.sleep(for: Self.hiddenGrace)
            guard !Task.isCancelled else { return }
            stopSocket()
            pacing?.cancel()
        }
    }

    // MARK: Realtime

    private func startSocket() {
        guard socket == nil, let userId else { return }
        Task {
            guard let connection = await SessionBox.shared.current(), connection.userId == userId,
                self.socket == nil, self.userId == userId
            else { return }
            var projectURL = connection.projectURL
            #if DEBUG
                if let backend = TestLaunch.backend { projectURL = backend }
            #endif
            guard
                let socket = PulseSocket(
                    projectURL: projectURL, apiKey: connection.apiKey, userId: userId,
                    token: { await SessionBox.shared.accessToken() },
                    log: Self.socketLog)
            else { return }
            self.socket = socket
            status = "connecting"
            listening = Task {
                for await event in socket.events { self.heard(event) }
            }
            await socket.start()
        }
    }

    private func stopSocket() {
        let old = socket
        socket = nil
        listening?.cancel()
        listening = nil
        live = false
        Task { await old?.stop() }
    }

    private func heard(_ event: PulseSocket.Event) {
        switch event {
        case .live(let now):
            guard now != live else { return }
            live = now
            status = now ? "live" : "asking on its own"
            #if DEBUG
                NSLog("LivePulse: %@", status)
            #endif
            // Either way the wait under way is the wrong one now, and on
            // (re)joining anything sent meanwhile was missed: ask once.
            schedule(after: 0)
        case .signal:
            lastActive = Date()
            debounce?.cancel()
            debounce = Task {
                try? await Task.sleep(for: Self.signalDebounce)
                guard !Task.isCancelled else { return }
                self.schedule(after: 0)
            }
        }
    }

    // MARK: Asking the pulse

    /// The next ask, after `seconds`. One already on its way is never cut off
    /// (its answer would be lost): "now" then waits for it and goes right after.
    private func schedule(after seconds: TimeInterval) {
        if asking {
            if seconds == 0 { askAgain = true }
            return
        }
        pacing?.cancel()
        pacing = Task {
            if seconds > 0 { try? await Task.sleep(for: .seconds(seconds)) }
            guard !Task.isCancelled else { return }
            await self.ask()
        }
    }

    private func ask() async {
        guard !asking, let userId else { return }
        asking = true
        askAgain = false
        var answer: String?
        if let api = await Native.api() {
            do {
                answer = try await api.pulse()
            } catch {
                #if DEBUG
                    NSLog("LivePulse: asking failed, %@", "\(error)")
                #endif
            }
        }
        asking = false
        guard !Task.isCancelled, self.userId == userId else { return }
        if let pulse = answer {
            let changed = lastSeen != nil && lastSeen != pulse
            #if DEBUG
                NSLog("LivePulse: asked, %@", String(pulse.prefix(8)))
            #endif
            // The first answer counts as activity, as does one that moved.
            if lastSeen != pulse { lastActive = Date() }
            lastSeen = pulse
            if changed { await fetchAgain() }
        }
        guard !Task.isCancelled, self.userId == userId, UIApplication.shared.applicationState != .background
        else { return }
        if !live && socket != nil { status = "asking on its own" }
        if askAgain {
            askAgain = false
            schedule(after: 0)
        } else {
            schedule(after: Self.pollDelay(quiet: Date().timeIntervalSince(lastActive), live: live))
        }
    }

    /// What others changed, fetched again where the app holds it.
    private func fetchAgain() async {
        #if DEBUG
            NSLog("LivePulse: the pulse moved")
        #endif
        let groups = GroupsModel.shared
        let before = Self.membership(groups.groups)
        async let events: Void = EventsModel.shared.load()
        async let profile: Void = ProfileModel.shared.load()
        async let mine: Void = groups.groups == nil ? () : groups.load()
        _ = await (events, profile, mine)
        if groups.groups != nil, Self.membership(groups.groups) != before {
            HomeStars.shared.refresh(force: true)
        }
    }

    /// Who is in which group: someone joining or leaving changes the stars.
    private static func membership(_ groups: [CasyAPI.Group]?) -> String {
        (groups ?? []).map { g in "\(g.id):\(g.members.map(\.profileId).sorted().joined(separator: ","))" }
            .sorted().joined(separator: "|")
    }
}
