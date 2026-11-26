import Foundation
import StoreKit
import UIKit
import UserNotifications

/// When the app asks for notifications (#139) and for a rating (#256), decided
/// by the app itself (#202; the web's pushAsk.ts and appReview.ts):
///
/// - notifications: iOS's own prompt shows only once ever, so Casy says why
///   first, in its sheet, at a moment someone is waiting on others (dates sent,
///   a vote answered, a group joined); at most three times, a week apart at
///   the least, and only while iOS hasn't been asked;
/// - a rating: at a moment that went well (an agreed date flown into the
///   calendar), at most once every four months; iOS decides whether it shows.
///
/// Kept in UserDefaults; what the page counted before is handed over once.
@MainActor
final class Asks {
    static let shared = Asks()

    static var on: Bool {
        #if DEBUG
            // Under a UI test, only when it asks for it (`-casyAsks YES`), from a clean slate.
            if TestLaunch.isActive { return TestLaunch.asks }
        #endif
        return NativeBridgePlugin.nativeLabels
    }

    /// Every count forgotten: a UI test starts from a phone that was never asked.
    func forget() {
        for key in [Self.askedKey, Self.lastKey, Self.reviewKey] { store.removeObject(forKey: key) }
    }

    /// The bridge's: the notifications' sheet for this reason, if nothing is open; true when shown.
    var showPushAsk: (_ reason: String) -> Bool = { _ in false }

    private static let maxPushAsks = 3
    private static let week: TimeInterval = 7 * 86_400
    private static let reviewGap: TimeInterval = 120 * 86_400
    /// A clear beat after what the person did (the web's SHOW_AFTER_MS).
    private static let pushAfter: Duration = .milliseconds(1200)
    /// The agreed date's landing seen first (the web's LANDED_REVIEW_MS).
    private static let reviewAfter: Duration = .milliseconds(600)

    private let store = UserDefaults.standard
    private static let askedKey = "casy.pushAsk.asked"
    private static let lastKey = "casy.pushAsk.last"
    private static let reviewKey = "casy.reviewAsked"
    private var showing = false

    /// What the page counted before the app asked itself: kept unless the app has its own.
    func adopt(pushAsked: Int, pushLast: Double?, reviewAsked: Double?) {
        if store.object(forKey: Self.askedKey) == nil, pushAsked > 0 {
            store.set(pushAsked, forKey: Self.askedKey)
            if let pushLast { store.set(pushLast / 1000, forKey: Self.lastKey) }
        }
        if store.object(forKey: Self.reviewKey) == nil, let reviewAsked {
            store.set(reviewAsked / 1000, forKey: Self.reviewKey)
        }
    }

    // MARK: Notifications

    /// A moment worth asking at: "sent", "answered" or "joined".
    func push(_ reason: String) {
        guard !showing else { return }
        showing = true
        Task {
            defer { showing = false }
            guard await permission() == "prompt", mayAsk(now: Date()) else { return }
            try? await Task.sleep(for: Self.pushAfter)
            guard showPushAsk(reason) else { return }
            store.set(store.integer(forKey: Self.askedKey) + 1, forKey: Self.askedKey)
            store.set(Date().timeIntervalSince1970, forKey: Self.lastKey)
        }
    }

    private func mayAsk(now: Date) -> Bool {
        let asked = store.integer(forKey: Self.askedKey)
        guard asked < Self.maxPushAsks else { return false }
        guard let last = store.object(forKey: Self.lastKey) as? Double else { return true }
        return now.timeIntervalSince1970 - last >= Self.week
    }

    /// What iOS says: "prompt" while it has never been asked.
    private func permission() async -> String {
        #if DEBUG
            if let faked = TestLaunch.pushPermission { return faked }
        #endif
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        switch settings.authorizationStatus {
        case .notDetermined: return "prompt"
        case .denied: return "denied"
        default: return "granted"
        }
    }

    // MARK: A rating

    /// A date agreed has just flown into the calendar: a rating asked, if it is time.
    func review(in scene: UIWindowScene?) {
        let now = Date().timeIntervalSince1970
        if let last = store.object(forKey: Self.reviewKey) as? Double, now - last < Self.reviewGap { return }
        store.set(now, forKey: Self.reviewKey)
        Task {
            try? await Task.sleep(for: Self.reviewAfter)
            guard let scene else { return }
            AppStore.requestReview(in: scene)
        }
    }
}
