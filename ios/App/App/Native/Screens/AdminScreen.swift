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

/// What waits for a yes in admin mode, in the "Er du sikker?" sheet.
enum AdminAsk: Identifiable {
    case deleteGroup(AdminOverview.Group)
    case removeMember(AdminOverview.Group, AdminOverview.Member)
    case deleteUser(AdminOverview.User)
    case deleteReportGroup(AdminReport)

    var id: String {
        switch self {
        case .deleteGroup(let g): "group-\(g.id)"
        case .removeMember(let g, let m): "member-\(g.id)-\(m.profileId)"
        case .deleteUser(let u): "user-\(u.id)"
        case .deleteReportGroup(let r): "report-\(r.id)"
        }
    }
}

/// Admin (#198), pushed inside the Profil sheet, drawn as the web's
/// AdminPanel on a phone (#281): the heading and Opdater, health, the push
/// test, the numbers and the AI's use, then one card with the tabs for
/// groups, users and calendar health (searchable, the last two filterable
/// to problems), each row with its own small buttons; then the reports and
/// the AI's corrections, folded away until opened. Every "yes?" is the
/// small "Er du sikker?" sheet, as the web's ConfirmPanel on a phone.
struct AdminScreen: View {
    private enum Tab: Hashable { case groups, users, calendars }

    /// For the push test: turns notifications on through the web view.
    let enablePush: () async -> String

