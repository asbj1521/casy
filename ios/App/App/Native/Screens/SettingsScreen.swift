import CasyAPI
import CasyUI
import SwiftUI

/// What the web view said the person chose. The web view stays in charge of
/// both until Phase 6: a choice made here is sent to it (`onChoose`), which
/// applies it as its own rows do.
@MainActor @Observable
final class NativePreferences {
    static let shared = NativePreferences()

    /// "da" or "en".
    var lang = "da" {
        didSet { CasyStrings.language = lang }
    }
    /// "system", "light" or "dark".
    var theme = "system"
}

/// Indstillinger as a native screen (#198). Debug builds only, until it has
/// Notifikationer too (see `nativeScreens`).
struct SettingsScreen: View {
    let preferences: NativePreferences
    let onChoose: (_ lang: String, _ theme: String) -> Void
    let onDone: () -> Void

    #if DEBUG
        /// Proof on a real phone that CasyAPI reaches the live functions.
        @State private var serverSays: String?
    #endif

    var body: some View {
        NavigationStack {
            List {
                Section(CasyStrings.settingsLanguage) {
                    // Each language by its own name, whatever the screen is in.
                    ListPickRow("Dansk", isSelected: preferences.lang == "da") { pick(lang: "da") }
                    ListPickRow("English", isSelected: preferences.lang == "en") {
                        pick(lang: "en")
                    }
                }
                Section {
                    ListPickRow(
                        CasyStrings.settingsSystem, isSelected: preferences.theme == "system"
                    ) { pick(theme: "system") }
                    ListPickRow(
                        CasyStrings.settingsLight, isSelected: preferences.theme == "light"
                    ) { pick(theme: "light") }
                    ListPickRow(CasyStrings.settingsDark, isSelected: preferences.theme == "dark") {
                        pick(theme: "dark")
                    }
                } header: {
                    Text(CasyStrings.settingsAppearance)
                } footer: {
                    #if DEBUG
                        if let serverSays { Text(serverSays) }
                    #endif
                }
            }
            .navigationTitle(CasyStrings.settingsTitle)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(CasyStrings.done, action: onDone)
                }
            }
        }
        .tint(Theme.primary.color)
        .id(preferences.lang)
        .preferredColorScheme(colorScheme)
        #if DEBUG
            .task {
                do {
                    guard let api = await Native.api() else {
                        serverSays = "No login from the web view"
                        return
                    }
                    serverSays = "Server: \(try await api.whoAmI().name)"
                } catch {
                    serverSays = error.localizedDescription
                }
            }
        #endif
    }

    private var colorScheme: ColorScheme? {
        switch preferences.theme {
        case "light": .light
        case "dark": .dark
        default: nil
        }
    }

    private func pick(lang: String? = nil, theme: String? = nil) {
        if let lang { preferences.lang = lang }
        if let theme { preferences.theme = theme }
        onChoose(preferences.lang, preferences.theme)
    }
}
