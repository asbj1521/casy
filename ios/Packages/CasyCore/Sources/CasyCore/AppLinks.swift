// Links that open the app (#140), and the invite in a pasted text (#237):
// src/lib/appLinks.ts, kept equal by its parity fixture (appLinks.json).

import Foundation

/// The sites whose links the app opens: casy.app, the door (#257) and the name's own domains (#271).
private let appLinkHosts: Set<String> = [
    "casy.app", "casy-red.vercel.app",
    "vifinderligeendag.dk", "www.vifinderligeendag.dk",
    "vifinderligeendag.com", "www.vifinderligeendag.com",
]

/// The in-app path a URL leads to, or nil when it isn't a link the app opens:
/// an invite (`/join/<token>`), a friend link (`/friend/<token>`), or `/app` (the home page).
public func appLinkPath(_ url: String) -> String? {
    // The web's URL reads the host in small letters and leaves the path encoded.
    guard let parts = URLComponents(string: url), parts.scheme?.lowercased() == "https",
        let host = parts.host?.lowercased(), appLinkHosts.contains(host)
    else { return nil }
    let path = parts.percentEncodedPath
    if path.wholeMatch(of: /\/app\/?/) != nil { return "/" }
    guard let link = path.wholeMatch(of: /\/(join|friend)\/([^\/]+)\/?/) else { return nil }
    return "/\(link.1)/\(link.2)"
}

/// The invite in a pasted text, as the in-app path it leads to: the link alone,
/// or among other words ("Kom med: https://casy.app/join/…!"), as a chat copies it.
public func inviteInText(_ text: String) -> String? {
    for found in text.matches(of: /https:\/\/[^\s<>"']+/) {
        // A sentence's end is not the link's.
        let link = String(found.output).replacing(/[.,;:!?)\]]+$/, with: "")
        if let path = appLinkPath(link) { return path }
    }
    return nil
}
