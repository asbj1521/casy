import CasyAPI
import CasyCore
import CasyUI
import SwiftUI

/// Forbundne kalendere (#219, #200), the web's CalendarsSection as the app has
/// it: with nothing connected, the one button that imports the phone's
/// calendars; then every account, Synkronisér nu, adding another (this phone,
/// or folded under Andre måder at forbinde an Apple account or a link), and the
/// primary calendar. Google and Outlook aren't offered in the app.
struct ConnectedCalendarsScreen: View {
    /// A provider picked before arriving (`?connect=apple`).
    let connect: String?
    let leave: (LeavingProfile) -> Void

    private let model = CalendarsModel.shared
    @Environment(\.closeSheet) private var closeSheet
    @Environment(\.openURL) private var openURL
    @State private var connectingPhone = false
    @State private var phoneOutcome: PhoneSyncOutcome?
    @State private var syncing = false
    @State private var syncNote: (ok: Bool, text: String)?
    @State private var form: ProviderForm?
    @State private var moreOpen = false
    @State private var linkAdded: LinkAdded?
    @State private var appleAdded: AppleConnected?
    @State private var removing: CalendarConnection?
    @State private var removeFailures: [String: String] = [:]
    @State private var autoAddFailure: String?
    @State private var savingAutoAdd = false
    @State private var arrived = false

    /// The phone first, then as the providers are offered; newest first within one.
    private static let sortOrder = ["device", "apple", "google", "outlook", "ics"]

    private var accounts: [CalendarConnection] {
        let connected = (model.connections ?? []).filter { $0.status == "connected" }
        // A stable sort, as JavaScript's: newest first within a provider.
        return connected.enumerated().sorted { a, b in
            let (i, j) = (Self.sortOrder.firstIndex(of: a.element.provider) ?? -1, Self.sortOrder.firstIndex(of: b.element.provider) ?? -1)
            return i == j ? a.offset < b.offset : i < j
        }.map(\.element)
    }

    private var statusPending: Bool { model.connections == nil }
    private var hasConnected: Bool { !accounts.isEmpty }
    /// Nothing yet: the phone is the one button, not a row among the others.
    private var importFirst: Bool { !statusPending && !hasConnected }

