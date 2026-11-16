import CasyAPI
import CasyCore
import CasyUI
import SwiftUI

/// Admin mode's overview, for the project owner only: the server decides who
/// may see it and checks again on every action (the `admin` function).
@MainActor @Observable
final class AdminModel {
    static let shared = AdminModel()

    private(set) var overview: AdminOverview?
    private(set) var loading = false
    private(set) var failure: String?
    /// Read once per load: "synced 5 min ago" needn't tick while the screen is open.
    private(set) var loadedAt = Date()

    /// What the last deletion of an account took with it, until dismissed.
    var notice: String?
    /// How each re-sync from here went, by connection or user id.
    private(set) var syncResults: [String: (ok: Bool, text: String)] = [:]
    private(set) var syncing: Set<String> = []

    func reset() {
        overview = nil
        failure = nil
        notice = nil
        syncResults = [:]
    }

    private func api() async throws -> EdgeFunctions {
        if let api = await Native.api() { return api }
        throw APIError.failed(status: 401, message: CasyStrings.adminLoadFailed)
    }

    /// After an action: the overview patched at once, then fetched again
    /// without making anyone wait; it may change the admin's own groups too.
    private func changed(_ patch: (inout AdminOverview) -> Void) {
        if var now = overview {
            patch(&now)
            overview = now
        }
        ProfileModel.shared.onChange?()
        Task { await load() }
    }

    func deleteGroup(_ groupId: String) async throws {
        try await api().adminDeleteGroup(groupId, errorMessage: CasyStrings.adminDeleteGroupFailed)
        changed { $0.groups.removeAll { $0.id == groupId } }
    }

    func removeMember(_ profileId: String, from groupId: String) async throws {
        try await api().adminRemoveMember(profileId, from: groupId, errorMessage: CasyStrings.adminRemoveMemberFailed)
        changed { o in
            guard let i = o.groups.firstIndex(where: { $0.id == groupId }) else { return }
            o.groups[i].members.removeAll { $0.profileId == profileId }
            if o.groups[i].members.isEmpty { o.groups.remove(at: i) }
        }
    }

    func deleteUser(_ user: AdminOverview.User) async throws {
        let answer = try await api().adminDeleteUser(user.id, errorMessage: CasyStrings.adminDeleteAccountFailed)
        notice = CasyStrings.adminUserDeleted(user.name, groups: answer.deletedGroups)
        changed { o in
            o.users.removeAll { $0.id == user.id }
            o.connections.removeAll { $0.ownerId == user.id }
            for i in o.groups.indices { o.groups[i].members.removeAll { $0.profileId == user.id } }
            o.groups.removeAll { $0.members.isEmpty }
        }
    }

    func setTester(_ user: AdminOverview.User, _ on: Bool) async throws {
        let now = try await api().adminSetAiTester(user.id, allowed: on, errorMessage: CasyStrings.adminAiAccessFailed)
        changed { o in
            if let i = o.users.firstIndex(where: { $0.id == user.id }) { o.users[i].tester = now }
        }
    }

    /// Each sync spins and reports on its own row; several may run at once.
    func syncUser(_ userId: String) async {
        syncing.insert(userId)
        defer { syncing.remove(userId) }
        do {
            let r = try await api().adminSyncUser(userId, errorMessage: CasyStrings.adminSyncRequestFailed)
            syncResults[userId] = (
                r.failed == 0, CasyStrings.adminSyncedUser(ok: r.synced, failed: r.failed, blocks: r.busyBlocks)
            )
            Task { await load() }
        } catch {
            syncResults[userId] = (false, error.localizedDescription)
        }
    }

    func syncConnection(_ connectionId: String) async {
        syncing.insert(connectionId)
        defer { syncing.remove(connectionId) }
        do {
            let r = try await api().adminSyncConnection(connectionId, errorMessage: CasyStrings.adminSyncRequestFailed)
            syncResults[connectionId] =
                r.ok
                ? (true, CasyStrings.adminSyncedBlocks(r.busyBlocks ?? 0))
                : (false, r.message ?? CasyStrings.adminSyncFailed)
            Task { await load() }
        } catch {
            syncResults[connectionId] = (false, error.localizedDescription)
        }
    }

