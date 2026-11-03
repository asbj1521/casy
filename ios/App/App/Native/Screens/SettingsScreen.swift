import SwiftUI
import UIKit

/// What the web view said the person chose, and what a native screen changes
/// (#196). The web view stays in charge of both until Phase 6: a choice made
/// here is sent to it (`onChoose`), which applies it the way its own rows do.
@MainActor @Observable
final class NativePreferences {
    static let shared = NativePreferences()

    /// "da" or "en".
    var lang = "da"
    /// "system", "light" or "dark".
    var theme = "system"
}

/// Casy's orange (`--primary` in theme.css: hsl(20 90% 48%), 55% in dark), as
/// SwiftUI's hue, saturation and brightness. Moves to CasyUI in Phase 1.
private let casyOrange = Color(
    uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(hue: 20 / 360, saturation: 0.848, brightness: 0.955, alpha: 1)
            : UIColor(hue: 20 / 360, saturation: 0.947, brightness: 0.912, alpha: 1)
    })

/// The words, as `da.tsx` and `en.tsx` have them (`profileHub.settings`,
/// `language`, `appearance`). The String Catalog replaces this in Phase 1.
private struct Words {
    let settings, language, appearance, system, light, dark, done, chosen: String
    let signedInAs: (String) -> String

    static func of(_ lang: String) -> Words {
        lang == "en"
            ? Words(
                settings: "Settings", language: "Language", appearance: "Appearance",
                system: "Match system", light: "Light", dark: "Dark", done: "Done",
                chosen: "Chosen", signedInAs: { "Signed in as \($0)" })
            : Words(
                settings: "Indstillinger", language: "Sprog", appearance: "Udseende",
                system: "Følg systemet", light: "Lys", dark: "Mørk", done: "Færdig",
                chosen: "Valgt", signedInAs: { "Logget ind som \($0)" })
    }
}

/// Indstillinger as a native screen (#196): Sprog and Udseende, each a list
/// with an orange tick by the choice, as the web's `SettingsGroups` draws
/// them. The footnote, who you are signed in as, is the spike's proof that a
/// native screen can call Casy's server with the web view's login.
struct SettingsScreen: View {
    let preferences: NativePreferences
    let onChoose: (_ lang: String, _ theme: String) -> Void
    let onDone: () -> Void

    @State private var signedIn: String?
    #if DEBUG
    @State private var labButton = GlassLab.shared.isVisible
    #endif

    private struct WhoAmI: Decodable { let name: String }

    var body: some View {
        let words = Words.of(preferences.lang)
        NavigationStack {
            List {
                Section(words.language) {
                    // Each language by its own name, whatever the screen is in.
                    choice("Dansk", chosen: preferences.lang == "da", words) { pick(lang: "da") }
                    choice("English", chosen: preferences.lang == "en", words) { pick(lang: "en") }
                }
                Section {
                    choice(words.system, chosen: preferences.theme == "system", words) {
                        pick(theme: "system")
                    }
                    choice(words.light, chosen: preferences.theme == "light", words) {
                        pick(theme: "light")
                    }
                    choice(words.dark, chosen: preferences.theme == "dark", words) {
                        pick(theme: "dark")
                    }
                } header: {
                    Text(words.appearance)
                } footer: {
                    if let signedIn { Text(words.signedInAs(signedIn)) }
                }
                #if DEBUG
                // The spike's experiments (#196), in Debug builds only.
                Section("Spike") {
                    Toggle("Glass test button", isOn: $labButton)
                        .onChange(of: labButton) { _, on in GlassLab.shared.setVisible(on) }
                    // SpeechAnalyzer is iOS 26's: an older phone has only the old recognizer.
                    if #available(iOS 26, *) {
                        NavigationLink("Speech in Danish") { SpeechLab() }
                    }
                    NavigationLink("Web view storage") { StorageLab() }
                }
                #endif
            }
            .navigationTitle(words.settings)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(words.done, action: onDone)
                }
            }
        }
        .tint(casyOrange)
        .task(id: preferences.lang) {
            do {
                let me = try await EdgeFunctions.call(
                    "groups", body: ["action": "whoami"], lang: preferences.lang, as: WhoAmI.self)
                signedIn = me.name
            } catch {
                signedIn = error.localizedDescription
            }
        }
    }

    /// A row that is picked by a tap, with an orange tick at its end when it is
    /// the choice (the design language's rule 5).
    private func choice(
        _ label: String, chosen: Bool, _ words: Words, action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack {
                Text(label).foregroundStyle(.primary)
                Spacer()
                if chosen {
                    Image(systemName: "checkmark")
                        .fontWeight(.semibold)
                        .foregroundStyle(casyOrange)
                        .accessibilityLabel(words.chosen)
                }
            }
        }
        .accessibilityAddTraits(chosen ? .isSelected : [])
    }

    private func pick(lang: String? = nil, theme: String? = nil) {
        if let lang { preferences.lang = lang }
        if let theme { preferences.theme = theme }
        onChoose(preferences.lang, preferences.theme)
    }
}