    private let model = AdminModel.shared
    private let reviews = AdminReviewsModel.shared
    @Environment(\.closeSheet) private var closeSheet
    @State private var tab = Tab.groups
    @State private var query = ""
    @State private var problemsOnly = false
    @State private var asking: AdminAsk?
    @State private var removingMember: String?
    @State private var testerSaving: Set<String> = []
    @State private var testerFailure: [String: String] = [:]

    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header
                if let overview = model.overview {
                    // The same answer the uptime monitor gets from the health function (#88).
                    Notice(health(overview.health), tone: overview.health.ok ? .success : .error)
                        .padding(.top, 16)
                }
                AdminPushTest(enablePush: enablePush).padding(.top, 16)
                stats.padding(.top, 16)
                if let ai = model.overview?.ai { aiUse(ai).padding(.top, 8) }
                if let failure = model.failure {
                    Notice(failure, tone: .error).padding(.top, 16)
                }
                if let notice = model.notice { deletedNotice(notice).padding(.top, 16) }
                listsCard.padding(.top, 24)
                AdminReviewCards(asking: $asking)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.top, 32)
            .padding(.bottom, 16)
        }
        .accessibilityIdentifier("admin.screen")
        .casyPushedBar(CasyStrings.profileAdmin, close: CasyStrings.done, action: closeSheet)
        .task { await model.load() }
        .refreshable {
            async let overview: Void = model.load()
            async let reviews: Void = AdminReviewsModel.shared.load()
            _ = await (overview, reviews)
        }
        .askFirst(item: $asking) { confirm($0) }
    }

    // MARK: The top

    /// The shield and "Admin" (18 semibold), what it is (14 muted), and Opdater under them.
    private var header: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                LucideIcon("shield-check", size: 20).foregroundStyle(Theme.primary.color)
                Text(CasyStrings.adminTitle)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(Theme.foreground.color)
                    .cssLineHeight(28, size: 18)
                    .accessibilityAddTraits(.isHeader)
            }
            Text(CasyStrings.adminIntro)
                .font(.system(size: 14))
                .foregroundStyle(Theme.mutedForeground.color)
                .cssLineHeight(20, size: 14)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 2)
            OutlineCapsule(label: CasyStrings.adminRefresh, icon: "refresh-cw", spinning: model.loading) {
                Task { await model.load() }
            }
            .disabled(model.loading)
            .opacity(model.loading ? 0.6 : 1)
            .padding(.top, 12)
        }
    }

    private func health(_ health: AdminOverview.Health) -> String {
        if health.ok { return CasyStrings.adminHealthOk }
        return health.reason == "stale" ? CasyStrings.adminHealthStale : CasyStrings.adminHealthFailing
    }

    /// What deleting an account took with it, until its cross is pressed.
    private func deletedNotice(_ text: String) -> some View {
        ZStack(alignment: .topTrailing) {
            Notice(text, tone: .success)
            Button {
                model.notice = nil
            } label: {
                LucideIcon("x", size: 16)
                    .foregroundStyle(Theme.emerald900.color.opacity(0.7))
                    .padding(12)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(CasyStrings.close)
        }
    }

    // MARK: The numbers

    /// Two tiles a row, the last across both, as the web's grid on a phone;
    /// "..." until the overview has come, never a false 0.
    private var stats: some View {
        let s = model.overview?.stats
        return VStack(spacing: 12) {
            HStack(spacing: 12) {
                StatTileView(label: CasyStrings.adminStatUsers, value: s?.users)
                StatTileView(label: CasyStrings.adminStatGroups, value: s?.groups)
            }
            HStack(spacing: 12) {
                StatTileView(label: CasyStrings.adminStatAccounts, value: s?.connectedAccounts)
                StatTileView(
                    label: CasyStrings.adminStatFailing, value: s?.failingSyncs, alert: (s?.failingSyncs ?? 0) > 0)
            }
            StatTileView(label: CasyStrings.adminStatBusy, value: s?.busyBlocks)
        }
    }

    /// The AI's calls today (14 muted), then each skill's (12): counts only, never who (#111).
    private func aiUse(_ ai: AdminOverview.AI) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(CasyStrings.adminAiToday(ai.today, of: ai.limit))
                .font(.system(size: 14))
                .cssLineHeight(20, size: 14)
            if let skills = ai.skills, !skills.isEmpty {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(skills, id: \.skill) { s in
                        Text(
                            CasyStrings.adminAiSkill(
                                CasyStrings.named("admin.aiSkills", s.skill), today: s.today,
                                month: s.last30Days, cost: dollars(s.cost30Days)))
                            .font(.system(size: 12))
                            .cssLineHeight(16, size: 12)
                    }
                }
                .padding(.top, 4)
            }
        }
        .foregroundStyle(Theme.mutedForeground.color)
        .fixedSize(horizontal: false, vertical: true)
    }

    /// "0,03 US$", or "< 0,01 US$" for less: an estimate, so two decimals is plenty.
    private func dollars(_ amount: Double) -> String {
        let format = FloatingPointFormatStyle<Double>.Currency(code: "USD")
            .locale(Locale(identifier: lang == .da ? "da_DK" : "en_GB"))
        return amount > 0 && amount < 0.01 ? "< \(0.01.formatted(format))" : amount.formatted(format)
    }

    // MARK: The lists

    /// The card: the tabs (each with its count), the filter and the search,
    /// then the tab's rows under a line.
    private var listsCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            tabs
            VStack(alignment: .leading, spacing: 12) {
                if tab != .groups {
                    CheckboxRow(
                        label: tab == .users ? CasyStrings.adminOnlyNoCalendar : CasyStrings.adminOnlyProblems,
                        isOn: $problemsOnly)
                }
                searchField
            }
            .padding(.top, 12)
            if let overview = model.overview {
                switch tab {
                case .groups: groups(overview)
                case .users: users(overview)
                case .calendars: connections(overview)
                }
            } else if model.failure == nil {
                HStack(spacing: 8) {
                    ProgressView().controlSize(.small)
                    Text(CasyStrings.adminLoading)
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.mutedForeground.color)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 16)
                .hairlineAbove()
                .padding(.top, 16)
            }
        }
        .padding(12)
        .adminCard()
    }

    /// Three tabs in a grey capsule, the chosen one white with a soft shadow,
    /// each its name (13 medium) and count (12 muted).
    private var tabs: some View {
        let o = model.overview
        let items: [(Tab, String, Int?)] = [
            (.groups, CasyStrings.adminTabGroups, o?.groups.count),
            (.users, CasyStrings.adminTabUsers, o?.users.count),
            (.calendars, CasyStrings.adminTabCalendars, o?.connections.count),
        ]
        return FlexAutoRow {
            ForEach(items, id: \.0) { id, label, count in
                let chosen = tab == id
                Button {
                    tab = id
                    problemsOnly = false
                } label: {
                    HStack(spacing: 6) {
                        Text(label)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(chosen ? Theme.foreground.color : Theme.mutedForeground.color)
                            .lineLimit(1)
                            .fixedSize()
                        if let count {
                            Text(verbatim: "\(count)")
                                .font(.system(size: 12).monospacedDigit())
                                .foregroundStyle(Theme.mutedForeground.color)
                        }
                    }
                    .padding(.horizontal, 6)
                    .padding(.vertical, 6)
                    .frame(maxWidth: .infinity)
                    .background {
                        if chosen {
                            Capsule().fill(Theme.card.color)
                                .shadow(color: .black.opacity(0.05), radius: 1, y: 1)
                        }
                    }
                    .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(chosen ? .isSelected : [])
            }
        }
        .padding(4)
        .background(Theme.secondary.color, in: Capsule())
    }

    /// The web's search box: a capsule on the page's background, the
    /// magnifier 12 in, the words at 36.
    private var searchField: some View {
        HStack(spacing: 8) {
            LucideIcon("search", size: 16).foregroundStyle(Theme.mutedForeground.color)
            TextField(CasyStrings.adminSearch, text: $query)
                .font(.system(size: 14))
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .submitLabel(.search)
        }
        .padding(.leading, 12)
        .padding(.trailing, 12)
        .padding(.vertical, 6)
        .background(Theme.background.color, in: Capsule())
        .overlay(Capsule().strokeBorder(Theme.border.color, lineWidth: 1))
    }

    private func matches(_ fields: String?...) -> Bool {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        return q.isEmpty || fields.contains { $0?.lowercased().contains(q) == true }
    }

    /// Nothing to list: 14 muted under the line.
    private func empty(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 14))
            .foregroundStyle(Theme.mutedForeground.color)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 16)
            .hairlineAbove()
            .padding(.top, 16)
    }

    /// Rows split by lines, a line above the first too (`divide-y border-t`).
    private func rows<Item: Identifiable, Row: View>(
        _ items: [Item], @ViewBuilder row: @escaping (Int, Item) -> Row
    ) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.element.id) { i, item in
                row(i, item).hairlineAbove()
            }
        }
        .padding(.top, 16)
    }

    @ViewBuilder private func groups(_ overview: AdminOverview) -> some View {
        let shown = overview.groups.filter { g in
            matches(g.name, g.createdByName) || g.members.contains { matches($0.name) }
        }
        if shown.isEmpty {
            empty(query.isEmpty ? CasyStrings.adminNoGroups : CasyStrings.adminNoGroupMatch)
        } else {
            rows(shown) { _, g in groupRow(g) }
        }
    }

    /// A group: its name (14 semibold), size, age and maker (12 muted), then
    /// every member as a chip with a cross to remove them; the bin deletes it.
    private func groupRow(_ g: AdminOverview.Group) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 0) {
                Text(g.name)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.foreground.color)
                    .lineLimit(1)
                    .cssLineHeight(20, size: 14)
                Text(
                    CasyStrings.adminGroupMeta(
                        CasyStrings.members(g.members.count), formatDate(g.createdAt, lang), by: g.createdByName)
                )
                .font(.system(size: 12))
                .foregroundStyle(Theme.mutedForeground.color)
                .cssLineHeight(16, size: 12)
                .padding(.top, 2)
                WrapLayout(spacing: 6) {
                    ForEach(Array(g.members.enumerated()), id: \.element.id) { i, m in
                        memberChip(m, index: i, in: g)
                    }
                }
                .padding(.top, 8)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            RoundIconButton(icon: "trash", label: CasyStrings.adminDeleteGroupTitle) {
                asking = .deleteGroup(g)
            }
        }
        .padding(.vertical, 16)
    }

    private func memberChip(_ m: AdminOverview.Member, index: Int, in g: AdminOverview.Group) -> some View {
        HStack(spacing: 6) {
            Avatar(name: m.name, index: index, size: .extraSmall)
            Text(m.name)
                .font(.system(size: 12))
                .foregroundStyle(Theme.foreground.color)
                .lineLimit(1)
            Button {
                asking = .removeMember(g, m)
            } label: {
                Group {
                    if removingMember == m.profileId {
                        ProgressView().controlSize(.mini)
                    } else {
                        LucideIcon("x", size: 12).foregroundStyle(Theme.mutedForeground.color)
                    }
                }
                .frame(width: 16, height: 16)
                .contentShape(Rectangle().inset(by: -8))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(CasyStrings.adminRemove) \(m.name)")
        }
        .padding(.leading, 2)
        .padding(.trailing, 6)
        .padding(.vertical, 2)
        .background(Theme.background.color, in: Capsule())
        .overlay(Capsule().strokeBorder(Theme.border.color, lineWidth: 1))
    }

    @ViewBuilder private func users(_ overview: AdminOverview) -> some View {
        let shown = overview.users.filter { matches($0.name) && (!problemsOnly || $0.calendars == 0) }
        if overview.usersTruncated {
            Text(CasyStrings.adminFirstOnly("\(overview.users.count)"))
                .font(.system(size: 12))
                .foregroundStyle(Theme.amber700.color)
                .padding(.top, 16)
        }
        if shown.isEmpty {
            empty(CasyStrings.adminNoUserMatch)
        } else {
            rows(shown) { i, u in userRow(u, index: i) }
        }
    }

    /// A person on a phone: their picture and name (and "Dig"), when they came
    /// and were last seen across the whole width, then one line with the AI
    /// switch from the left and their groups, calendars, re-sync and bin from
    /// the right; how a re-sync went under it.
    private func userRow(_ u: AdminOverview.User, index: Int) -> some View {
        let isYou = u.id == ProfileModel.shared.userId
        let syncing = model.syncing.contains(u.id)
        return VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 12) {
                Avatar(name: u.name, index: index, size: .medium)
                HStack(spacing: 8) {
                    Text(u.name)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Theme.foreground.color)
                        .lineLimit(1)
                    if isYou {
                        Text(CasyStrings.adminYou)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(Theme.primary.color)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 2)
                            .background(Theme.primary.color.opacity(0.1), in: Capsule())
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            Text(
                CasyStrings.adminJoined(formatDate(u.createdAt, lang))
                    + (u.lastSignInAt.map { CasyStrings.adminLastSignIn(formatDate($0, lang)) } ?? "")
            )
            .font(.system(size: 12))
            .foregroundStyle(Theme.mutedForeground.color)
            .cssLineHeight(16, size: 12)
            .padding(.top, 6)
            HStack(spacing: 8) {
                aiAccess(u)
                Spacer(minLength: 0)
                counts(u)
                RoundIconButton(
                    icon: "refresh-cw", size: 28, spinning: syncing,
                    label: CasyStrings.adminSyncUserTitle(u.name)
                ) {
                    Task { await model.syncUser(u.id) }
                }
                .disabled(syncing || u.calendars == 0)
                .opacity(syncing || u.calendars == 0 ? 0.4 : 1)
                // Never on your own row: the server refuses it too.
                if isYou {
                    Color.clear.frame(width: 28, height: 28)
                } else {
                    RoundIconButton(
                        icon: "trash", size: 28, label: "\(CasyStrings.adminDeleteAccount) \(u.name)"
                    ) {
                        asking = .deleteUser(u)
                    }
                }
            }
            .padding(.top, 8)
            if let result = model.syncResults[u.id] {
                Text(result.text)
                    .font(.system(size: 12))
                    .foregroundStyle(result.ok ? Theme.emerald700.color : Theme.amber700.color)
                    .padding(.top, 2)
            }
            if let failure = testerFailure[u.id] {
                Text(failure)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.red700.color)
                    .padding(.top, 2)
            }
        }
        .padding(.vertical, 12)
    }

    /// AI-admin as a grey pill; anyone else's tester switch as a pill that
    /// is green while on (#111). Nothing from a server too old to say.
    @ViewBuilder private func aiAccess(_ u: AdminOverview.User) -> some View {
        if u.ai == "admin" {
            pill(CasyStrings.adminAiAdmin)
                .foregroundStyle(Theme.mutedForeground.color)
                .background(Theme.secondary.color, in: Capsule())
        } else if u.ai != nil, let tester = u.tester {
            let saving = testerSaving.contains(u.id)
            Button {
                setTester(u, !tester)
            } label: {
                HStack(spacing: 4) {
                    if saving { ProgressView().controlSize(.mini) }
                    pill(tester ? CasyStrings.adminTesterOn : CasyStrings.adminTesterOff)
                }
                .foregroundStyle(tester ? Theme.emerald800.color : Theme.mutedForeground.color)
                .background(tester ? Theme.emerald50.color : Theme.background.color, in: Capsule())
                .overlay(
                    Capsule().strokeBorder(tester ? Theme.emerald200.color : Theme.border.color, lineWidth: 1))
            }
            .buttonStyle(.plain)
            .disabled(saving)
            .opacity(saving ? 0.5 : 1)
            .accessibilityLabel(tester ? CasyStrings.adminTesterTurnOff(u.name) : CasyStrings.adminTesterTurnOn(u.name))
        }
    }

    private func pill(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .medium))
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
    }

    private func setTester(_ u: AdminOverview.User, _ on: Bool) {
        testerSaving.insert(u.id)
        testerFailure[u.id] = nil
        Task {
            defer { testerSaving.remove(u.id) }
            do { try await model.setTester(u, on) } catch { testerFailure[u.id] = error.localizedDescription }
        }
    }

    /// Their groups and calendars as an icon and a number (14 semibold); no
    /// calendar at all in amber.
    private func counts(_ u: AdminOverview.User) -> some View {
        let none = u.calendars == 0
        return HStack(spacing: 10) {
            HStack(spacing: 4) {
                LucideIcon("users", size: 14).foregroundStyle(Theme.mutedForeground.color)
                Text(verbatim: "\(u.groups)")
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(u.groups) \(CasyStrings.adminGroupsLabel)")
            HStack(spacing: 4) {
                LucideIcon("calendar-days", size: 14)
                    .foregroundStyle(none ? Theme.amber700.color : Theme.mutedForeground.color)
                Text(verbatim: "\(u.calendars)")
                    .foregroundStyle(none ? Theme.amber700.color : Theme.foreground.color)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(u.calendars) \(CasyStrings.adminCalendarsLabel)")
        }
        .font(.system(size: 14, weight: .semibold).monospacedDigit())
        .foregroundStyle(Theme.foreground.color)
    }

    @ViewBuilder private func connections(_ overview: AdminOverview) -> some View {
        let shown = overview.connections.filter { c in
            matches(c.ownerName, CasyStrings.named("admin.providers", c.provider))
                && (!problemsOnly || c.status != "connected" || c.needsReconnect || c.syncError != nil)
        }
        if shown.isEmpty {
            empty(problemsOnly ? CasyStrings.adminNoProblems : CasyStrings.adminNoAccountMatch)
        } else {
            rows(shown) { _, c in connectionRow(c) }
        }
    }

    /// A calendar account: how it is (a tick, a warning or a cross), whose and
    /// which, its calendars and last sync, what is wrong, and its re-sync.
    private func connectionRow(_ c: AdminOverview.Connection) -> some View {
        let broken = c.status == "connected" && (c.needsReconnect || c.syncError != nil)
        let syncing = model.syncing.contains(c.id)
        return HStack(spacing: 12) {
            Group {
                if c.status != "connected" {
                    LucideIcon("circle-x", size: 16).foregroundStyle(Theme.mutedForeground.color)
                } else if broken {
                    LucideIcon("triangle-alert", size: 16).foregroundStyle(Theme.amber600.color)
                } else {
                    LucideIcon("circle-check", size: 16).foregroundStyle(Theme.emerald600.color)
                }
            }
            VStack(alignment: .leading, spacing: 0) {
                (Text(c.ownerName).font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Theme.foreground.color)
                    + Text(" · \(CasyStrings.named("admin.providers", c.provider))").font(.system(size: 14))
                    .foregroundStyle(Theme.mutedForeground.color))
                    .lineLimit(1)
                Text(connectionLine(c))
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.mutedForeground.color)
                if c.needsReconnect {
                    Text(CasyStrings.adminNeedsReconnect)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Theme.amber700.color)
                        .padding(.top, 2)
                } else if let error = c.syncError {
                    Text(error)
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.amber700.color)
                        .padding(.top, 2)
                }
                if let result = model.syncResults[c.id] {
                    Text(result.text)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(result.ok ? Theme.emerald700.color : Theme.red700.color)
                        .padding(.top, 2)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if c.status == "connected" {
                RoundIconButton(icon: "refresh-cw", spinning: syncing, label: CasyStrings.adminSyncTitle) {
                    Task { await model.syncConnection(c.id) }
                }
                .disabled(syncing)
                .opacity(syncing ? 0.6 : 1)
            }
        }
        .padding(.vertical, 12)
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

    // MARK: The yes

    private func confirm(_ ask: AdminAsk) -> ConfirmAsk {
        switch ask {
        case .deleteGroup(let g):
            return ConfirmAsk(
                message: CasyStrings.adminDeleteGroupConfirm(g.name, members: g.members.count),
                confirmLabel: CasyStrings.adminDeleteGroup
            ) {
                try await model.deleteGroup(g.id)
            }
        case .removeMember(let g, let m):
            let last = g.members.count <= 1
            return ConfirmAsk(
                message: CasyStrings.adminRemoveMember(m.name, from: g.name, last: last),
                confirmLabel: last ? CasyStrings.adminRemoveAndDelete : CasyStrings.adminRemove
            ) {
                removingMember = m.profileId
                defer { removingMember = nil }
                try await model.removeMember(m.profileId, from: g.id)
            }
        case .deleteUser(let u):
            let overview = model.overview
            let theirs = overview?.groups.filter { $0.members.contains { $0.profileId == u.id } } ?? []
            return ConfirmAsk(
                message: CasyStrings.adminDeleteUserConfirm(
                    u.name, accounts: overview?.connections.filter { $0.ownerId == u.id }.count ?? 0,
                    groups: theirs.count, soleGroups: theirs.filter { $0.members.count == 1 }.count),
                confirmLabel: CasyStrings.adminDeleteAccount,
                typeToConfirm: (CasyStrings.adminTypeToConfirm(u.name), u.name)
            ) {
                try await model.deleteUser(u)
            }
        case .deleteReportGroup(let r):
            return ConfirmAsk(
                message: CasyStrings.adminReportDeleteGroupConfirm(r.content.groupName),
                confirmLabel: CasyStrings.adminReportDeleteGroup
            ) {
                try await reviews.deleteGroup(r)
            }
        }
    }
}