    func load() async {
        guard let api = await Native.api() else { return }
        loading = true
        defer { loading = false }
        do {
            overview = try await api.adminOverview(errorMessage: CasyStrings.adminLoadFailed)
            loadedAt = Date()
            failure = nil
        } catch {
            failure = error.localizedDescription
        }
    }
}

/// Admin (#198), pushed inside the Profil sheet, as the web's AdminPanel on a
/// phone: health, the numbers and the AI's use, then groups, users and
/// calendar health, each searchable, the last two filterable to problems.
struct AdminScreen: View {
    private enum Tab: Hashable { case groups, users, calendars }

    /// For the push test: turns notifications on through the web view.
    let enablePush: () async -> String

    private let model = AdminModel.shared
    @Environment(\.closeSheet) private var closeSheet
    @State private var tab = Tab.groups
    @State private var query = ""
    @State private var problemsOnly = false

    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    var body: some View {
        List {
            Section {
                Button {
                    Task { await model.load() }
                } label: {
                    HStack {
                        ListRow(CasyStrings.adminRefresh, systemImage: "arrow.clockwise", tone: .primary)
                        if model.loading { ProgressView().controlSize(.small) }
                    }
                    .contentShape(Rectangle())
                }
                .disabled(model.loading)
            } footer: {
                Text(CasyStrings.adminIntro)
            }
            if let failure = model.failure { Notice(failure, tone: .error, bare: true) }
            if let overview = model.overview {
                Section {
                    // The same answer the uptime monitor gets from the health function (#88).
                    Notice(health(overview.health), tone: overview.health.ok ? .success : .error, bare: true)
                    if let notice = model.notice {
                        HStack(alignment: .top) {
                            Notice(notice, tone: .success, bare: true)
                            Button {
                                model.notice = nil
                            } label: {
                                Image(systemName: "xmark").foregroundStyle(Theme.mutedForeground.color)
                            }
                            .buttonStyle(.borderless)
                            .accessibilityLabel(CasyStrings.close)
                        }
                    }
                }
                AdminReviewRows(enablePush: enablePush)
                stats(overview)
                lists(overview)
            } else if model.failure == nil {
                HStack(spacing: 8) {
                    ProgressView().controlSize(.small)
                    Text(CasyStrings.adminLoading)
                        .font(.subheadline)
                        .foregroundStyle(Theme.mutedForeground.color)
                }
            }
        }
        .casyPushedBar(CasyStrings.adminTitle, close: CasyStrings.done, action: closeSheet)
        .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .automatic), prompt: CasyStrings.adminSearch)
        .task { await model.load() }
        .refreshable {
            async let overview: Void = model.load()
            async let reviews: Void = AdminReviewsModel.shared.load()
            _ = await (overview, reviews)
        }
    }

    private func health(_ health: AdminOverview.Health) -> String {
        if health.ok { return CasyStrings.adminHealthOk }
        return health.reason == "stale" ? CasyStrings.adminHealthStale : CasyStrings.adminHealthFailing
    }

    // MARK: The numbers

    @ViewBuilder private func stats(_ overview: AdminOverview) -> some View {
        let s = overview.stats
        Section {
            fact(CasyStrings.adminStatUsers, s.users)
            fact(CasyStrings.adminStatGroups, s.groups)
            fact(CasyStrings.adminStatAccounts, s.connectedAccounts)
            fact(CasyStrings.adminStatFailing, s.failingSyncs, alert: s.failingSyncs > 0)
            fact(CasyStrings.adminStatBusy, s.busyBlocks)
        } footer: {
            if let ai = overview.ai {
                // Each skill's calls and estimated cost (#111): counts only, never who.
                VStack(alignment: .leading, spacing: 4) {
                    Text(CasyStrings.adminAiToday(ai.today, of: ai.limit))
                    ForEach(ai.skills ?? [], id: \.skill) { s in
                        Text(
                            CasyStrings.adminAiSkill(
                                CasyStrings.named("admin.aiSkills", s.skill), today: s.today,
                                month: s.last30Days, cost: dollars(s.cost30Days)))
                    }
                }
            }
        }
    }

    private func fact(_ label: String, _ value: Int, alert: Bool = false) -> some View {
        HStack {
            Text(label).font(.subheadline.weight(.medium))
            Spacer()
            Text(value.formatted(.number.locale(Locale(identifier: lang == .da ? "da_DK" : "en_GB"))))
                .font(.subheadline.monospacedDigit().weight(.semibold))
                .foregroundStyle(alert ? Theme.red600.color : Theme.foreground.color)
        }
        .accessibilityElement(children: .combine)
    }

    /// "0,03 US$", or "< 0,01 US$" for less: an estimate, so two decimals is plenty.
    private func dollars(_ amount: Double) -> String {
        let format = FloatingPointFormatStyle<Double>.Currency(code: "USD")
            .locale(Locale(identifier: lang == .da ? "da_DK" : "en_GB"))
        return amount > 0 && amount < 0.01 ? "< \(0.01.formatted(format))" : amount.formatted(format)
    }

    // MARK: The lists

    @ViewBuilder private func lists(_ overview: AdminOverview) -> some View {
        Section {
            // No counts beside the names: the numbers above have them, and
            // "Kalendersundhed" with one would not fit a phone.
            Picker(selection: $tab) {
                Text(CasyStrings.adminTabGroups).tag(Tab.groups)
                Text(CasyStrings.adminTabUsers).tag(Tab.users)
                Text(CasyStrings.adminTabCalendars).tag(Tab.calendars)
            } label: {
                EmptyView()
            }
            .pickerStyle(.segmented)
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets())
            .onChange(of: tab) { _, _ in problemsOnly = false }
            if tab != .groups {
                ListSwitchRow(
                    tab == .users ? CasyStrings.adminOnlyNoCalendar : CasyStrings.adminOnlyProblems,
                    isOn: $problemsOnly)
            }
        }
        switch tab {
        case .groups: groups(overview)
        case .users: users(overview)
        case .calendars: connections(overview)
        }
    }

    private func matches(_ fields: String?...) -> Bool {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        return q.isEmpty || fields.contains { $0?.lowercased().contains(q) == true }
    }

    @ViewBuilder private func groups(_ overview: AdminOverview) -> some View {
        let shown = overview.groups.filter { g in
            g.members.contains { matches($0.name) } || matches(g.name, g.createdByName)
        }
        Section {
            if shown.isEmpty {
                Text(query.isEmpty ? CasyStrings.adminNoGroups : CasyStrings.adminNoGroupMatch)
                    .font(.subheadline)
                    .foregroundStyle(Theme.mutedForeground.color)
            }
            ForEach(shown) { g in
                NavigationLink {
                    AdminGroupScreen(groupId: g.id)
                } label: {
                    ListRow(
                        g.name,
                        detail: [
                            CasyStrings.adminGroupMeta(
                                CasyStrings.members(g.members.count), formatDate(g.createdAt, lang),
                                by: g.createdByName),
                            g.members.map(\.name).joined(separator: ", "),
                        ].joined(separator: "\n"))
                }
            }
        }
    }

    @ViewBuilder private func users(_ overview: AdminOverview) -> some View {
        let shown = overview.users.filter { matches($0.name) && (!problemsOnly || $0.calendars == 0) }
        Section {
            if overview.usersTruncated {
                Text(CasyStrings.adminFirstOnly("\(overview.users.count)"))
                    .font(.footnote)
                    .foregroundStyle(Theme.amber700.color)
            }
            if shown.isEmpty {
                Text(CasyStrings.adminNoUserMatch)
                    .font(.subheadline)
                    .foregroundStyle(Theme.mutedForeground.color)
            }
            ForEach(shown) { u in
                NavigationLink {
                    AdminUserScreen(userId: u.id)
                } label: {
                    userRow(u)
                }
            }
        }
    }

    private func userRow(_ u: AdminOverview.User) -> some View {
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 6) {
                            Text(u.name).font(.subheadline.weight(.medium))
                            if u.id == ProfileModel.shared.userId { tag(CasyStrings.adminYou) }
                            if u.ai == "admin" {
                                tag(CasyStrings.adminAiAdmin)
                            } else if u.tester == true {
                                tag(CasyStrings.adminTesterOn)
                            }
                        }
                        Text(
                            CasyStrings.adminJoined(formatDate(u.createdAt, lang))
                                + (u.lastSignInAt.map { CasyStrings.adminLastSignIn(formatDate($0, lang)) } ?? "")
                        )
                        .font(.footnote)
                        .foregroundStyle(Theme.mutedForeground.color)
                    }
                    Spacer(minLength: 8)
                    // Groups and calendars, as the web's phone row: the icon and the number.
                    HStack(spacing: 10) {
                        Label("\(u.groups)", systemImage: "person.2")
                            .accessibilityLabel("\(u.groups) \(CasyStrings.adminGroupsLabel)")
                        Label("\(u.calendars)", systemImage: "calendar")
                            .foregroundStyle(u.calendars == 0 ? Theme.amber700.color : Theme.foreground.color)
                            .accessibilityLabel("\(u.calendars) \(CasyStrings.adminCalendarsLabel)")
                    }
                    .font(.subheadline.monospacedDigit().weight(.semibold))
                    .labelStyle(.titleAndIcon)
                }
    }

    @ViewBuilder private func connections(_ overview: AdminOverview) -> some View {
        let shown = overview.connections.filter { c in
            matches(c.ownerName, CasyStrings.named("admin.providers", c.provider))
                && (!problemsOnly || c.status != "connected" || c.needsReconnect || c.syncError != nil)
        }
        Section {
            if shown.isEmpty {
                Text(problemsOnly ? CasyStrings.adminNoProblems : CasyStrings.adminNoAccountMatch)
                    .font(.subheadline)
                    .foregroundStyle(Theme.mutedForeground.color)
            }
            ForEach(shown) { c in
                let broken = c.status == "connected" && (c.needsReconnect || c.syncError != nil)
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    Image(
                        systemName: c.status != "connected"
                            ? "xmark.circle" : broken ? "exclamationmark.triangle" : "checkmark.circle"
                    )
                    .foregroundStyle(
                        c.status != "connected"
                            ? Theme.mutedForeground.color
                            : broken ? Theme.amber700.color : Theme.emerald700.color)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(c.ownerName) · \(CasyStrings.named("admin.providers", c.provider))")
                            .font(.subheadline.weight(.medium))
                        Text(connectionLine(c))
                            .font(.footnote)
                            .foregroundStyle(Theme.mutedForeground.color)
                        if c.needsReconnect {
                            Text(CasyStrings.adminNeedsReconnect).font(.footnote.weight(.medium))
                                .foregroundStyle(Theme.amber700.color)
                        } else if let error = c.syncError {
                            Text(error).font(.footnote).foregroundStyle(Theme.amber700.color)
                        }
                        if let result = model.syncResults[c.id] {
                            Text(result.text).font(.footnote.weight(.medium))
                                .foregroundStyle(result.ok ? Theme.emerald700.color : Theme.red600.color)
                        }
                    }
                    Spacer(minLength: 8)
                    if c.status == "connected" {
                        if model.syncing.contains(c.id) {
                            ProgressView().controlSize(.small)
                        } else {
                            Button {
                                Task { await model.syncConnection(c.id) }
                            } label: {
                                Image(systemName: "arrow.clockwise")
                                    .foregroundStyle(Theme.primary.color)
                                    .frame(minWidth: 44, minHeight: 44)
                            }
                            .buttonStyle(.borderless)
                            .accessibilityLabel(CasyStrings.adminSyncTitle)
                        }
                    }
                }
            }
        }
    }

    private func connectionLine(_ c: AdminOverview.Connection) -> String {
        switch c.status {
        case "connected":
            let synced = c.lastSyncedAt.flatMap(parseInstant).map { ms in
                let now = Int64(model.loadedAt.timeIntervalSince1970 * 1000)
                return CasyStrings.syncedAgo(minutes: Int(max(0, (now - ms) / 60_000)))
            }
            return "\(CasyStrings.calendarsCount(c.calendars)) · \(synced ?? CasyStrings.adminNeverSynced)"
        case "pending": return CasyStrings.adminConnectingNeverFinished
        default: return CasyStrings.adminConnectingFailed
        }
    }

    private func tag(_ text: String) -> some View {
        Text(text)
            .font(.caption2.weight(.medium))
            .foregroundStyle(Theme.primary.color)
            .padding(.horizontal, 6)
            .padding(.vertical, 1)
            .background(Capsule().fill(Theme.primary.color.opacity(0.12)))
    }
}

