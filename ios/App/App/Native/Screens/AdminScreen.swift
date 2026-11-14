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

    func reset() {
        overview = nil
        failure = nil
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
                }
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
        .refreshable { await model.load() }
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
