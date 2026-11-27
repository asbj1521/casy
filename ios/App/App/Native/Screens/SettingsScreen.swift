import CasyAPI
import CasyUI
import SwiftUI
import UserNotifications

/// The language and look the person chose. The page says them while it is
/// there (`setPreferences`) and is told a choice made here (`onChoose`); the
/// app keeps them itself too (#202), so without the page they stay as chosen.
@MainActor @Observable
final class NativePreferences {
    static let shared = NativePreferences()

    private static let langKey = "casy.lang"

    /// "da" or "en".
    var lang = UserDefaults.standard.string(forKey: NativePreferences.langKey) ?? "da" {
        didSet {
            CasyStrings.language = lang
            UserDefaults.standard.set(lang, forKey: Self.langKey)
            // The server writes notifications in the language registered (#202).
            if lang != oldValue { PushWork.shared.languageChanged() }
        }
    }
    /// "system", "light" or "dark".
    var theme = UserDefaults.standard.string(forKey: AppAppearance.key) ?? "system" {
        didSet {
            UserDefaults.standard.set(theme, forKey: AppAppearance.key)
            applyTheme()
        }
    }

    private init() {
        CasyStrings.language = lang
    }

    /// The whole app in the chosen look: its window, so every sheet and the home page follow.
    func applyTheme() {
        let style = AppAppearance.style(theme)
        for case let scene as UIWindowScene in UIApplication.shared.connectedScenes {
            for window in scene.windows { window.overrideUserInterfaceStyle = style }
        }
    }
}

/// Indstillinger opened by itself, from the web's profile row.
struct SettingsScreen: View {
    let preferences: NativePreferences
    let onChoose: (_ lang: String, _ theme: String) -> Void
    let onDone: () -> Void
    let enablePush: () async -> String

    var body: some View {
        NavigationStack {
            SettingsList(
                preferences: preferences, onChoose: onChoose, onDone: onDone,
                enablePush: enablePush)
        }
        .nativeSheetLook(preferences)
    }
}

/// Indstillinger's top bar: its own sheet's, or a screen's pushed inside Profil.
private struct SettingsBar: ViewModifier {
    let pushed: Bool
    /// Only so a new language draws the bar again: its words are read from CasyStrings.
    let lang: String
    let onDone: () -> Void

    func body(content: Content) -> some View {
        if pushed {
            content.casyPushedBar(CasyStrings.settingsTitle, close: CasyStrings.done, action: onDone)
        } else {
            content.casySheetBar(CasyStrings.settingsTitle, close: CasyStrings.done, action: onDone)
        }
    }
}

extension EnvironmentValues {
    /// Closes the whole sheet a screen is pushed inside: its Færdig (design rule 11).
    @Entry var closeSheet: () -> Void = {}
    /// Pulls a half-height sheet up to the whole screen, once it has more to show.
    @Entry var growSheet: () -> Void = {}
    /// Makes the sheet as tall as its bar and content measure (a trip's).
    @Entry var fitSheet: (CGFloat) -> Void = { _ in }
}

extension View {
    /// Casy's orange, and Casy's own light or dark choice.
    func nativeSheetLook(_ preferences: NativePreferences) -> some View {
        modifier(NativeSheetLook(preferences: preferences))
    }
}

/// A modifier of its own rather than a chain on every sheet's type, which
/// keeps the sheets' view types small.
private struct NativeSheetLook: ViewModifier {
    let preferences: NativePreferences

    func body(content: Content) -> some View {
        content
            .tint(Theme.primary.color)
            .preferredColorScheme(
                preferences.theme == "light" ? .light : preferences.theme == "dark" ? .dark : nil)
    }
}

/// Indstillinger (#198): Sprog, Udseende and Notifikationer. Needs a
/// navigation stack around it.
struct SettingsList: View {
    let preferences: NativePreferences
    let onChoose: (_ lang: String, _ theme: String) -> Void
    let onDone: () -> Void
    /// Turns notifications on through the web view: "granted", "denied" or "failed".
    let enablePush: () async -> String
    /// Pushed inside the Profil sheet rather than the first screen of its own.
    var pushed = false

    private let notifications = NotificationsModel.shared

    /// The web's SettingsGroups (#281): Sprog, Udseende and Notifikationer as
    /// its ListGroups, each titled; a choice is a row with the 16 point orange
    /// tick as its value (LanguageGroup, AppearanceGroup), each language by
    /// its own name, whatever the screen is in.
    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                CardList(CasyStrings.settingsLanguage) {
                    choice("Dansk", "languages", preferences.lang == "da") { pick(lang: "da") }
                    choice("English", "languages", preferences.lang == "en") { pick(lang: "en") }
                }
                CardList(CasyStrings.settingsAppearance) {
                    choice(CasyStrings.settingsSystem, "monitor", preferences.theme == "system") {
                        pick(theme: "system")
                    }
                    choice(CasyStrings.settingsLight, "sun", preferences.theme == "light") {
                        pick(theme: "light")
                    }
                    choice(CasyStrings.settingsDark, "moon", preferences.theme == "dark") {
                        pick(theme: "dark")
                    }
                }
                NotificationsSection(model: notifications, enablePush: enablePush)
            }
            // px-4; the first group's mt-6 is its own; pb-4 at the end.
            .padding(.horizontal, 16)
            .padding(.bottom, 16)
        }
        .accessibilityIdentifier("settings.list")
        // New words at once, without leaving the screen: on the stack instead,
        // this id would throw a pushed Indstillinger back to Profil.
        .id(preferences.lang)
        .task { await notifications.readPermission() }
        .task(id: notifications.permission == .granted) {
            if notifications.permission == .granted { await notifications.loadKinds() }
        }
        .modifier(SettingsBar(pushed: pushed, lang: preferences.lang, onDone: onDone))
    }

    /// A choice's row: the tick at its end when it is the one in use.
    private func choice(
        _ label: String, _ icon: String, _ chosen: Bool, action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            CardRow(label, icon: icon) {
                if chosen {
                    LucideIcon("check", size: 16).foregroundStyle(Theme.primary.color)
                }
            }
        }
        .buttonStyle(.cardRow)
        .accessibilityAddTraits(chosen ? .isSelected : [])
    }

    private func pick(lang: String? = nil, theme: String? = nil) {
        if let lang { preferences.lang = lang }
        if let theme { preferences.theme = theme }
        onChoose(preferences.lang, preferences.theme)
    }
}