/// One group in admin mode: its members, each swiped left to remove, and
/// deleting it for everyone last, asked first (design rules 8 and 11).
struct AdminGroupScreen: View {
    let groupId: String

    private let model = AdminModel.shared
    @Environment(\.closeSheet) private var closeSheet
    @Environment(\.dismiss) private var dismiss
    @State private var removing: AdminOverview.Member?
    @State private var deleting = false
    @State private var working = false
    @State private var failure: String?

    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    var body: some View {
        if let g = model.overview?.groups.first(where: { $0.id == groupId }) {
            List {
                Section {
                    ForEach(Array(g.members.enumerated()), id: \.element.id) { i, m in
                        ListAvatarRow(m.name, detail: formatDate(m.joinedAt, lang), index: i)
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button(CasyStrings.adminRemove) { removing = m }
                                    .tint(Theme.red600.color)
                            }
                    }
                } footer: {
                    Text(
                        CasyStrings.adminGroupMeta(
                            CasyStrings.members(g.members.count), formatDate(g.createdAt, lang), by: g.createdByName))
                }
                Section {
                    Button {
                        deleting = true
                    } label: {
                        ListRow(CasyStrings.adminDeleteGroupTitle, systemImage: "trash", tone: .danger)
                            .contentShape(Rectangle())
                    }
                    if let failure { Notice(failure, tone: .error, bare: true) }
                }
            }
            .disabled(working)
            .casyPushedBar(g.name, close: CasyStrings.done, action: closeSheet)
            .casyConfirm(
                removing.map { CasyStrings.adminRemoveMember($0.name, from: g.name, last: g.members.count <= 1) } ?? "",
                isPresented: Binding(get: { removing != nil }, set: { if !$0 { removing = nil } }), presenting: removing
            ) { m in
                Button(
                    g.members.count <= 1 ? CasyStrings.adminRemoveAndDelete : CasyStrings.adminRemove,
                    role: .destructive
                ) {
                    run { try await model.removeMember(m.profileId, from: g.id) }
                }
                Button(CasyStrings.cancel, role: .cancel) {}
            }
            .casyConfirm(
                CasyStrings.adminDeleteGroupConfirm(g.name, members: g.members.count),
                isPresented: $deleting
            ) {
                Button(CasyStrings.adminDeleteGroup, role: .destructive) {
                    run { try await model.deleteGroup(g.id) }
                }
                Button(CasyStrings.cancel, role: .cancel) {}
            }
        } else {
            // Deleted, here or since: back to the list.
            Color.clear.task { dismiss() }
        }
    }

    private func run(_ action: @escaping () async throws -> Void) {
        working = true
        failure = nil
        Task {
            defer { working = false }
            do { try await action() } catch { failure = error.localizedDescription }
        }
    }
}

