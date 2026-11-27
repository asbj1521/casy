import CasyCore
import Testing

@Test func addressesLeadToTheAppsScreens() {
    #expect(appRoute("/") == .home)
    #expect(appRoute("/events") == .events(nil))
    #expect(appRoute("/events/ev-1") == .events("ev-1"))
    #expect(appRoute("/events/ev-1/dates") == .vote("ev-1"))
    #expect(appRoute("/join/abc123") == .join("abc123"))
    #expect(appRoute("/friend/t") == .friend("t"))
    #expect(appRoute("/events?x=1") == .events(nil))
    #expect(appRoute("/profile/settings") == .settings)
    #expect(appRoute("/groups") == .profile("groups"))
    #expect(appRoute("/groups/g-1") == .profile("group:g-1"))
    #expect(appRoute("/invited/g-1") == .profile("invitation:g-1"))
    #expect(appRoute("/profile/friends") == .profile("friends"))
    #expect(appRoute("/profile/password?password=new") == .profile("newPassword"))
    // Still the page's.
    #expect(appRoute("/privacy") == nil)
    #expect(appRoute("events") == nil)
}

@Test func theQrCodesAddressIsTheApp() {
    #expect(appRoute("/app") == .home)
}

@Test func anAuthEmailsLinkIsTheApps() {
    #expect(appRoute("/sign-in?lang=da&token_hash=abc&type=magiclink") == .emailLink(tokenHash: "abc", type: "magiclink"))
    #expect(appRoute("/sign-in?token_hash=a%2Bb&type=recovery") == .emailLink(tokenHash: "a+b", type: "recovery"))
    // The sign-in page itself, or a link missing half, stays the website's.
    #expect(appRoute("/sign-in") == nil)
    #expect(appRoute("/sign-in?token_hash=abc") == nil)
}
