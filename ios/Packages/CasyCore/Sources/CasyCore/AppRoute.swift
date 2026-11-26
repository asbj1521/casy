// Where an address in the app leads (#202): a push notification's path
// (_shared/pushText.ts) or a link's (appLinkPath), as the app's own screens.
// The page's router decides today (App.tsx); the app takes over here, the page
// still handling what isn't listed.

import Foundation

/// A screen of the app's own an address opens.
public enum AppRoute: Equatable, Sendable {
    /// The home page itself (`/`, the computer's QR code).
    case home
    /// Aftaler, on one event when it names one (`/events`, `/events/<id>`).
    case events(String?)
    /// A vote's dates to answer (`/events/<id>/dates`, the old swipe screen's address).
    case vote(String)
    /// An invite link (`/join/<token>`).
    case join(String)
    /// Indstillinger (`/profile/settings`, the admin's test notification).
    case settings
}

/// The app's screen for an in-app path, or nil when the page still has it
/// (Grupper, an invitation, a friend link, any other page).
public func appRoute(_ path: String) -> AppRoute? {
    let bare = path.split(separator: "?", maxSplits: 1, omittingEmptySubsequences: false).first.map(String.init) ?? path
    let parts = bare.split(separator: "/").map(String.init)
    guard bare.hasPrefix("/") else { return nil }
    switch parts.count {
    case 0: return .home
    case 1 where parts[0] == "events": return .events(nil)
    case 2 where parts[0] == "events": return .events(parts[1])
    case 2 where parts[0] == "join": return .join(parts[1])
    case 2 where parts == ["profile", "settings"]: return .settings
    case 3 where parts[0] == "events" && parts[2] == "dates": return .vote(parts[1])
    default: return nil
    }
}