    /// The web's CalendarsSection on a phone (#281): ListGroups as the other
    /// screens draw them, Dine konti, adding a calendar, the primary calendar.
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                phoneNote
                if importFirst {
                    VStack(alignment: .leading, spacing: 12) {
                        Text(CasyStrings.phoneNeedTitle)
                            .font(.system(size: 24, weight: .heavy))
                            .foregroundStyle(Theme.foreground.color)
                        OnlyTimesDemo()
                        Text(CasyStrings.phoneNeedBody)
                            .font(.system(size: 14))
                            .cssLineHeight(20, size: 14)
                            .foregroundStyle(Theme.mutedForeground.color)
                    }
                    .padding(.top, 8)
                }
                if hasConnected { accountsSection }
                addSection
                failures
                if let linkAdded {
                    Notice(CasyStrings.linkAdded(linkAdded.label, blocks: linkAdded.busyBlocks), tone: .success)
                        .padding(.top, 12)
                }
                if let appleAdded {
                    Notice(
                        CasyStrings.appleConnected(
                            appleAdded.label, calendars: appleAdded.calendars, blocks: appleAdded.busyBlocks,
                            skipped: appleAdded.skippedEvents), tone: .success
                    )
                    .padding(.top, 12)
                }
                if hasConnected { primarySection }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 16)
        }
        .accessibilityIdentifier("accounts.screen")
        .casyPushedBar(CasyStrings.accountsTitle, close: CasyStrings.done, action: closeSheet)
        .pageLinks(leave: leave)
        // Kalendere has just fetched the list: only the accounts may have moved on.
        .task { if model.data == nil { await model.load() } else { await model.loadAccounts() } }
        .refreshable { await model.load() }
        .safeAreaInset(edge: .bottom) {
            if importFirst {
                FlowButton(busy: connectingPhone, action: importPhone) {
                    Text(
                        phoneOutcome?.state == "denied"
                            ? CasyStrings.phoneOpenSettings
                            : connectingPhone ? CasyStrings.phoneImporting : CasyStrings.phoneImport)
                }
                .disabled(connectingPhone)
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
            }
        }
        .sheet(item: $form) { which in
            Group {
                switch which {
                case .apple:
                    AppleFormSheet(leave: leave) { added in
                        appleAdded = added
                        form = nil
                    }
                case .link:
                    LinkFormSheet(leave: leave) { added in
                        linkAdded = added
                        form = nil
                    }
                }
            }
            .nativeSheetLook(NativePreferences.shared)
        }
        .askFirst(
            isPresented: Binding(get: { removing != nil }, set: { if !$0 { removing = nil } }), presenting: removing,
            words: {
                AskWords(
                    message: CasyStrings.removeAccountNote(provider: $0.provider, label: $0.account_label),
                    confirm: CasyStrings.removeAccount)
            }
        ) { remove($0) }
        .onAppear {
            guard !arrived else { return }
            arrived = true
            switch model.takeConnect() {
            case "apple": form = .apple
            case "ics": form = .link
            default: break
            }
        }
    }

    // MARK: Connecting the phone

    @ViewBuilder private var phoneNote: some View {
        if let outcome = phoneOutcome {
            switch outcome.state {
            case "denied":
                VStack(alignment: .leading, spacing: 8) {
                    Notice(CasyStrings.phoneDenied, tone: .error)
                    OutlineCapsule(label: CasyStrings.phoneOpenSettings, action: openSettings)
                }
                .padding(.top, 12)
            case "synced":
                Notice(CasyStrings.phoneConnected(calendars: outcome.calendars, blocks: outcome.busyBlocks), tone: .success)
                    .padding(.top, 12)
            case "failed":
                Notice(outcome.error ?? CasyStrings.phoneSaveFailed, tone: .error)
                    .padding(.top, 12)
            default:
                EmptyView()
            }
        }
    }

    private func importPhone() {
        if phoneOutcome?.state == "denied" { return openSettings() }
        connectingPhone = true
        Task {
            defer { connectingPhone = false }
            phoneOutcome = await model.sendPhone(create: true)
        }
    }

    private func openSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
    }

    // MARK: Your accounts

    /// The web's AccountList: Dine konti, each account, then Synkronisér nu
    /// (refresh-cw, orange) as the last row, how it went as the footnote.
    private var accountsSection: some View {
        CardList(
            CasyStrings.accountsYours,
            footnoteText: syncNote.map {
                Text($0.text).foregroundStyle($0.ok ? Theme.emerald700.color : Theme.red700.color)
            }
        ) {
            ForEach(accounts) { account in
                AccountRow(
                    account: account, failure: removeFailures[account.id],
                    reconnect: { form = .apple }, remove: { removing = account })
            }
            Button(action: sync) {
                CardRow(syncing ? CasyStrings.syncing : CasyStrings.syncNow, tone: .primary) {
                    LucideIcon("refresh-cw", size: 20)
                        .foregroundStyle(Theme.primary.color)
                        .rotationEffect(.degrees(syncing ? 360 : 0))
                        .animation(
                            syncing ? .linear(duration: 1).repeatForever(autoreverses: false) : .default,
                            value: syncing)
                }
            }
            .buttonStyle(.cardRow)
            .disabled(syncing)
            .accessibilityIdentifier("accounts.sync")
        }
    }

    private func sync() {
        syncing = true
        syncNote = nil
        Task {
            defer { syncing = false }
            do {
                let outcomes = try await model.syncAll()
                let failed = outcomes.filter { !$0 }.count
                syncNote = (
                    failed == 0,
                    outcomes.isEmpty
                        ? CasyStrings.syncAllFresh
                        : failed == 0
                            ? CasyStrings.syncedAccounts(outcomes.count)
                            : CasyStrings.syncSomeFailed(failed, of: outcomes.count)
                )
            } catch {
                syncNote = (false, error.localizedDescription)
            }
        }
    }

    private func remove(_ account: CalendarConnection) {
        removeFailures[account.id] = nil
        Task {
            do {
                try await model.remove(account)
            } catch {
                removeFailures[account.id] = error.localizedDescription
            }
        }
    }

    // MARK: Adding a calendar

    /// Where one provider stands: its newest attempt (the server lists newest first).
    private func latest(_ provider: String) -> CalendarConnection? {
        (model.connections ?? []).first { $0.provider == provider }
    }

    private func pending(_ provider: String) -> Bool {
        latest(provider)?.status == "pending" || (provider == "device" && connectingPhone)
    }

    private func failed(_ provider: String) -> String? {
        guard let attempt = latest(provider), attempt.status == "error" else { return nil }
        return attempt.error_message ?? CasyStrings.unknownError
    }

    /// The phone, unless it is the one button already or connected; then the other ways.
    private var main: [String] {
        importFirst || accounts.contains(where: { $0.id == model.thisPhone }) ? [] : ["device"]
    }

    private static let more = ["apple", "ics"]

    private var showMore: Bool {
        moreOpen || Self.more.contains { $0 == chosen || pending($0) || failed($0) != nil }
    }

    /// The provider picked before arriving, while nothing is connected.
    private var chosen: String? {
        form?.provider ?? (hasConnected ? nil : connect)
    }

    /// The web's AddCalendar on a phone: Tilføj en kalender (this phone),
    /// Andre måder at forbinde folding the Apple account and the link open
    /// under it (its chevron turning down). The guides are in their forms, the
    /// one place each opens from (#202).
    private var addSection: some View {
        CardList(main.isEmpty ? nil : CasyStrings.accountsAdd) {
            ForEach(main, id: \.self, content: providerRow)
            Button {
                withAnimation(.easeOut(duration: 0.2)) { moreOpen = !showMore }
            } label: {
                CardRow(CasyStrings.accountsMore, detail: CasyStrings.accountsMoreDetail, expanded: showMore) {
                    CardRowIcon("ellipsis")
                }
            }
            .buttonStyle(.cardRow)
            .accessibilityIdentifier("accounts.more")
            .accessibilityAddTraits(showMore ? .isSelected : [])
            if showMore { ForEach(Self.more, id: \.self, content: providerRow) }
        }
        .tint(Theme.foreground.color)
    }

    /// A way to connect: its mark in its 36 point badge, its name and a line
    /// on what it takes, a chevron (a spinner while it waits); picked before
    /// arriving, the web's bg-secondary.
    private func providerRow(_ provider: String) -> some View {
        let waiting = statusPending || pending(provider)
        return Button {
            add(provider)
        } label: {
            CardRow(
                CasyStrings.provider(provider),
                detail: provider == "apple"
                    ? CasyStrings.accountsAppleElsewhere
                    : provider == "ics" ? CasyStrings.accountsLinkHint : CasyStrings.accountsPhoneHint,
                chevron: true
            ) {
                ProviderBadge(provider: provider)
            } trailing: {
                if waiting {
                    LucideIcon("loader-circle", size: 16).foregroundStyle(Theme.mutedForeground.color)
                }
            }
            .background(chosen == provider ? Theme.secondary.color : .clear)
        }
        .buttonStyle(.cardRow)
        .disabled(waiting)
        .accessibilityIdentifier("accounts.add.\(provider)")
    }

    private func add(_ provider: String) {
        linkAdded = nil
        appleAdded = nil
        switch provider {
        case "device": importPhone()
        case "apple": form = .apple
        default: form = .link
        }
    }

    @ViewBuilder private var failures: some View {
        ForEach(main + Self.more, id: \.self) { provider in
            if let failure = failed(provider) {
                Notice("\(CasyStrings.provider(provider)): \(CasyStrings.lastFailed(failure))", tone: .error)
                    .padding(.top, 12)
            }
        }
    }

    // MARK: The primary calendar

    /// The web's PrimaryCalendarCard on a phone: a ListGroup with the
    /// picker's row and Tilføj automatisk (iOS's own switch, native on
    /// purpose), what the primary calendar is for as its footnote.
    private var primarySection: some View {
        let choices = calendarChoices(accounts, primaryId: model.primary?.calendarId)
        let hasApple = accounts.contains { $0.provider == "apple" }
        return VStack(alignment: .leading, spacing: 0) {
            CardList(footnote: CasyStrings.primaryIntro) {
                if choices.isEmpty {
                    CardRow(hasApple ? CasyStrings.primaryWaitingForSync : CasyStrings.primaryNoWritable)
                } else {
                    NavigationLink(value: CalendarsPage.primary) {
                        CardRow(
                            CasyStrings.primaryTitle,
                            value: primaryName(accounts, model.primary?.calendarId) ?? CasyStrings.primaryChoose,
                            chevron: true)
                    }
                    .buttonStyle(.cardRow)
                    .accessibilityIdentifier("accounts.primary")
                    CardRow(
                        CasyStrings.primaryAutoAdd,
                        detail: model.primary == nil
                            ? CasyStrings.primaryAutoAddNeedsPrimary : CasyStrings.primaryAutoAddDetail,
                        wrap: true
                    ) {
                        EmptyView()
                    } trailing: {
                        Toggle(
                            CasyStrings.primaryAutoAdd,
                            isOn: Binding(
                                get: { model.primary?.autoAdd ?? false },
                                set: { on in setAutoAdd(on) })
                        )
                        .labelsHidden()
                        .tint(Theme.primary.color)
                        .disabled(model.primary == nil || savingAutoAdd)
                    }
                    .accessibilityElement(children: .contain)
                }
            }
            if let autoAddFailure {
                Notice(autoAddFailure, tone: .error, bare: true).padding(.top, 8)
            }
        }
    }

    private func setAutoAdd(_ on: Bool) {
        savingAutoAdd = true
        autoAddFailure = nil
        Task {
            defer { savingAutoAdd = false }
            do {
                try await model.setAutoAdd(on)
            } catch {
                autoAddFailure = error.localizedDescription
            }
        }
    }
}