/// One account in admin mode: when it came and was last seen, its groups and
/// calendars, the AI tester switch, a re-sync of every calendar, and deleting
/// it last, behind typing the name (the guard against deleting the wrong one).
struct AdminUserScreen: View {
    let userId: String

    private let model = AdminModel.shared
    @Environment(\.closeSheet) private var closeSheet
    @Environment(\.dismiss) private var dismiss
    @State private var typed = ""
    @State private var working = false
    @State private var failure: String?

    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    var body: some View {
        if let overview = model.overview, let u = overview.users.first(where: { $0.id == userId }) {
            let isYou = u.id == ProfileModel.shared.userId
            List {
                Section {
                    fact(CasyStrings.adminJoined(formatDate(u.createdAt, lang)), nil)
                    if let last = u.lastSignInAt {
                        fact(CasyStrings.adminLastSignIn(formatDate(last, lang)).trimmingCharacters(in: CharacterSet(charactersIn: " ·")), nil)
                    }
                    fact(CasyStrings.adminGroupsLabel.capitalizedFirst, "\(u.groups)")
                    fact(CasyStrings.adminCalendarsLabel.capitalizedFirst, "\(u.calendars)", alert: u.calendars == 0)
                }
                Section {
                    // Admins always have it; anyone else is switched here (#111).
                    if u.ai == "admin" {
                        fact(CasyStrings.adminAiAdmin, nil)
                    } else if let tester = u.tester {
                        ListSwitchRow(
                            CasyStrings.adminTesterOn,
                            isOn: Binding(get: { tester }, set: { on in run { try await model.setTester(u, on) } }),
                            detail: tester ? CasyStrings.adminTesterTurnOff(u.name) : CasyStrings.adminTesterTurnOn(u.name))
                    }
                    Button {
                        Task { await model.syncUser(u.id) }
                    } label: {
                        HStack {
                            ListRow(CasyStrings.adminSyncUserTitle(u.name), systemImage: "arrow.clockwise", tone: .primary)
                            if model.syncing.contains(u.id) { ProgressView().controlSize(.small) }
                        }
                        .contentShape(Rectangle())
                    }
                    .disabled(u.calendars == 0 || model.syncing.contains(u.id))
                    if let result = model.syncResults[u.id] {
                        Notice(result.text, tone: result.ok ? .success : .warning, bare: true)
                    }
                }
                if !isYou { deleteSection(u, overview) }
                if let failure { Notice(failure, tone: .error, bare: true) }
            }
            .disabled(working)
            .casyPushedBar(u.name, close: CasyStrings.done, action: closeSheet)
        } else {
            Color.clear.task { dismiss() }
        }
    }

