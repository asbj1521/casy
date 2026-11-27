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
    /// A friend link (`/friend/<token>`, #226).
    case friend(String)
    /// Indstillinger (`/profile/settings`, the admin's test notification).
    case settings
    /// An auth email's link (#202, `/sign-in?token_hash=…&type=…`): the app signs in with it.
    case emailLink(tokenHash: String, type: String)
    /// Profil on one of its screens, as ProfileStart names it: Grupper
    /// (`/groups`, "groups"), a group (`/groups/<id>`, "group:<id>"), an
    /// invitation waiting for you (`/invited/<id>`, "invitation:<id>").
    case profile(String)
}

/// The app's screen for an in-app path, or nil when the page still has it
/// (any other page).
public func appRoute(_ path: String) -> AppRoute? {
    let bare = path.split(separator: "?", maxSplits: 1, omittingEmptySubsequences: false).first.map(String.init) ?? path
    let parts = bare.split(separator: "/").map(String.init)
    guard bare.hasPrefix("/") else { return nil }
    switch parts.count {
    case 0: return .home
    // The computer's QR code (#270): just the app.
    case 1 where parts[0] == "app": return .home
    case 1 where parts[0] == "sign-in":
        let query = path.split(separator: "?", maxSplits: 1).dropFirst().first.map(String.init) ?? ""
        let items = URLComponents(string: "?" + query)?.queryItems ?? []
        guard let hash = items.first(where: { $0.name == "token_hash" })?.value, !hash.isEmpty,
            let type = items.first(where: { $0.name == "type" })?.value, !type.isEmpty
        else { return nil }
        return .emailLink(tokenHash: hash, type: type)
    case 1 where parts[0] == "events": return .events(nil)
    case 2 where parts[0] == "events": return .events(parts[1])
    case 2 where parts[0] == "join": return .join(parts[1])
    case 2 where parts[0] == "friend": return .friend(parts[1])
    case 2 where parts == ["profile", "settings"]: return .settings
    case 1 where parts[0] == "groups": return .profile("groups")
    case 2 where parts == ["profile", "friends"]: return .profile("friends")
    // The weak password's note (`?password=new`) and the old address of Sikkerhed.
    case 2 where parts == ["profile", "password"]: return .profile("newPassword")
    case 2 where parts[0] == "groups": return .profile("group:\(parts[1])")
    case 2 where parts[0] == "invited": return .profile("invitation:\(parts[1])")
    case 3 where parts[0] == "events" && parts[2] == "dates": return .vote(parts[1])
    default: return nil
    }
}
