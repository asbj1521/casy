#if canImport(UIKit)
    import SnapshotTesting
    import SwiftUI
    import Testing
    import UIKit

    @testable import CasyUI

    // Every piece on one screen, light and dark: layout, colours and words. Run
    // on the pinned simulator only (scripts/native/snapshots.sh). Drawn off
    // screen, so Liquid Glass doesn't show: glass is judged on a real phone.

    private struct Gallery: View {
        @State private var on = true
        @State private var text = "Fredagsbar"

        var body: some View {
            NavigationStack {
                List {
                    Section("Rækker") {
                        ListRow("Grupper", systemImage: "person.2", value: "3")
                        ListRow("Slet konto", systemImage: "trash", tone: .danger)
                        ListPickRow("Dansk", isSelected: true) {}
                        ListPickRow("English", isSelected: false) {}
                        ListSwitchRow("Tid til hinanden", isOn: $on, detail: "Stjerner på din forside")
                    }
                    Section {
                        CasyField("Hvad skal I", text: $text)
                    }
                    Section {
                        Notice("Kunne ikke hente dine grupper", tone: .error)
                        Notice("Gemt", tone: .success)
                        Notice("Din kalender er ikke opdateret", tone: .warning)
                        Notice("Casy viser dansk tid", tone: .info)
                        Notice("Sendt", tone: .success, bare: true)
                    }
                    Section("Knapper") {
                        GlassButton(systemImage: "plus") {} label: { Text("Planlæg") }
                        GlassButton(size: .small) {} label: { Text("Inviter") }
                        FlowButton {} label: { Text("Foreslå datoer") }
                        FlowButton(kind: .quiet) {} label: { Text(CasyStrings.cancel) }
                        FlowButton(kind: .danger) {} label: { Text("Slet") }
                        FlowButton(busy: true) {} label: { Text("Sender") }
                    }
                    Section {
                        HStack(spacing: 8) {
                            ForEach(0..<5, id: \.self) { index in
                                Avatar(
                                    name: ["Emilie", "Tessa", "Mia", "Øjvind", "Sara"][index],
                                    index: index, size: .row)
                            }
                        }
                    }
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
                .background(Theme.background.color)
                .navigationTitle("CasyUI")
            }
        }
    }

    @MainActor
    @Suite(.serialized)
    struct GallerySnapshotTests {
        private func snapshot(_ style: UIUserInterfaceStyle, named name: String) {
            let controller = UIHostingController(rootView: Gallery())
            controller.overrideUserInterfaceStyle = style
            assertSnapshot(
                of: controller,
                as: .image(
                    on: ViewImageConfig(
                        safeArea: .zero, size: CGSize(width: 390, height: 1500),
                        traits: UITraitCollection(userInterfaceStyle: style)),
                    precision: 0.99,
                    perceptualPrecision: 0.98),
                named: name)
        }

        @Test func light() { snapshot(.light, named: "light") }
        @Test func dark() { snapshot(.dark, named: "dark") }
    }
#endif
