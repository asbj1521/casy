import Capacitor
import StoreKit
import UIKit

/// Asking for a rating on the App Store (#256): iOS's own small sheet, with
/// stars and nothing to leave the app for. iOS alone decides whether it shows
/// (at most three times a year, never in a TestFlight build, and not again
/// once the person has rated or turned the asks off), so this only asks;
/// the page chooses when (lib/appReview.ts: a moment that went well).
public class ReviewPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ReviewPlugin"
    public let jsName = "Review"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise)
    ]

    /// Asks iOS to offer the rating sheet in the window Casy is showing.
    @objc func request(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let scene = self.bridge?.viewController?.view.window?.windowScene else {
                call.reject("No screen to ask on")
                return
            }
            AppStore.requestReview(in: scene)
            call.resolve()
        }
    }
}