/// The two forms a provider opens.
private enum ProviderForm: String, Identifiable {
    case apple, link
    var id: String { rawValue }
    var provider: String { self == .apple ? "apple" : "ics" }
}

/// One account (the web's AccountRow, drawn like a CardRow with room for a
/// second line that wraps): its mark (36, 12 from the top), its name (15
/// medium), what it holds and when it last synced (13 muted), a warning when
/// it needs one, and its round buttons, signing in again (Apple) and removing.
private struct AccountRow: View {
    let account: CalendarConnection
    let failure: String?
    let reconnect: () -> Void
    let remove: () -> Void
    @Environment(\.cardRowIsFirst) private var isFirst

    var body: some View {
        let needsReconnect = account.needs_reconnect
        let synced = syncedAgo(account.last_synced_at, now: Native.now).map { CasyStrings.syncedShort(minutes: $0.minutes) }
        HStack(alignment: .top, spacing: 12) {
            ProviderBadge(provider: account.provider)
                .padding(.top, 12)
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 0) {
                        Text(account.account_label ?? CasyStrings.unknownAccount)
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(Theme.foreground.color)
                            .cssLineHeight(22.5, size: 15)
                            .lineLimit(1)
                        (Text(
                            [CasyStrings.calendarsCount(account.calendar_sources.count), synced].compactMap { $0 }
                                .joined(separator: " · "))
                            + Text(account.sync_error != nil && !needsReconnect ? " \(CasyStrings.lastSyncFailed)" : "")
                            .foregroundStyle(Theme.amber700.color))
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.mutedForeground.color)
                            .cssLineHeight(19.5, size: 13)
                            .fixedSize(horizontal: false, vertical: true)
                        if needsReconnect {
                            Text(account.provider == "ics" ? CasyStrings.linkStopped : CasyStrings.accessExpired)
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(Theme.amber700.color)
                                .cssLineHeight(16, size: 12)
                                .padding(.top, 2)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    HStack(spacing: 8) {
                        // Only an Apple account signs in again in the app: a link and a
                        // phone have nothing to sign in to, Google and Outlook aren't offered.
                        if account.provider == "apple" {
                            RoundIcon(icon: "refresh-cw", warn: needsReconnect, action: reconnect)
                                .accessibilityLabel(CasyStrings.reconnect)
                        }
                        RoundIcon(icon: "trash", warn: false, action: remove)
                            .accessibilityLabel(CasyStrings.removeAccountTitle)
                            .accessibilityIdentifier("accounts.remove.\(account.id)")
                    }
                }
                if let failure { Notice(failure, tone: .error, bare: true) }
            }
            .padding(.vertical, 12)
            .padding(.trailing, 16)
            .overlay(alignment: .top) {
                if !isFirst { Rectangle().fill(Theme.border.color).frame(height: 1) }
            }
        }
        .padding(.leading, 16)
    }
}

