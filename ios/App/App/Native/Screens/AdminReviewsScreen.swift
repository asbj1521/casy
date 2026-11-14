import CasyAPI
import CasyCore
import CasyUI
import SwiftUI

/// What waits for the admin's review (#198): reports of what people wrote
/// (#142) and corrections of the AI (#122), never who sent either, as the
/// web's AdminReports and AdminCorrections. Dealing with one deletes it.
@MainActor @Observable
final class AdminReviewsModel {
    static let shared = AdminReviewsModel()

    private(set) var reports: [AdminReport]?
    private(set) var corrections: [AdminCorrection]?
    private(set) var reportsFailure: String?
    private(set) var correctionsFailure: String?
    /// The ids being dealt with right now, each spinning on its own.
    private(set) var working: Set<String> = []
    /// Reports whose picture was taken down from here.
    private(set) var picturesRemoved: Set<String> = []

    func reset() {
        reports = nil
        corrections = nil
        reportsFailure = nil
        correctionsFailure = nil
        picturesRemoved = []
    }

    private func api() async throws -> EdgeFunctions {
        if let api = await Native.api() { return api }
        throw APIError.failed(status: 401, message: CasyStrings.adminLoadFailed)
    }

    func load() async {
        async let reports: Void = loadReports()
        async let corrections: Void = loadCorrections()
        _ = await (reports, corrections)
    }

    func loadReports() async {
        do {
            reports = try await api().adminReports(errorMessage: CasyStrings.adminReportsFailed)
            reportsFailure = nil
        } catch {
            reportsFailure = error.localizedDescription
        }
    }

    func loadCorrections() async {
        do {
            corrections = try await api().adminCorrections(errorMessage: CasyStrings.adminLoadFailed)
            correctionsFailure = nil
        } catch {
            correctionsFailure = error.localizedDescription
        }
    }

    /// Where the AI was wrong first; a plan sent as it was made has no lesson
    /// in it, only a case that works, so it goes last. Newest first within each.
    var sortedCorrections: [AdminCorrection]? {
        guard let corrections else { return nil }
        let wrong = corrections.filter { !Self.isRight($0) }
        return wrong + corrections.filter(Self.isRight)
    }

    static func isRight(_ c: AdminCorrection) -> Bool {
        c.kind == "plan" && (c.data.decoded(as: PlanCorrection.self)?.overridden.isEmpty ?? false)
    }

    private func busy(_ id: String, _ action: () async throws -> Void) async throws {
        working.insert(id)
        defer { working.remove(id) }
        try await action()
    }

    func handleReport(_ id: String) async throws {
        try await busy(id) {
            try await api().adminReportHandled(id, errorMessage: CasyStrings.adminReportsFailed)
            reports?.removeAll { $0.id == id }
        }
    }

    /// A member's picture, or the group's (#187, #188).
    func removePicture(_ report: AdminReport) async throws {
        try await busy(report.id) {
            if let member = report.content.memberId {
                try await api().adminRemoveAvatar(member, errorMessage: CasyStrings.picturesRemoveFailed)
            } else if let group = report.groupId {
                try await api().adminRemoveGroupPicture(group, errorMessage: CasyStrings.picturesRemoveFailed)
            }
            picturesRemoved.insert(report.id)
        }
    }

    /// The group a report came from, deleted for everyone; the report goes with it.
    func deleteGroup(_ report: AdminReport) async throws {
        guard let group = report.groupId else { return }
        try await busy(report.id) {
            try await AdminModel.shared.deleteGroup(group)
            reports?.removeAll { $0.id == report.id }
        }
    }

    func handleCorrection(_ id: String) async throws {
        try await busy(id) {
            try await api().adminCorrectionHandled(id, errorMessage: CasyStrings.adminAiAccessFailed)
            corrections?.removeAll { $0.id == id }
        }
    }
}

/// Admin's entries to the reviews, and the push test (#139), as one section.
struct AdminReviewRows: View {
    /// Turns notifications on through the web view: "granted", "denied" or "failed".
    let enablePush: () async -> String

    private let model = AdminReviewsModel.shared
    @State private var pushing = false
    @State private var pushAnswer: (ok: Bool, text: String)?

    var body: some View {
        Section {
            NavigationLink {
                AdminReportsScreen()
            } label: {
                ListRow(
                    CasyStrings.adminReportsTitle, systemImage: "flag",
                    value: model.reports.map { "\($0.count)" })
            }
            NavigationLink {
                AdminCorrectionsScreen()
            } label: {
                ListRow(
                    CasyStrings.adminCorrectionsTitle, systemImage: "sparkles",
                    value: model.corrections.map { "\($0.count)" })
            }
            Button {
                pushTest()
            } label: {
                HStack {
                    ListRow(
                        pushing ? CasyStrings.pushTestSending : CasyStrings.pushTestButton,
                        systemImage: "bell.badge", tone: .primary)
                    if pushing { ProgressView().controlSize(.small) }
                }
                .contentShape(Rectangle())
            }
            .disabled(pushing)
            if let pushAnswer {
                Notice(pushAnswer.text, tone: pushAnswer.ok ? .success : .error, bare: true)
            }
        }
        .task { await model.load() }
    }

