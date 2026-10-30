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
        CAPPluginMethod(name: "showBar", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setBarVisible", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pressBar", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hideBar", returnType: CAPPluginReturnPromise),
    ]

    private var card: UIVisualEffectView?
    private var badge: UILabel?
    private var label: UILabel?
    /// The home page's bar (#191), by the id the page gave each button.
    private var bar: [String: BarItem] = [:]

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

    // MARK: - The home page's bar (#191)

    /// The home page's three bottom buttons as real glass capsules: each at the
    /// place the page's own button stands (the page's points, from the web
    /// view's top left), with its icon, its words and its badge drawn here, on
    /// the glass. Only pictures: a touch goes through to the web button under,
    /// which stays in charge of every tap. `items` are the buttons now on the
    /// page; one no longer listed is taken away. `visible` fades them in or out.
    @objc func showBar(_ call: CAPPluginCall) {
        let items = call.getArray("items", JSObject.self) ?? []
        let visible = call.getBool("visible")
        let duration = (call.getDouble("duration") ?? 200) / 1000
        DispatchQueue.main.async {
            guard #available(iOS 26.0, *),
                let webView = self.bridge?.webView,
                let host = webView.superview
            else {
                call.reject("No Liquid Glass on this phone")
                return
            }
            let wanted = Set(items.compactMap { $0["id"] as? String })
            for (id, item) in self.bar where !wanted.contains(id) {
                item.remove()
                self.bar[id] = nil
            }
            for raw in items {
                guard let id = raw["id"] as? String else { continue }
                let item: BarItem
                if let known = self.bar[id] {
                    item = known
                } else {
                    item = BarItem()
                    host.insertSubview(item.glass, aboveSubview: webView)
                    host.insertSubview(item.badge, aboveSubview: item.glass)
                    self.bar[id] = item
                }
                item.update(raw, offset: webView.frame.origin)
            }
            if let visible = visible {
                for item in self.bar.values { item.setVisible(visible, duration: duration) }
            }
            call.resolve()
        }
    }

    /// The bar fades in (the glass forming) or out (the glass dissolving).
    @objc func setBarVisible(_ call: CAPPluginCall) {
        let visible = call.getBool("visible") ?? true
        let duration = (call.getDouble("duration") ?? 200) / 1000
        DispatchQueue.main.async {
            for item in self.bar.values { item.setVisible(visible, duration: duration) }
            call.resolve()
        }
    }

    /// A finger on a button's web twin: its glass gives under it, as Apple's does.
    @objc func pressBar(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? ""
        let down = call.getBool("down") ?? false
        DispatchQueue.main.async {
            self.bar[id]?.press(down)
            call.resolve()
        }
    }

    @objc func hideBar(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            for item in self.bar.values { item.remove() }
            self.bar = [:]
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

/// One capsule of the home page's bar (#191): a glass view with its icon and
/// words inside, and its badge on the corner, laid over the web view.
private final class BarItem {
    let glass = UIVisualEffectView(effect: nil)
    let badge = UILabel()
    private let icon = UIImageView()
    private let title = UILabel()
    private var shown = false

    init() {
        glass.layer.cornerCurve = .continuous
        glass.clipsToBounds = true
        // Only a picture: touches go through to the page.
        glass.isUserInteractionEnabled = false

        icon.contentMode = .scaleAspectFit
        title.font = .systemFont(ofSize: 17, weight: .semibold)
        title.lineBreakMode = .byTruncatingTail
        let row = UIStackView(arrangedSubviews: [icon, title])
        row.axis = .horizontal
        row.alignment = .center
        row.spacing = 8
        row.translatesAutoresizingMaskIntoConstraints = false
        glass.contentView.addSubview(row)
        let content = glass.contentView
        NSLayoutConstraint.activate([
            row.centerXAnchor.constraint(equalTo: content.centerXAnchor),
            row.centerYAnchor.constraint(equalTo: content.centerYAnchor),
            row.leadingAnchor.constraint(greaterThanOrEqualTo: content.leadingAnchor, constant: 12),
            row.trailingAnchor.constraint(lessThanOrEqualTo: content.trailingAnchor, constant: -12),
        ])
        icon.alpha = 0
        title.alpha = 0

        badge.font = .systemFont(ofSize: 11, weight: .semibold)
        badge.textColor = .white
        badge.textAlignment = .center
        badge.clipsToBounds = true
        badge.isUserInteractionEnabled = false
        badge.alpha = 0
    }

    /// Where the page's button stands now, and what it says.
    func update(_ raw: JSObject, offset: CGPoint) {
        func number(_ key: String) -> CGFloat {
            CGFloat((raw[key] as? NSNumber)?.doubleValue ?? 0)
        }
        func colour(_ key: String, _ fallback: UIColor) -> UIColor {
            guard let rgb = raw[key] as? [Any], rgb.count >= 3,
                let r = (rgb[0] as? NSNumber)?.doubleValue,
                let g = (rgb[1] as? NSNumber)?.doubleValue,
                let b = (rgb[2] as? NSNumber)?.doubleValue
            else { return fallback }
            return UIColor(red: r / 255, green: g / 255, blue: b / 255, alpha: 1)
        }
        let frame = CGRect(
            x: number("x") + offset.x, y: number("y") + offset.y,
            width: number("width"), height: number("height"))
        // A press in flight keeps its scale: only the frame moves.
        let scale = glass.transform
        glass.transform = .identity
        glass.frame = frame
        glass.layer.cornerRadius = frame.height / 2
        glass.transform = scale

        let tint = colour("tint", .systemOrange)
        let size = max(number("iconSize"), 16)
        let candidates = (raw["symbols"] as? [String]) ?? []
        let configuration = UIImage.SymbolConfiguration(pointSize: size, weight: .semibold)
        icon.image = candidates.lazy
            .compactMap { UIImage(systemName: $0, withConfiguration: configuration) }
            .first
        icon.tintColor = tint
        let words = raw["title"] as? String
        title.text = words
        title.isHidden = words == nil
        title.textColor = tint

        let count = (raw["badge"] as? NSNumber)?.intValue ?? 0
        badge.isHidden = count <= 0
        if count > 0 {
            badge.text = "\(count)"
            badge.backgroundColor = colour("badgeTint", .systemOrange)
            let width = max(20, badge.intrinsicContentSize.width + 10)
            // On the capsule's top right corner, a little outside it, as the page's was.
            badge.frame = CGRect(x: frame.maxX + 4 - width, y: frame.minY - 4, width: width, height: 20)
            badge.layer.cornerRadius = 10
        }
    }

    func setVisible(_ visible: Bool, duration: TimeInterval) {
        guard visible != shown else { return }
        shown = visible
        // Setting the effect inside an animation forms the glass (or dissolves
        // it), as Apple's own bars do; the words and badge fade beside it.
        UIView.animate(withDuration: duration) {
            if #available(iOS 26.0, *) {
                // The clear variant: little of what is behind it mixes into the glass,
                // where the regular one turned muddy over the busy calendar (#191).
                self.glass.effect = visible ? UIGlassEffect(style: .clear) : nil
            }
            self.icon.alpha = visible ? 1 : 0
            self.title.alpha = visible ? 1 : 0
            self.badge.alpha = visible ? 1 : 0
        }
    }

    func press(_ down: Bool) {
        UIView.animate(
            withDuration: 0.25, delay: 0, usingSpringWithDamping: 0.6, initialSpringVelocity: 0,
            options: [.allowUserInteraction, .beginFromCurrentState]
        ) {
            self.glass.transform = down ? CGAffineTransform(scaleX: 0.94, y: 0.94) : .identity
        }
    }

    func remove() {
        glass.removeFromSuperview()
        badge.removeFromSuperview()
    }
}