/// An account's 32 point round button (`rounded-full border bg-background`,
/// a 14 point icon, muted; amber while the account needs signing in again).
private struct RoundIcon: View {
    let icon: String
    let warn: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            LucideIcon(icon, size: 14)
                .foregroundStyle(warn ? Theme.amber700.color : Theme.mutedForeground.color)
                .frame(width: 32, height: 32)
                .background(warn ? Theme.amber50.color : Theme.background.color, in: Circle())
                .overlay(Circle().strokeBorder(warn ? Theme.amber200.color : Theme.border.color, lineWidth: 1))
                .contentShape(Circle().inset(by: -6))
        }
        .buttonStyle(.plain)
    }
}

/// A provider's mark in its 36 point round badge, as the web's
/// PROVIDER_BRANDS draws it: 16 points, the brand's own mark and colours.
struct ProviderBadge: View {
    let provider: String

    var body: some View {
        Group {
            switch provider {
            case "device":
                LucideIcon("smartphone", size: 16).foregroundStyle(Theme.emerald700.color)
            case "apple":
                LucideIcon(brand: "apple", size: 16).foregroundStyle(Theme.neutral800.color)
            case "ics":
                LucideIcon("link-2", size: 16).foregroundStyle(Theme.violet700.color)
            case "google":
                LucideIcon(brand: "google", size: 16).foregroundStyle(Color(red: 66 / 255, green: 133 / 255, blue: 244 / 255))
            default:
                LucideIcon(brand: "microsoft", size: 16).foregroundStyle(Color(red: 0, green: 120 / 255, blue: 212 / 255))
            }
        }
        .frame(width: 36, height: 36)
        .background(badge.color, in: Circle())
        .accessibilityHidden(true)
    }

