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

/// The push test (#139), as the web's PushTest: notifications switched on for
/// this phone, then a test the whole way through Apple and back, which proves
/// pushes work before anything real is sent; how it went under the button.
struct AdminPushTest: View {
    /// Turns notifications on through the web view: "granted", "denied" or "failed".
    let enablePush: () async -> String

    @State private var pushing = false
    @State private var answer: (ok: Bool, text: String)?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            OutlineCapsule(label: pushing ? CasyStrings.pushTestSending : CasyStrings.pushTestButton) {
                send()
            }
            .disabled(pushing)
            .opacity(pushing ? 0.6 : 1)
            if let answer {
                Notice(answer.text, tone: answer.ok ? .success : .error)
            }
        }
    }

    private func send() {
        pushing = true
        answer = nil
        Task {
            defer { pushing = false }
            if await permission() == "denied" {
                answer = (false, CasyStrings.pushTestDenied)
                return
            }
            do {
                guard let api = await Native.api() else {
                    throw APIError.failed(status: 401, message: CasyStrings.pushFailed)
                }
                let sent = try await api.adminPushTest(lang: CasyStrings.language, errorMessage: CasyStrings.pushFailed)
                answer =
                    sent.sent > 0
                    ? (true, CasyStrings.pushTestSent(sent.sent))
                    : (false, CasyStrings.pushTestNone(sent.failed))
            } catch {
                answer = (false, error.localizedDescription)
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

/// Rapporter and Rettelser til AI'en (#142, #122), as the web's AdminReports
/// and AdminCorrections: a card each, folded away until opened, its title
/// (14 semibold) and count after a chevron that turns down; open, what it is
/// for (12 muted), then each one as it was sent, never who sent it, with
/// Klaret (dealing with one deletes it) and, for a report, taking a picture
/// down or deleting the group, asked first.
struct AdminReviewCards: View {
    @Binding var asking: AdminAsk?

    private let model = AdminReviewsModel.shared
    @State private var reportsOpen = false
    @State private var correctionsOpen = false
    @State private var failure: String?

    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    var body: some View {
        VStack(spacing: 16) {
            fold(CasyStrings.adminReportsTitle, count: model.reports?.count, open: $reportsOpen) {
                reports
            }
            fold(CasyStrings.adminCorrectionsTitle, count: model.sortedCorrections?.count, open: $correctionsOpen) {
                corrections
            }
        }
        .padding(.top, 16)
        .task { await model.load() }
    }

    private func fold<Content: View>(
        _ title: String, count: Int?, open: Binding<Bool>, @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                open.wrappedValue.toggle()
            } label: {
                HStack(spacing: 8) {
                    LucideIcon("chevron-right", size: 16)
                        .foregroundStyle(Theme.mutedForeground.color)
                        .rotationEffect(.degrees(open.wrappedValue ? 90 : 0))
                        .animation(.easeOut(duration: 0.15), value: open.wrappedValue)
                    Text(title)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.foreground.color)
                        .cssLineHeight(20, size: 14)
                    if let count {
                        Text(verbatim: "\(count)")
                            .font(.system(size: 12).monospacedDigit())
                            .foregroundStyle(Theme.mutedForeground.color)
                    }
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityValue(open.wrappedValue ? "open" : "")
            if open.wrappedValue {
                VStack(alignment: .leading, spacing: 0) { content() }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16)
                    .padding(.top, 12)
                    .padding(.bottom, 16)
                    .hairlineAbove()
            }
        }
        .adminCard()
    }

    /// What it is for (12 muted), and the list's state when there is no list.
    @ViewBuilder private func opening(intro: String, loaded: Bool, error: String?, none: String?) -> some View {
        Text(intro)
            .font(.system(size: 12))
            .foregroundStyle(Theme.mutedForeground.color)
            .cssLineHeight(16, size: 12)
            .fixedSize(horizontal: false, vertical: true)
        if let error {
            Notice(error, tone: .error).padding(.top, 12)
        } else if !loaded {
            HStack(spacing: 8) {
                ProgressView().controlSize(.small)
                Text(CasyStrings.adminLoading).font(.system(size: 14))
            }
            .foregroundStyle(Theme.mutedForeground.color)
            .padding(.top, 12)
        } else if let none {
            Text(none)
                .font(.system(size: 14))
                .foregroundStyle(Theme.mutedForeground.color)
                .padding(.top, 12)
        }
    }

    // MARK: Reports

    @ViewBuilder private var reports: some View {
        let list = model.reports
        opening(
            intro: CasyStrings.adminReportsIntro, loaded: list != nil, error: model.reportsFailure,
            none: list?.isEmpty == true ? CasyStrings.adminReportsNone : nil)
        if let list, !list.isEmpty {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(list) { r in reportRow(r).hairlineAbove() }
            }
            .padding(.top, 12)
        }
        if let failure { Notice(failure, tone: .error, bare: true).padding(.top, 8) }
    }

    /// A report: what it was about and why (14 medium), the words as they
    /// were, the picture, the reporter's note in quotes, the day (11 muted);
    /// its buttons down the right.
    private func reportRow(_ r: AdminReport) -> some View {
        let c = r.content
        let busy = model.working.contains(r.id)
        let removed = model.picturesRemoved.contains(r.id)
        return HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 0) {
                Text("\(CasyStrings.adminReportKind(r.kind)) · \(CasyStrings.reportReason(r.reason))")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Theme.foreground.color)
                ForEach([c.groupName, c.groupDescription].compactMap { $0 }.filter { !$0.isEmpty }, id: \.self) {
                    Text($0).foregroundStyle(Theme.mutedForeground.color)
                }
                if let name = c.memberName { Text(name).foregroundStyle(Theme.foreground.color) }
                if let picture = r.pictureUrl.flatMap(URL.init(string:)), !removed {
                    AsyncImage(url: picture) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        Theme.secondary.color
                    }
                    .frame(width: 64, height: 64)
                    .clipShape(Circle())
                    .padding(.top, 4)
                }
                if let title = c.title { Text(title).foregroundStyle(Theme.foreground.color) }
                ForEach([c.place, c.note].compactMap { $0 }.filter { !$0.isEmpty }, id: \.self) {
                    Text($0).foregroundStyle(Theme.mutedForeground.color)
                }
                if let note = r.note, !note.isEmpty {
                    Text("“\(note)”").italic().foregroundStyle(Theme.foreground.color).padding(.top, 4)
                }
                Text(formatDayMonth(r.createdAt, lang))
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.mutedForeground.color)
                    .padding(.top, 4)
            }
            .font(.system(size: 14))
            .lineSpacing(20 - 14 * 1.193)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            VStack(alignment: .trailing, spacing: 6) {
                OutlineCapsule(label: CasyStrings.adminReportHandled, icon: "check", small: true) {
                    run { try await model.handleReport(r.id) }
                }
                if r.pictureUrl != nil, c.memberId != nil || r.groupId != nil {
                    OutlineCapsule(
                        label: removed ? CasyStrings.adminReportPictureRemoved : CasyStrings.adminReportRemovePicture,
                        icon: "trash", small: true, color: Theme.red700.color
                    ) {
                        run { try await model.removePicture(r) }
                    }
                    .disabled(removed)
                    .opacity(removed ? 0.6 : 1)
                }
                if r.groupId != nil {
                    OutlineCapsule(
                        label: CasyStrings.adminReportDeleteGroup, icon: "trash", small: true,
                        color: Theme.red700.color
                    ) {
                        asking = .deleteReportGroup(r)
                    }
                }
            }
            .disabled(busy)
            .opacity(busy ? 0.6 : 1)
        }
        .padding(.vertical, 12)
    }

    // MARK: Corrections

    @ViewBuilder private var corrections: some View {
        let list = model.sortedCorrections
        opening(
            intro: CasyStrings.adminCorrectionsIntro, loaded: list != nil, error: model.correctionsFailure,
            none: list?.isEmpty == true ? CasyStrings.adminCorrectionsNone : nil)
        if let list, !list.isEmpty {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(list) { c in
                    HStack(alignment: .top, spacing: 12) {
                        VStack(alignment: .leading, spacing: 0) {
                            correction(c)
                            Text(formatDayMonth(c.createdAt, lang))
                                .font(.system(size: 11))
                                .foregroundStyle(Theme.mutedForeground.color)
                                .padding(.top, 4)
                        }
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        OutlineCapsule(label: CasyStrings.adminCorrectionHandled, icon: "check", small: true) {
                            run { try await model.handleCorrection(c.id) }
                        }
                        .disabled(model.working.contains(c.id))
                        .opacity(model.working.contains(c.id) ? 0.6 : 1)
                    }
                    .padding(.vertical, 12)
                    .hairlineAbove()
                }
            }
            .padding(.top, 12)
        }
    }

    /// One correction in words: what the AI said, what the person wrote, what came of it.
    @ViewBuilder private func correction(_ c: AdminCorrection) -> some View {
        if c.kind == "label", let d = c.data.decoded(as: LabelCorrection.self) {
            let label = { (l: LabelCorrection.Label) in
                "\(CasyStrings.eventLabelKind(l.kind)) · \(CasyStrings.eventLabelImportance(l.importance))"
            }
            (Text(d.title).font(.system(size: 14, weight: .medium)).foregroundStyle(Theme.foreground.color)
                + Text(" · \(d.calendar)").font(.system(size: 14)).foregroundStyle(Theme.mutedForeground.color))
            Text(
                "\(CasyStrings.adminCorrectionBefore): \(label(d.previous)). \(CasyStrings.adminCorrectionAfter): \(label(d.label))."
            )
            .font(.system(size: 12))
            .foregroundStyle(Theme.mutedForeground.color)
            .cssLineHeight(16, size: 12)
            .padding(.top, 2)
            Text("\(CasyStrings.adminCorrectionNote): “\(d.note)”")
                .font(.system(size: 12))
                .foregroundStyle(Theme.foreground.color)
                .cssLineHeight(16, size: 12)
                .padding(.top, 2)
        } else if let d = c.data.decoded(as: PlanCorrection.self) {
            let show = { (v: JSONValue?) in v == nil || v == .null ? "-" : v!.compactJSON }
            Text(CasyStrings.adminCorrectionPlan)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Theme.foreground.color)
            ForEach(Array(d.texts.enumerated()), id: \.offset) { _, text in
                Text("\(CasyStrings.adminCorrectionNote): “\(text)”")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.foreground.color)
                    .cssLineHeight(16, size: 12)
                    .padding(.top, 2)
            }
            if d.overridden.isEmpty {
                Text(CasyStrings.adminCorrectionPlanUnchanged)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.mutedForeground.color)
                    .cssLineHeight(16, size: 12)
                    .padding(.top, 2)
            } else {
                Text("\(CasyStrings.adminCorrectionPlanChanged):")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.mutedForeground.color)
                    .cssLineHeight(16, size: 12)
                    .padding(.top, 2)
                ForEach(d.overridden, id: \.self) { field in
                    Text("\(field): \(show(d.plan[field])) → \(show(d.final[field]))")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.mutedForeground.color)
                        .cssLineHeight(16, size: 12)
                }
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
