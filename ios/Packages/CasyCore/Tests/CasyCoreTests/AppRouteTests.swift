import CasyCore
import Testing

@Test func addressesLeadToTheAppsScreens() {
    #expect(appRoute("/") == .home)
    #expect(appRoute("/events") == .events(nil))
    #expect(appRoute("/events/ev-1") == .events("ev-1"))
    #expect(appRoute("/events/ev-1/dates") == .vote("ev-1"))
    #expect(appRoute("/join/abc123") == .join("abc123"))
    #expect(appRoute("/events?x=1") == .events(nil))
    #expect(appRoute("/profile/settings") == .settings)
    // Still the page's.
    #expect(appRoute("/groups") == nil)
    #expect(appRoute("/invited/g-1") == nil)
    #expect(appRoute("/friend/t") == nil)
    #expect(appRoute("/privacy") == nil)
    #expect(appRoute("events") == nil)
}