    private var badge: CasyColor {
        switch provider {
        case "device": Theme.emerald100
        case "apple": Theme.neutral200
        case "ics": Theme.violet100
        case "google": Theme.blue100
        default: Theme.sky100
        }
    }
}

// MARK: - The primary calendar's choice

/// One account's calendars that can take an event.
struct CalendarChoices: Identifiable {
    let id: String
    let account: String
    let calendars: [CalendarSource]
}

/// Every calendar Casy may write to, by account (`primaryOptions`); the chosen
/// one always, even if it has since become read-only.
func calendarChoices(_ connections: [CalendarConnection], primaryId: String?) -> [CalendarChoices] {
    connections.filter { $0.status == "connected" }
        .map { c in
            CalendarChoices(
                id: c.id, account: c.account_label ?? c.provider,
                calendars: c.calendar_sources.filter { $0.writable || $0.id == primaryId })
        }
        .filter { !$0.calendars.isEmpty }
}

/// The primary calendar's name, or nil if it isn't among the connections (`primaryName`).
func primaryName(_ connections: [CalendarConnection], _ primaryId: String?) -> String? {
    guard let primaryId else { return nil }
    return connections.lazy.flatMap(\.calendar_sources).first { $0.id == primaryId }?.name
}

/// Primær kalender: where agreed events go. Choosing the first is one tap;
/// changing it, or choosing none, asks first, since events already added
/// stay behind in the old one.
struct PrimaryCalendarScreen: View {
    private let model = CalendarsModel.shared
    @Environment(\.closeSheet) private var closeSheet
    @Environment(\.dismiss) private var dismiss
    @State private var asking: Asking?
    @State private var saving = false
    @State private var failure: String?

    private struct Asking: Identifiable {
        let calendarId: String?
        var id: String { calendarId ?? "" }
    }

