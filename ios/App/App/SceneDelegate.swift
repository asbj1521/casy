import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        // Info.plist builds the window from Main.storyboard (AppViewController) before this runs.
        // A link that launched the app, without its page (#202): the app opens it itself.
        for activity in connectionOptions.userActivities { openWithoutPage(activity) }
    }

    /// An invite link or the like (casy.app/join/…), opened by the app's own routing (#202).
    private func openWithoutPage(_ activity: NSUserActivity) {
        guard activity.activityType == NSUserActivityTypeBrowsingWeb, let url = activity.webpageURL
        else { return }
        let path = url.path.isEmpty ? "/" : url.path
        let query = url.query.map { "?\($0)" } ?? ""
        Task { @MainActor in PushWork.shared.open(path + query) }
    }

    /// Leaving the app: ask iOS to wake it later to send the phone's calendars.
    func sceneDidEnterBackground(_ scene: UIScene) {
        PhoneCalendarBackground.schedule()
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        openWithoutPage(userActivity)
    }
}
