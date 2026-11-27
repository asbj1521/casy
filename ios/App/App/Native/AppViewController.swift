import UIKit

/// The app's root screen (#202): the launch screen's colour, light or dark as
/// chosen in Settings, so nothing flashes before the first screen is drawn.
/// AppCoordinator places the home page in it and presents everything over it.
/// Main.storyboard makes it.
final class AppViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        overrideUserInterfaceStyle = AppAppearance.stored()
        view.backgroundColor = UIColor(named: "LaunchBackground")
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        AppCoordinator.shared.start(root: self)
    }
}
