import UIKit
import Capacitor

/// Capacitor's web view controller, with the few native touches Casy's app
/// needs. Main.storyboard creates this instead of CAPBridgeViewController.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        // From iOS 26, a scroll view fades and blurs what scrolls under its top
        // and bottom edges: a grey haze over the page's own header and tab bar.
        // The page draws its own edges, as the apps it is modelled on do.
        if #available(iOS 26.0, *) {
            webView?.scrollView.topEdgeEffect.isHidden = true
            webView?.scrollView.bottomEdgeEffect.isHidden = true
        }
    }
}