    var body: some View {
        let connections = model.connections ?? []
        let primaryId = model.primary?.calendarId
        let current = primaryName(connections, primaryId) ?? ""
        List {
            ForEach(calendarChoices(connections, primaryId: primaryId)) { group in
                Section(group.account) {
                    ForEach(group.calendars) { c in
                        ListPickRow(c.name, isSelected: (asking.map { $0.calendarId } ?? primaryId) == c.id) {
                            choose(c.id)
                        }
                    }
                }
            }
            // Choosing none only means something once one is chosen.
            if primaryId != nil {
                Section {
                    ListPickRow(CasyStrings.primaryNone, isSelected: asking != nil && asking?.calendarId == nil) {
                        choose(nil)
                    }
                }
            }
            if let failure { Notice(failure, tone: .error, bare: true) }
        }
        .casyPushedBar(CasyStrings.primaryTitle, close: CasyStrings.done, action: closeSheet)
        // Until the current choice is known, a tap can't tell a first choice
        // from a change, which asks first.
        .disabled(saving || !model.primaryKnown)
        .overlay { if saving || (!model.primaryKnown && failure == nil) { ProgressView() } }
        .task {
            guard !model.primaryKnown else { return }
            await model.loadAccounts()
            if !model.primaryKnown { failure = model.primaryFailure ?? CasyStrings.addToCalendarLoadPrimaryFailed }
        }
        .askFirst(
            isPresented: Binding(get: { asking != nil }, set: { if !$0 { asking = nil } }), presenting: asking,
            words: { ask in
                // Nothing is lost by another primary calendar: the web's neutral tone.
                AskWords(
                    message: ask.calendarId.map {
                        CasyStrings.primaryConfirmChange(primaryName(connections, $0) ?? $0, from: current)
                    } ?? CasyStrings.primaryConfirmClear(current),
                    confirm: ask.calendarId == nil ? CasyStrings.primaryYesStop : CasyStrings.primaryYesChange,
                    danger: false)
            }
        ) { save($0.calendarId) }
    }

    private func choose(_ calendarId: String?) {
        let primaryId = model.primary?.calendarId
        guard calendarId != primaryId else { return }
        failure = nil
        // A first choice needs no second step; anything that replaces one does.
        if primaryId == nil, let calendarId { save(calendarId) } else { asking = Asking(calendarId: calendarId) }
    }

    private func save(_ calendarId: String?) {
        saving = true
        Task {
            defer { saving = false }
            do {
                try await model.setPrimary(calendarId)
                asking = nil
                dismiss()
            } catch {
                asking = nil
                failure = error.localizedDescription
            }
        }
    }
}

// MARK: - The forms

/// Apple's sign-in (#200): the Apple Account and an app-specific password.
/// Its shape is checked once it is pasted or sent, advice and never a block.
private struct AppleFormSheet: View {
    let leave: (LeavingProfile) -> Void
    let connected: (AppleConnected) -> Void

    private let model = CalendarsModel.shared
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var password = ""
    @State private var checkShape = false
    @State private var submitting = false
    @State private var failure: String?
    @State private var about = false

    private var shapeLooksWrong: Bool {
        checkShape && !password.trimmingCharacters(in: .whitespaces).isEmpty
            && !looksLikeAppSpecificPassword(password)
    }

    private var guide: String { "[\(CasyStrings.appleStepByStep)](/help/connect-icloud)" }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    CasyField(CasyStrings.appleEmail, text: $email, placeholder: "you@icloud.com")
                        .keyboardType(.emailAddress)
                        .textContentType(.username)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .accessibilityIdentifier("apple.email")
                    CasyField(CasyStrings.applePassword, text: $password, placeholder: "xxxx-xxxx-xxxx-xxxx", secure: true)
                        .onChange(of: password) { before, after in
                            // A paste arrives all at once: the moment to check.
                            if after.count - before.count > 1 { checkShape = true }
                        }
                        .accessibilityIdentifier("apple.password")
                    FormFootnote(HelpPages.text(CasyStrings.appleNoPasswordYet(guide), size: 12))
                    if shapeLooksWrong {
                        Notice(CasyStrings.appleLooksWrong(appPasswordExample), tone: .warning)
                    }
                    if let failure {
                        VStack(alignment: .leading, spacing: 4) {
                            Notice(failure, tone: .error, bare: true)
                            FormFootnote(HelpPages.text(CasyStrings.appleStuck(guide), size: 12))
                        }
                    }
                    AboutFold(title: CasyStrings.appleAbout, text: CasyStrings.appleAboutBody, open: $about)
                        .padding(.top, 12)
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 24)
            }
            .background(Theme.background.color)
            .tint(Theme.foreground.color)
            .casySheetBar(CasyStrings.provider("apple"), close: CasyStrings.cancel, disabled: submitting) { dismiss() }
            .pageLinks(leave: leave)
            // Opened from this form, the guide's button is the way back to it.
            .environment(\.appleGuideNext) {}
            .safeAreaInset(edge: .bottom) {
                FlowButton(busy: submitting, action: submit) {
                    Text(submitting ? CasyStrings.appleReading : CasyStrings.connect)
                }
                .disabled(submitting || email.isEmpty || password.isEmpty)
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
            }
        }
        .interactiveDismissDisabled(submitting)
    }

    private func submit() {
        checkShape = true
        submitting = true
        failure = nil
        Task {
            defer { submitting = false }
            do {
                let added = try await model.connectApple(email: email, password: password)
                // The password goes with the form, never kept.
                password = ""
                connected(added)
            } catch {
                failure = error.localizedDescription
            }
        }
    }
}

