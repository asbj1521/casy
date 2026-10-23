import Capacitor
import UIKit

/// Apple's own Liquid Glass (iOS 26, `UIGlassEffect`) for one card on the page
/// (#151, the welcome screen's step caption). A web view can't bend what is
/// behind it (WebKit's backdrop filter only blurs), so the card is drawn here:
/// a real glass view laid over the web view at the place the page reserves for
/// it, refracting the page underneath, with the step's number and words inside.
/// It never takes a touch; the page under it stays in charge. Before iOS 26
/// `available` says no, and the page draws its own (CSS) glass instead.
public class GlassPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GlassPlugin"
    public let jsName = "Glass"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hide", returnType: CAPPluginReturnPromise),
    ]

    private var card: UIVisualEffectView?
    private var badge: UILabel?
    private var label: UILabel?

    @objc func available(_ call: CAPPluginCall) {
        if #available(iOS 26.0, *) {
            call.resolve(["available": true])
        } else {
            call.resolve(["available": false])
        }
    }

    /// The card at `x`, `y`, `width`, `height` (the page's own points, from the
    /// web view's top left), rounded by `radius`, saying `number` and `text`
    /// with the badge in `accent` (r, g, b). A change of words cross-fades.
    @objc func show(_ call: CAPPluginCall) {
        let frame = CGRect(
            x: call.getDouble("x") ?? 0,
            y: call.getDouble("y") ?? 0,
            width: call.getDouble("width") ?? 0,
            height: call.getDouble("height") ?? 0)
        let radius = CGFloat(call.getDouble("radius") ?? 24)
        let number = call.getString("number") ?? ""
        let text = call.getString("text") ?? ""
        let accent = call.getArray("accent", Double.self) ?? [234, 88, 12]
        DispatchQueue.main.async {
            guard #available(iOS 26.0, *),
                let webView = self.bridge?.webView,
                let host = webView.superview
            else {
                call.reject("No Liquid Glass on this phone")
                return
            }
            let card = self.card ?? self.makeCard(in: host, above: webView)
            card.frame = frame.offsetBy(dx: webView.frame.minX, dy: webView.frame.minY)
            card.layer.cornerRadius = radius
            self.badge?.backgroundColor = UIColor(
                red: accent[0] / 255, green: accent[1] / 255, blue: accent[2] / 255, alpha: 1)
            if self.label?.text != text || self.badge?.text != number {
                let swap = {
                    self.badge?.text = number
                    self.label?.text = text
                }
                if self.label?.text == nil {
                    swap()
                } else {
                    UIView.transition(
                        with: card.contentView, duration: 0.25, options: .transitionCrossDissolve,
                        animations: swap)
                }
            }
            call.resolve()
        }
    }

    @objc func hide(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.card?.removeFromSuperview()
            self.card = nil
            self.badge = nil
            self.label = nil
            call.resolve()
        }
    }

    @available(iOS 26.0, *)
    private func makeCard(in host: UIView, above webView: UIView) -> UIVisualEffectView {
        let glass = UIGlassEffect()
        let card = UIVisualEffectView(effect: glass)
        card.layer.cornerCurve = .continuous
        card.clipsToBounds = true
        // Only a picture: touches go through to the page.
        card.isUserInteractionEnabled = false

        let badge = UILabel()
        badge.font = .systemFont(ofSize: 22, weight: .bold)
        badge.textColor = .white
        badge.textAlignment = .center
        badge.layer.cornerRadius = 24
        badge.clipsToBounds = true

        let label = UILabel()
        label.font = .systemFont(ofSize: 20, weight: .semibold)
        label.textColor = .label
        label.numberOfLines = 0

        let row = UIStackView(arrangedSubviews: [badge, label])
        row.axis = .horizontal
        row.alignment = .center
        row.spacing = 16
        row.translatesAutoresizingMaskIntoConstraints = false
        card.contentView.addSubview(row)
        NSLayoutConstraint.activate([
            badge.widthAnchor.constraint(equalToConstant: 48),
            badge.heightAnchor.constraint(equalToConstant: 48),
            row.leadingAnchor.constraint(equalTo: card.contentView.leadingAnchor, constant: 22),
            row.trailingAnchor.constraint(
                lessThanOrEqualTo: card.contentView.trailingAnchor, constant: -22),
            row.centerYAnchor.constraint(equalTo: card.contentView.centerYAnchor),
        ])

        host.insertSubview(card, aboveSubview: webView)
        self.card = card
        self.badge = badge
        self.label = label
        return card
    }
}
