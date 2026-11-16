import CasyAPI
import CasyUI
import SwiftUI
import UserNotifications

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

extension View {
    /// A half-height sheet the same colour as a whole-screen one. iOS 26 gives
    /// a half-height sheet a see-through glass background, and the system's own
    /// colours inside it come out lighter than on a whole-screen sheet, so the
    /// whole-screen sheet's colours are painted here as they are, measured
    /// (#200): under the list, and on its rows.
    func solidHalfSheet(plain: Bool = false) -> some View {
        modifier(SolidHalfSheet(plain: plain))
    }

    /// A row of a half-height sheet's list, as on a whole-screen sheet.
    func halfSheetRow() -> some View {
        modifier(HalfSheetRow())
    }
}

/// The colours a whole-screen sheet has, light and dark.
enum SheetColors {
    /// Under a grouped list: iOS's raised grouped background.
    static func ground(_ scheme: ColorScheme, plain: Bool) -> Color {
        scheme == .dark
            ? Color(red: 28 / 255, green: 28 / 255, blue: 30 / 255)
            : plain ? .white : Color(red: 242 / 255, green: 242 / 255, blue: 247 / 255)
    }

    /// A row of a grouped list.
    static func row(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(red: 44 / 255, green: 44 / 255, blue: 46 / 255) : .white
    }
}

private struct SolidHalfSheet: ViewModifier {
    let plain: Bool
    @Environment(\.colorScheme) private var scheme

    func body(content: Content) -> some View {
        // On the list itself, inside the navigation stack: under the stack,
        // its own glass is drawn over it at half height (measured, #201).
        content
            .scrollContentBackground(.hidden)
            .background(SheetColors.ground(scheme, plain: plain).ignoresSafeArea())
    }
}

private struct HalfSheetRow: ViewModifier {
    @Environment(\.colorScheme) private var scheme

    func body(content: Content) -> some View {
        content.listRowBackground(SheetColors.row(scheme))
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

    var body: some View {
        List {
            Section(CasyStrings.settingsLanguage) {
                // Each language by its own name, whatever the screen is in.
                ListPickRow("Dansk", isSelected: preferences.lang == "da") { pick(lang: "da") }
                ListPickRow("English", isSelected: preferences.lang == "en") {
                    pick(lang: "en")
                }
            }
            Section(CasyStrings.settingsAppearance) {
                ListPickRow(
                    CasyStrings.settingsSystem, isSelected: preferences.theme == "system"
                ) { pick(theme: "system") }
                ListPickRow(
                    CasyStrings.settingsLight, isSelected: preferences.theme == "light"
                ) { pick(theme: "light") }
                ListPickRow(CasyStrings.settingsDark, isSelected: preferences.theme == "dark") {
                    pick(theme: "dark")
                }
            }
            NotificationsSection(model: notifications, enablePush: enablePush)
        }
        // New words at once, without leaving the screen: on the stack instead,
        // this id would throw a pushed Indstillinger back to Profil.
        .id(preferences.lang)
        .task { await notifications.readPermission() }
        .task(id: notifications.permission == .granted) {
            if notifications.permission == .granted { await notifications.loadKinds() }
        }
        .modifier(SettingsBar(pushed: pushed, lang: preferences.lang, onDone: onDone))
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

    var body: some View {
        switch model.permission {
        case .granted:
            Section(CasyStrings.pushTitle) {
                if let off = model.off {
                    ForEach(Self.kinds, id: \.self) { kind in
                        ListSwitchRow(
                            CasyStrings.pushKind(kind),
                            isOn: Binding(
                                get: { !off.contains(kind) },
                                set: { on in model.change(kind, on: on) }),
                            systemImage: "bell"
                        )
                    }
                } else if model.failure == nil {
                    HStack(spacing: 8) {
                        ProgressView().controlSize(.small)
                        Text(CasyStrings.loading)
                            .font(.subheadline)
                            .foregroundStyle(Theme.mutedForeground.color)
                    }
                }
                if let failure = model.failure { Notice(failure, tone: .error, bare: true) }
            }
        case .prompt:
            Section(CasyStrings.pushTitle) {
                Button {
                    model.turnOn(enablePush)
                } label: {
                    ListRow(CasyStrings.pushTurnOn, systemImage: "bell", detail: model.failure)
                }
                .disabled(model.turningOn)
            }
        case .denied:
            Section(CasyStrings.pushTitle) {
                ListRow(
                    CasyStrings.pushDeniedTitle, systemImage: "bell",
                    detail: CasyStrings.pushDenied)
            }
        case nil:
            EmptyView()
        }
    }
}