/// A calendar by its link (a timetable, a shared feed), and a name for it.
private struct LinkFormSheet: View {
    let leave: (LeavingProfile) -> Void
    let added: (LinkAdded) -> Void

    private let model = CalendarsModel.shared
    @Environment(\.dismiss) private var dismiss
    @State private var url = ""
    @State private var name = ""
    @State private var submitting = false
    @State private var failure: String?
    @State private var about = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    CasyField(CasyStrings.linkLabel, text: $url, placeholder: "https://... or webcal://...")
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .accessibilityIdentifier("link.url")
                    FormFootnote(
                        HelpPages.text("\(CasyStrings.linkLikePassword) [\(CasyStrings.linkFindIt)](/help/connect-ics)", size: 12))
                    CasyField(CasyStrings.linkName, text: $name, placeholder: CasyStrings.linkNamePlaceholder)
                        .onChange(of: name) { _, typed in
                            if typed.count > 80 { name = String(typed.prefix(80)) }
                        }
                        .accessibilityIdentifier("link.name")
                    if let failure { Notice(failure, tone: .error, bare: true) }
                    AboutFold(title: CasyStrings.linkAbout, text: CasyStrings.linkAboutBody, open: $about)
                        .padding(.top, 12)
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 24)
            }
            .background(Theme.background.color)
            .tint(Theme.foreground.color)
            .casySheetBar(CasyStrings.provider("ics"), close: CasyStrings.cancel, disabled: submitting) { dismiss() }
            .pageLinks(leave: leave)
            .safeAreaInset(edge: .bottom) {
                FlowButton(busy: submitting, action: submit) {
                    Text(submitting ? CasyStrings.linkReading : CasyStrings.addLink)
                }
                .disabled(submitting || url.trimmingCharacters(in: .whitespaces).isEmpty)
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
            }
        }
        .interactiveDismissDisabled(submitting)
    }

    private func submit() {
        submitting = true
        failure = nil
        Task {
            defer { submitting = false }
            do {
                let result = try await model.addLink(url: url, name: name)
                url = ""
                added(result)
            } catch {
                failure = error.localizedDescription
            }
        }
    }
}

/// A form's footnote: 12 muted, its link underlined in the text's colour.
private struct FormFootnote: View {
    let text: AttributedString
    init(_ text: AttributedString) { self.text = text }

    var body: some View {
        Text(text)
            .font(.system(size: 12))
            .foregroundStyle(Theme.mutedForeground.color)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 4)
    }
}

/// What we do with what's typed here, folded behind a lock.
private struct AboutFold: View {
    let title: String
    let text: String
    @Binding var open: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button {
                withAnimation(.easeOut(duration: 0.2)) { open.toggle() }
            } label: {
                HStack(spacing: 6) {
                    LucideIcon("lock", size: 14)
                    Text(title).font(.system(size: 14, weight: .medium))
                    LucideIcon("chevron-down", size: 14)
                        .rotationEffect(.degrees(open ? 180 : 0))
                }
                .foregroundStyle(Theme.mutedForeground.color)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            if open {
                Text(text)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.mutedForeground.color)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.horizontal, 4)
    }
}

// MARK: - What the import promises, shown (#215)

