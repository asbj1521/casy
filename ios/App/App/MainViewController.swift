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
        // A tap at the very top of the screen (by the Dynamic Island) goes to
        // the page (#168): iOS would only scroll the web view itself, and
        // Casy's screens scroll inside the page.
        webView?.scrollView.scrollsToTop = false
        let catcher = StatusTapCatcher()
        catcher.onTap = { [weak self] in
            self?.webView?.evaluateJavaScript("window.dispatchEvent(new Event('casy:status-tap'))")
        }
        view.addSubview(catcher)
        // From iOS 26, a scroll view fades and blurs what scrolls under its top
        // and bottom edges: a grey haze over the page's own header and tab bar.
        // The page draws its own edges, as the apps it is modelled on do.
        if #available(iOS 26.0, *) {
            webView?.scrollView.topEdgeEffect.isHidden = true
            webView?.scrollView.bottomEdgeEffect.isHidden = true
        }
    }
}

/// Catches the tap at the very top of the screen (#168). iOS scrolls the one
/// scroll view with `scrollsToTop` to its top on that tap; this invisible
/// one, a point in the corner, is it, kept just below its own top so it is
/// always one iOS would scroll. It asks its delegate first, which hands the
/// tap on and says no, so it never moves.
final class StatusTapCatcher: UIScrollView, UIScrollViewDelegate {
    var onTap: (() -> Void)?

    init() {
        super.init(frame: CGRect(x: 0, y: 0, width: 1, height: 1))
        delegate = self
        scrollsToTop = true
        backgroundColor = .clear
        showsVerticalScrollIndicator = false
        contentSize = CGSize(width: 1, height: 2)
        contentOffset = CGPoint(x: 0, y: 1)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not used")
    }

    func scrollViewShouldScrollToTop(_ scrollView: UIScrollView) -> Bool {
        onTap?()
        return false
    }
}
