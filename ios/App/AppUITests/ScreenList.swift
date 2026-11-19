import XCTest

extension XCUIApplication {
    /// The redone screens' scroll views (#281), deepest first.
    static let redoneLists = ["vote.screen", "dated.screen", "events.list", "admin.screen", "account.screen", "mydata.list", "friends.list", "group.screen", "groups.list", "settings.list", "profile.list"]

    /// The open screen's list, to scroll it as a person would: a screen redone
    /// on CasyUI's CardList (#281) is a scroll view with its own identifier,
    /// one not yet redone a SwiftUI List (a collection view). Of several on
    /// the stack (Profil under Grupper), the one on top. Found by name each
    /// time, as an element found by its place moves as the lists change.
    var screenList: XCUIElement {
        if collectionViews.firstMatch.exists, collectionViews.firstMatch.isHittable {
            return collectionViews.firstMatch
        }
        for id in Self.redoneLists where scrollViews[id].exists && scrollViews[id].isHittable {
            return scrollViews[id]
        }
        return collectionViews.firstMatch
    }

    /// The scroll view on top that is none of the lists (a help page's).
    var pageScroll: XCUIElement {
        let pages = scrollViews.matching(NSPredicate(format: "NOT (identifier IN %@)", Self.redoneLists))
        for i in stride(from: pages.count - 1, through: 0, by: -1) where pages.element(boundBy: i).isHittable {
            return pages.element(boundBy: i)
        }
        return pages.firstMatch
    }
}