/// The events on your phone and what we get of them: each lifts off the
/// phone's side with its name, loses it on the way over, and lands on ours as
/// a time and nothing else. Reduced motion shows where it ends.
struct OnlyTimesDemo: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private static let times = ["09:30", "14:00", "18:30"]
    /// Seconds round the loop: three events across, then a moment to read the result.
    private static let loop = 4.5

    var body: some View {
        let titles = CasyStrings.demoTitles
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(CasyStrings.demoPhone).frame(maxWidth: .infinity, alignment: .leading)
                Spacer().frame(width: 16)
                Text(CasyStrings.demoWeSee).frame(maxWidth: .infinity, alignment: .leading)
            }
            .font(.caption.weight(.medium))
            .textCase(.uppercase)
            .foregroundStyle(Theme.mutedForeground.color)
            GeometryReader { box in
                let column = box.size.width * 0.46
                let across = box.size.width * 0.54
                TimelineView(.animation(paused: reduceMotion)) { timeline in
                    let t = reduceMotion
                        ? 0.9 : timeline.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: Self.loop) / Self.loop
                    ZStack(alignment: .topLeading) {
                        ForEach(0..<3, id: \.self) { i in
                            row(Self.times[i], titles[i], fill: Theme.secondary.color)
                                .frame(width: column)
                                .offset(y: CGFloat(i) * 32)
                            landing(Self.times[i], filled: reduceMotion)
                                .frame(width: column)
                                .offset(x: across, y: CGFloat(i) * 32)
                            if !reduceMotion { flying(i, Self.times[i], titles[i], t: t, column: column, across: across) }
                        }
                    }
                }
            }
            .frame(height: 92)
        }
        .accessibilityHidden(true)
    }

    private func row(_ time: String, _ title: String, fill: Color, titleOpacity: Double = 1) -> some View {
        HStack(spacing: 8) {
            Text(time).fontWeight(.semibold)
            Text(title).lineLimit(1).opacity(titleOpacity)
            Spacer(minLength: 0)
        }
        .font(.footnote)
        .foregroundStyle(Theme.foreground.color)
        .padding(.horizontal, 10)
        .frame(height: 28)
        .background(fill, in: RoundedRectangle(cornerRadius: 8))
    }

    private func landing(_ time: String, filled: Bool) -> some View {
        HStack {
            if filled { Text(time).font(.footnote.weight(.semibold)).foregroundStyle(Theme.foreground.color) }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 10)
        .frame(height: 28)
        .background(filled ? Theme.primary.color.opacity(0.15) : .clear, in: RoundedRectangle(cornerRadius: 8))
        .overlay {
            if !filled {
                RoundedRectangle(cornerRadius: 8).strokeBorder(Theme.border.color, style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
            }
        }
    }

    /// One event's way across, on a clock shared with the others.
    private func flying(_ i: Int, _ time: String, _ title: String, t: Double, column: CGFloat, across: CGFloat) -> some View {
        let off = 0.06 + Double(i) * 0.22
        let on = off + 0.16
        let x = Self.keyframes(t, [(0, 0), (off, 0), (on, 1), (0.97, 1), (0.971, 0)])
        let opacity = Self.keyframes(t, [(0, 0), (off - 0.02, 0), (off, 1), (0.92, 1), (0.97, 0)])
        let tint = Self.keyframes(t, [(0, 0), (off + 0.06, 0), (on, 1), (0.97, 1), (1, 0)])
        let name = Self.keyframes(t, [(0, 1), (off + 0.02, 1), (off + 0.1, 0), (0.97, 0), (1, 1)])
        return row(time, title, fill: Theme.secondary.color, titleOpacity: name)
            .overlay(RoundedRectangle(cornerRadius: 8).fill(Theme.primary.color.opacity(0.15 * tint)))
            .shadow(color: .black.opacity(0.08), radius: 2, y: 1)
            .frame(width: column)
            .offset(x: across * x, y: CGFloat(i) * 32)
            .opacity(opacity)
    }

    /// The value at `t` between keyframes, eased in and out on each stretch.
    private static func keyframes(_ t: Double, _ frames: [(Double, Double)]) -> Double {
        guard let last = frames.last else { return 0 }
        if t >= last.0 { return last.1 }
        for (a, b) in zip(frames, frames.dropFirst()) where t < b.0 {
            if t <= a.0 { return a.1 }
            let p = (t - a.0) / (b.0 - a.0)
            let eased = p * p * (3 - 2 * p)
            return a.1 + (b.1 - a.1) * eased
        }
        return last.1
    }
}