/// One number over its label, as the web's StatTile: a grey rounded box,
/// 24 bold and 12 muted under it, centred; red while it needs attention.
private struct StatTileView: View {
    let label: String
    let value: Int?
    var alert = false

    var body: some View {
        VStack(spacing: 2) {
            Text(value.map { $0.formatted(.number.locale(Locale(identifier: "en_GB"))) } ?? "...")
                .font(.system(size: 24, weight: .bold).monospacedDigit())
                .foregroundStyle(alert ? Theme.red700.color : Theme.foreground.color)
                .cssLineHeight(32, size: 24)
            Text(label)
                .font(.system(size: 12))
                .foregroundStyle(alert ? Theme.red800.color.opacity(0.8) : Theme.mutedForeground.color)
                .cssLineHeight(16, size: 12)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(12)
        .background(alert ? Theme.red50.color : Theme.secondary.color, in: RoundedRectangle(cornerRadius: 12))
        .accessibilityElement(children: .combine)
    }
}

/// The web's checkbox for a filter (admin only, not a person's choice): a 16
/// point square, orange with a tick while on, and its words (14 muted).
private struct CheckboxRow: View {
    let label: String
    @Binding var isOn: Bool

    var body: some View {
        Button {
            isOn.toggle()
        } label: {
            HStack(spacing: 8) {
                RoundedRectangle(cornerRadius: 4)
                    .fill(isOn ? Theme.primary.color : Theme.background.color)
                    .overlay {
                        if isOn {
                            LucideIcon("check", size: 12).foregroundStyle(Theme.primaryForeground.color)
                        } else {
                            RoundedRectangle(cornerRadius: 4).strokeBorder(Theme.mutedForeground.color, lineWidth: 1)
                        }
                    }
                    .frame(width: 16, height: 16)
                Text(label)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.mutedForeground.color)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(.isToggle)
        .accessibilityValue(isOn ? "1" : "0")
    }
}