/// What the Notifikationer section shows. Loaded from the screen's list, as a
/// section with nothing in it yet is an empty view, whose `.task` SwiftUI never
/// runs. One for the whole launch, so reopening the sheet shows what is known
/// at once; forgotten when the person changes (`reset`).
@MainActor @Observable
final class NotificationsModel {
    static let shared = NotificationsModel()

    enum Permission {
        case prompt, granted, denied
    }

    private(set) var permission: Permission?
    /// The kinds switched off; nil until the server has said.
    private(set) var off: [String]?
    private(set) var turningOn = false
    private(set) var failure: String?

    /// Changes still on their way, sent one at a time in the order made.
    private var pending = 0
    private var lastChange: Task<Void, Never>?

    func reset() {
        off = nil
        failure = nil
    }

    func readPermission() async {
        #if DEBUG
            switch TestLaunch.pushPermission {
            case "prompt": permission = .prompt; return
            case "granted": permission = .granted; return
            case "denied": permission = .denied; return
            default: break
            }
        #endif
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        switch settings.authorizationStatus {
        case .notDetermined: permission = .prompt
        case .authorized, .provisional, .ephemeral: permission = .granted
        default: permission = .denied
        }
    }

    func loadKinds() async {
        do {
            guard let api = await Native.api() else { return }
            let answer = try await api.pushSettings(errorMessage: CasyStrings.pushFailed).off
            // A switch moved meanwhile is newer than this answer.
            guard pending == 0 else { return }
            off = answer
            failure = nil
        } catch {
            failure = error.localizedDescription
        }
    }

    /// The switch moves at once; the save follows. A failed save goes back to
    /// what the server says, and says so.
    func change(_ kind: String, on: Bool) {
        var now = off ?? []
        now.removeAll { $0 == kind }
        if !on { now.append(kind) }
        off = now
        failure = nil
        pending += 1
        let previous = lastChange
        lastChange = Task {
            await previous?.value
            defer { pending -= 1 }
            do {
                guard let api = await Native.api() else { return }
                let answer = try await api.setPushKind(
                    kind, on: on, errorMessage: CasyStrings.pushFailed)
                if pending == 1 { off = answer }
            } catch {
                failure = error.localizedDescription
                if pending == 1, let api = await Native.api(),
                    let truth = try? await api.pushSettings().off
                {
                    off = truth
                }
            }
        }
    }

    func turnOn(_ enablePush: @escaping () async -> String) {
        turningOn = true
        Task {
            defer { turningOn = false }
            switch await enablePush() {
            case "granted":
                failure = nil
                permission = .granted
            case "denied":
                failure = nil
                permission = .denied
            default:
                failure = CasyStrings.pushFailed
            }
        }
    }
}

/// "Notifikationer": a switch for each kind, kept on the account. Until iOS has
/// allowed them it is one row that asks; after a no, it says where to undo it.
private struct NotificationsSection: View {
    let model: NotificationsModel
    let enablePush: () async -> String

    private static let kinds = [
        "vote_invited", "vote_decided", "event_changed", "group_invitation", "deadline_near",
    ]

    /// NotificationsGroup: a switch row for each kind (the bell, 15 medium,
    /// iOS's own switch at the end, native on purpose); until iOS has allowed
    /// them one row that asks, after a no one that says where to undo it.
    var body: some View {
        switch model.permission {
        case .granted:
            CardList(CasyStrings.pushTitle) {
                if let off = model.off {
                    ForEach(Self.kinds, id: \.self) { kind in
                        CardRow(CasyStrings.pushKind(kind), icon: "bell") {
                            Toggle(
                                CasyStrings.pushKind(kind),
                                isOn: Binding(
                                    get: { !off.contains(kind) },
                                    set: { on in model.change(kind, on: on) })
                            )
                            .labelsHidden()
                            .tint(Theme.primary.color)
                        }
                        .accessibilityElement(children: .contain)
                    }
                } else if model.failure == nil {
                    CardRow(CasyStrings.loading, icon: "bell") { ProgressView().controlSize(.small) }
                }
                if let failure = model.failure {
                    CardRow(failure, icon: "bell", tone: .danger)
                }
            }
        case .prompt:
            CardList(CasyStrings.pushTitle) {
                Button {
                    model.turnOn(enablePush)
                } label: {
                    CardRow(CasyStrings.pushTurnOn, icon: "bell", detail: model.failure)
                }
                .buttonStyle(.cardRow)
                .disabled(model.turningOn)
            }
        case .denied:
            CardList(CasyStrings.pushTitle) {
                CardRow(
                    CasyStrings.pushDeniedTitle, icon: "bell", detail: CasyStrings.pushDenied,
                    wrap: true)
            }
        case nil:
            EmptyView()
        }
    }
}