    /// What goes with the account, spelled out, then the name typed before the red row works.
    @ViewBuilder private func deleteSection(_ u: AdminOverview.User, _ overview: AdminOverview) -> some View {
        let theirs = overview.groups.filter { $0.members.contains { $0.profileId == u.id } }
        let matches = typed.trimmingCharacters(in: .whitespaces).lowercased()
            == u.name.trimmingCharacters(in: .whitespaces).lowercased()
        Section {
            TextField(u.name, text: $typed)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .accessibilityLabel(CasyStrings.adminTypeToConfirm(u.name))
            Button {
                // The user leaves the overview, and the screen goes back by
                // itself (body's else): a second dismiss here would also pop Admin.
                run { try await model.deleteUser(u) }
            } label: {
                ListRow(CasyStrings.adminDeleteAccount, systemImage: "trash", tone: .danger)
                    .contentShape(Rectangle())
            }
            .disabled(!matches)
        } header: {
            Text(CasyStrings.adminTypeToConfirm(u.name))
        } footer: {
            Text(
                CasyStrings.adminDeleteUserConfirm(
                    u.name,
                    accounts: overview.connections.filter { $0.ownerId == u.id }.count,
                    groups: theirs.count, soleGroups: theirs.filter { $0.members.count == 1 }.count))
        }
    }

    private func fact(_ label: String, _ value: String?, alert: Bool = false) -> some View {
        HStack {
            Text(label).font(.subheadline)
            Spacer()
            if let value {
                Text(value)
                    .font(.subheadline.monospacedDigit().weight(.semibold))
                    .foregroundStyle(alert ? Theme.amber700.color : Theme.foreground.color)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private func run(_ action: @escaping () async throws -> Void) {
        working = true
        failure = nil
        Task {
            defer { working = false }
            do { try await action() } catch { failure = error.localizedDescription }
        }
    }
}

extension String {
    /// "grupper" as a row's label: "Grupper".
    fileprivate var capitalizedFirst: String { prefix(1).uppercased() + dropFirst() }
}
