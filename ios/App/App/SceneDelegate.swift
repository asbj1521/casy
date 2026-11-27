import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        // Info.plist already builds the window from Main.storyboard (with its
        // CAPBridgeViewController) before this runs. Capacitor's template also
        // made a second window and web view here, and on iOS 27 the visible one
        // stayed frozen, a blank white screen, so the storyboard's is the only one.
        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
        // A link that launched the app, without its page (#202): the app opens it itself.
        for activity in connectionOptions.userActivities { openWithoutPage(activity) }
    }

    /// An invite link or the like (casy.app/join/…), opened by the app's own
    /// routing when there is no page to hand it to (#202, "Uden side").
    private func openWithoutPage(_ activity: NSUserActivity) {
        guard PageFree.on, activity.activityType == NSUserActivityTypeBrowsingWeb, let url = activity.webpageURL
        else { return }
        let path = url.path.isEmpty ? "/" : url.path
        let query = url.query.map { "?\($0)" } ?? ""
        Task { @MainActor in PushWork.shared.open(path + query) }
    }

    /// Leaving the app: ask iOS to wake it later to send the phone's calendars.
    func sceneDidEnterBackground(_ scene: UIScene) {
        PhoneCalendarBackground.schedule()
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
        openWithoutPage(userActivity)
    }
}
