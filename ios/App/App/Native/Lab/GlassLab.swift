#if DEBUG
import SwiftUI
import UIKit

/// The spike's sheet experiment (#196, step 4): a native glass button over
/// the web view that opens a sheet growing out of it (iOS 26's zoom from a
/// `matchedTransitionSource`), started at one of three heights, to see which
/// of them the zoom handles (it is reported to misbehave with `.medium`).
/// Debug builds only, switched on from the native Settings' Spike section;
/// never in a TestFlight or App Store build. Deleted when the spike ends.
@MainActor
final class GlassLab {
    static let shared = GlassLab()

    /// The page's view controller, given by NativeBridgePlugin as it loads.
    weak var host: UIViewController?
    private var button: UIHostingController<LabButton>?

    var isVisible: Bool { button != nil }

    func setVisible(_ visible: Bool) {
        if visible, button == nil, let host {
            let controller = UIHostingController(rootView: LabButton())
            controller.view.backgroundColor = .clear
            controller.sizingOptions = .intrinsicContentSize
            host.addChild(controller)
            host.view.addSubview(controller.view)
            controller.view.translatesAutoresizingMaskIntoConstraints = false
            NSLayoutConstraint.activate([
                controller.view.trailingAnchor.constraint(
                    equalTo: host.view.safeAreaLayoutGuide.trailingAnchor, constant: -20),
                // Above the home page's own buttons along the bottom.
                controller.view.bottomAnchor.constraint(
                    equalTo: host.view.safeAreaLayoutGuide.bottomAnchor, constant: -84),
            ])
            controller.didMove(toParent: host)
            button = controller
        } else if !visible, let button {
            button.willMove(toParent: nil)
            button.view.removeFromSuperview()
            button.removeFromParent()
            self.button = nil
        }
    }
}

/// The height a sheet starts at, picked inside the sheet for the next opening.
private enum LabHeight: String, CaseIterable, Identifiable {
    case medium = "Medium"
    case fraction = "60 %"
    case large = "Large"

    var id: String { rawValue }

    var detent: PresentationDetent {
        switch self {
        case .medium: return .medium
        case .fraction: return .fraction(0.6)
        case .large: return .large
        }
    }
}

/// The floating button, and the sheet it grows into.
struct LabButton: View {
    @Namespace private var zoom
    @State private var open = false
    @State private var height = LabHeight.medium
    @State private var opened = 0

    var body: some View {
        Button {
            opened += 1
            open = true
        } label: {
            Image(systemName: "flask")
                .font(.title2)
                .frame(width: 56, height: 56)
        }
        .buttonStyle(.glass)
        .buttonBorderShape(.circle)
        .matchedTransitionSource(id: "lab", in: zoom)
        .padding(4)
        .sheet(isPresented: $open) {
            NavigationStack {
                List {
                    Section {
                        ForEach(LabHeight.allCases) { choice in
                            Button {
                                height = choice
                            } label: {
                                HStack {
                                    Text(choice.rawValue).foregroundStyle(.primary)
                                    Spacer()
                                    if height == choice {
                                        Image(systemName: "checkmark").foregroundStyle(.orange)
                                    }
                                }
                            }
                        }
                    } header: {
                        // The sheet takes it at once, and the next opening starts there.
                        Text("Height")
                    } footer: {
                        Text("Opened \(opened) times")
                    }
                }
                .navigationTitle("Glass sheet")
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { open = false }
                    }
                }
            }
            .presentationDetents([height.detent])
            .navigationTransition(.zoom(sourceID: "lab", in: zoom))
        }
    }
}
#endif
