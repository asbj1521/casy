import UIKit
import Capacitor

/// Capacitor's web view controller, with the few native touches Casy's app
/// needs. Main.storyboard creates this instead of CAPBridgeViewController.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        // The theme chosen in Casy's Settings (#129), before anything is drawn;
        // without one, the phone's own.
        overrideUserInterfaceStyle = AppAppearance.stored()
        // Casy's page background behind the web view, light or dark as the
        // phone is (the launch screen's colour), so it never flashes white
        // before the page is drawn (#93).
        let background = UIColor(named: "LaunchBackground")
        view.backgroundColor = background
        webView?.isOpaque = false
        webView?.backgroundColor = background
        webView?.scrollView.backgroundColor = background
        // The app's own plugin (not an npm package), so it is registered here.
        bridge?.registerPluginInstance(PhoneCalendarPlugin())
        // Inviting friends from the contacts, by message (#149).
        bridge?.registerPluginInstance(InvitePlugin())
        // Apple's own Liquid Glass for a card on the page (#151).
        bridge?.registerPluginInstance(GlassPlugin())
        // Sign in with Apple (#138).
        bridge?.registerPluginInstance(AppleSignInPlugin())
        // From iOS 26, a scroll view fades and blurs what scrolls under its top
        // and bottom edges: a grey haze over the page's own header and tab bar.
        // The page draws its own edges, as the apps it is modelled on do.
        if #available(iOS 26.0, *) {
            webView?.scrollView.topEdgeEffect.isHidden = true
            webView?.scrollView.bottomEdgeEffect.isHidden = true
        }
    }
}