    /// Notifications switched on for this phone, then a test the whole way
    /// through Apple and back: proves pushes work before anything real is sent.
    private func pushTest() {
        pushing = true
        pushAnswer = nil
        Task {
            defer { pushing = false }
            if await permission() == "denied" {
                pushAnswer = (false, CasyStrings.pushTestDenied)
                return
            }
            do {
                guard let api = await Native.api() else { throw APIError.failed(status: 401, message: CasyStrings.pushFailed) }
                let answer = try await api.adminPushTest(lang: CasyStrings.language, errorMessage: CasyStrings.pushFailed)
                pushAnswer =
                    answer.sent > 0
                    ? (true, CasyStrings.pushTestSent(answer.sent))
                    : (false, CasyStrings.pushTestNone(answer.failed))
            } catch {
                pushAnswer = (false, error.localizedDescription)
            }
        }
    }

    private func permission() async -> String {
        #if DEBUG
            // A test has no web view to ask: it says what the phone would answer.
            if let faked = TestLaunch.pushPermission { return faked == "denied" ? "denied" : "granted" }
        #endif
        return await enablePush()
    }
}

/// Rapporter: each report as it was sent, then what can be done about it,
/// deleting last and asked first.
struct AdminReportsScreen: View {
    private let model = AdminReviewsModel.shared
    @Environment(\.closeSheet) private var closeSheet
    @State private var deleting: AdminReport?
    @State private var failure: String?

    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    var body: some View {
        List {
            if let failure = model.reportsFailure ?? failure { Notice(failure, tone: .error, bare: true) }
            if let reports = model.reports {
                if reports.isEmpty {
                    Section {
                        Text(CasyStrings.adminReportsNone).foregroundStyle(Theme.mutedForeground.color)
                    } footer: {
                        Text(CasyStrings.adminReportsIntro)
                    }
                }
                ForEach(Array(reports.enumerated()), id: \.element.id) { i, report in
                    Section {
                        content(report)
                        actions(report)
                    } footer: {
                        if i == reports.count - 1 { Text(CasyStrings.adminReportsIntro) }
                    }
                    .disabled(model.working.contains(report.id))
                }
            } else if model.reportsFailure == nil {
                ProgressView()
            }
        }
        .casyPushedBar(CasyStrings.adminReportsTitle, close: CasyStrings.done, action: closeSheet)
        .refreshable { await model.loadReports() }
        .confirmationDialog(
            CasyStrings.adminReportDeleteGroupConfirm(deleting?.content.groupName),
            isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }),
            titleVisibility: .visible, presenting: deleting
        ) { report in
            Button(CasyStrings.adminReportDeleteGroup, role: .destructive) {
                run { try await model.deleteGroup(report) }
            }
            Button(CasyStrings.cancel, role: .cancel) {}
        }
    }

    /// What it was about and why, the words as they were, and the reporter's note.
    private func content(_ r: AdminReport) -> some View {
        let c = r.content
        return VStack(alignment: .leading, spacing: 2) {
            Text("\(CasyStrings.adminReportKind(r.kind)) · \(CasyStrings.reportReason(r.reason))")
                .font(.subheadline.weight(.semibold))
            ForEach(
                [c.groupName, c.groupDescription].compactMap { $0 }.filter { !$0.isEmpty }, id: \.self
            ) { line in
                Text(line).font(.subheadline).foregroundStyle(Theme.mutedForeground.color)
            }
            if let name = c.memberName { Text(name).font(.subheadline) }
            if let picture = r.pictureUrl.flatMap(URL.init(string:)), !model.picturesRemoved.contains(r.id) {
                Avatar(name: c.memberName ?? c.groupName ?? "", index: 0, size: .large, url: picture)
                    .padding(.vertical, 2)
            }
            if let title = c.title { Text(title).font(.subheadline) }
            ForEach([c.place, c.note].compactMap { $0 }.filter { !$0.isEmpty }, id: \.self) { line in
                Text(line).font(.subheadline).foregroundStyle(Theme.mutedForeground.color)
            }
            if let note = r.note, !note.isEmpty {
                Text("“\(note)”").font(.subheadline).italic().padding(.top, 2)
            }
            Text(formatDayMonth(r.createdAt, lang))
                .font(.caption2)
                .foregroundStyle(Theme.mutedForeground.color)
                .padding(.top, 2)
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder private func actions(_ r: AdminReport) -> some View {
        Button {
            run { try await model.handleReport(r.id) }
        } label: {
            HStack {
                ListRow(CasyStrings.adminReportHandled, systemImage: "checkmark", tone: .primary)
                if model.working.contains(r.id) { ProgressView().controlSize(.small) }
            }
            .contentShape(Rectangle())
        }
        if r.pictureUrl != nil, r.content.memberId != nil || r.groupId != nil {
            let removed = model.picturesRemoved.contains(r.id)
            Button {
                run { try await model.removePicture(r) }
            } label: {
                ListRow(
                    removed ? CasyStrings.adminReportPictureRemoved : CasyStrings.adminReportRemovePicture,
                    systemImage: removed ? "checkmark.circle" : "person.crop.circle.badge.xmark",
                    tone: removed ? .standard : .danger)
                    .contentShape(Rectangle())
            }
            .disabled(removed)
        }
        if r.groupId != nil {
            Button {
                deleting = r
            } label: {
                ListRow(CasyStrings.adminReportDeleteGroup, systemImage: "trash", tone: .danger)
                    .contentShape(Rectangle())
            }
        }
    }

    private func run(_ action: @escaping () async throws -> Void) {
        failure = nil
        Task {
            do { try await action() } catch { failure = error.localizedDescription }
        }
    }
}

/// Rettelser til AI'en: what the AI said, what the person wrote and what came
/// of it, where it was wrong first. Marking one handled deletes it.
struct AdminCorrectionsScreen: View {
    private let model = AdminReviewsModel.shared
    @Environment(\.closeSheet) private var closeSheet
    @State private var failure: String?

    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    var body: some View {
        List {
            if let failure = model.correctionsFailure ?? failure { Notice(failure, tone: .error, bare: true) }
            if let corrections = model.sortedCorrections {
                if corrections.isEmpty {
                    Section {
                        Text(CasyStrings.adminCorrectionsNone).foregroundStyle(Theme.mutedForeground.color)
                    } footer: {
                        Text(CasyStrings.adminCorrectionsIntro)
                    }
                }
                ForEach(Array(corrections.enumerated()), id: \.element.id) { i, c in
                    Section {
                        VStack(alignment: .leading, spacing: 2) {
                            correction(c)
                            Text(formatDayMonth(c.createdAt, lang))
                                .font(.caption2)
                                .foregroundStyle(Theme.mutedForeground.color)
                                .padding(.top, 2)
                        }
                        .padding(.vertical, 2)
                        .accessibilityElement(children: .combine)
                        Button {
                            failure = nil
                            Task {
                                do { try await model.handleCorrection(c.id) } catch {
                                    failure = error.localizedDescription
                                }
                            }
                        } label: {
                            HStack {
                                ListRow(CasyStrings.adminCorrectionHandled, systemImage: "checkmark", tone: .primary)
                                if model.working.contains(c.id) { ProgressView().controlSize(.small) }
                            }
                            .contentShape(Rectangle())
                        }
                    } footer: {
                        if i == corrections.count - 1 { Text(CasyStrings.adminCorrectionsIntro) }
                    }
                    .disabled(model.working.contains(c.id))
                }
            } else if model.correctionsFailure == nil {
                ProgressView()
            }
        }
        .casyPushedBar(CasyStrings.adminCorrectionsTitle, close: CasyStrings.done, action: closeSheet)
        .refreshable { await model.loadCorrections() }
    }

    /// One correction in words: what the AI said, what the person wrote, what came of it.
    @ViewBuilder private func correction(_ c: AdminCorrection) -> some View {
        if c.kind == "label", let d = c.data.decoded(as: LabelCorrection.self) {
            let label = { (l: LabelCorrection.Label) in
                "\(CasyStrings.eventLabelKind(l.kind)) · \(CasyStrings.eventLabelImportance(l.importance))"
            }
            (Text(d.title).font(.subheadline.weight(.semibold))
                + Text(" · \(d.calendar)").font(.subheadline).foregroundStyle(Theme.mutedForeground.color))
            Text(
                "\(CasyStrings.adminCorrectionBefore): \(label(d.previous)). \(CasyStrings.adminCorrectionAfter): \(label(d.label))."
            )
            .font(.footnote)
            .foregroundStyle(Theme.mutedForeground.color)
            Text("\(CasyStrings.adminCorrectionNote): “\(d.note)”").font(.footnote)
        } else if let d = c.data.decoded(as: PlanCorrection.self) {
            let show = { (v: JSONValue?) in v == nil || v == .null ? "-" : v!.compactJSON }
            Text(CasyStrings.adminCorrectionPlan).font(.subheadline.weight(.semibold))
            ForEach(Array(d.texts.enumerated()), id: \.offset) { _, text in
                Text("\(CasyStrings.adminCorrectionNote): “\(text)”").font(.footnote)
            }
            if d.overridden.isEmpty {
                Text(CasyStrings.adminCorrectionPlanUnchanged)
                    .font(.footnote)
                    .foregroundStyle(Theme.mutedForeground.color)
            } else {
                Text("\(CasyStrings.adminCorrectionPlanChanged):")
                    .font(.footnote)
                    .foregroundStyle(Theme.mutedForeground.color)
                ForEach(d.overridden, id: \.self) { field in
                    Text("\(field): \(show(d.plan[field])) → \(show(d.final[field]))")
                        .font(.footnote.monospaced())
                        .foregroundStyle(Theme.mutedForeground.color)
                }
            }
        }
    }
}
