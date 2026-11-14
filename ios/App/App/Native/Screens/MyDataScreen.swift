import CasyAPI
import CasyCore
import CasyUI
import SwiftUI

/// Dine data, read fresh each time the screen opens (never kept on the phone),
/// with the AI switches, blocked people and the copy to save.
@MainActor @Observable
final class MyDataModel {
    static let shared = MyDataModel()

    private(set) var data: MyData?
    private(set) var loadFailed = false
    private(set) var blocked: [BlockedPerson] = []
    /// Labels kept only on this phone (#112), counted by the page that keeps them.
    private(set) var labels: Int?
    private(set) var consentSaving = false
    private(set) var shareSaving = false
    private(set) var removingCorrections = false
    private(set) var unblocking: String?
    private(set) var exporting = false
    var failure: String?

    /// Tells the page a yes or a no to the AI was saved: a no deletes the
    /// labels and trips it keeps on the phone (afterAiConsent on the web).
    var onAiConsent: ((Bool) -> Void)?
    /// Asks the page how many labels it keeps on the phone.
    var askLabels: (() async -> Int)?

    func reset() {
        data = nil
        loadFailed = false
        blocked = []
        labels = nil
        failure = nil
    }

    /// Whether the AI may read calendar names and titles now: your yes, under today's wording.
    var consented: Bool {
        ProfileModel.shared.whoAmI?.aiConsent ?? (data?.ai.consent?.current == true)
    }

    func load() async {
        guard let api = await Native.api() else { return }
        async let mine = try? api.myData(errorMessage: CasyStrings.myDataLoadFailed)
        async let people = try? api.blocked()
        let (answer, list) = await (mine, people)
        if let answer {
            data = answer
            loadFailed = false
        } else if data == nil {
            loadFailed = true
        }
        if let list { blocked = list }
        if let askLabels { labels = await askLabels() }
    }

    func setConsent(_ on: Bool) async {
        consentSaving = true
        failure = nil
        defer { consentSaving = false }
        do {
            let api = try await signedIn()
            try await api.setAiConsent(on, errorMessage: CasyStrings.aiConsentFailed)
            ProfileModel.shared.noteAiConsent(on)
            onAiConsent?(on)
            await load()
        } catch {
            failure = error.localizedDescription
        }
    }

    func setShare(_ on: Bool) async {
        shareSaving = true
        failure = nil
        defer { shareSaving = false }
        do {
            let api = try await signedIn()
            try await api.setAiShare(on, errorMessage: CasyStrings.aiConsentFailed)
            await load()
        } catch {
            failure = error.localizedDescription
        }
    }

    func deleteCorrections() async {
        removingCorrections = true
        failure = nil
        defer { removingCorrections = false }
        do {
            let api = try await signedIn()
            try await api.deleteMyCorrections(errorMessage: CasyStrings.aiConsentFailed)
            await load()
        } catch {
            failure = error.localizedDescription
        }
    }

    func unblock(_ profileId: String) async {
        unblocking = profileId
        failure = nil
        defer { unblocking = nil }
        do {
            let api = try await signedIn()
            blocked = try await api.unblock(profileId, errorMessage: CasyStrings.invitationsBlockFailed)
            ProfileModel.shared.onChange?()
        } catch {
            failure = error.localizedDescription
        }
    }

    /// Everything above as a JSON file, `casy-data-<date>.json`, ready to share or save.
    func export() async -> URL? {
        exporting = true
        failure = nil
        defer { exporting = false }
        do {
            let api = try await signedIn()
            let whole = try await api.exportMyData(errorMessage: CasyStrings.myDataLoadFailed)
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
            let day = isoString(Int64(Date().timeIntervalSince1970 * 1000)).prefix(10)
            let file = FileManager.default.temporaryDirectory.appendingPathComponent("casy-data-\(day).json")
            try encoder.encode(whole).write(to: file, options: .atomic)
            return file
        } catch {
            failure = error.localizedDescription
            return nil
        }
    }

    private func signedIn() async throws -> EdgeFunctions {
        if let api = await Native.api() { return api }
        throw APIError.failed(status: 401, message: CasyStrings.myDataLoadFailed)
    }
}

/// Dine data (#198), pushed inside the Profil sheet, as the web's MyData:
/// everything we hold about you, in the order and words of the privacy
/// policy's "What we store", and a copy to save. The AI switch is at the top
/// while it is off, in the AI list once on; turning it off asks first.
struct MyDataScreen: View {
    let leave: (LeavingProfile) -> Void

    /// Past this many rows, a list folds behind one row that opens it.
    private static let foldFrom = 5

    private let model = MyDataModel.shared
    @Environment(\.closeSheet) private var closeSheet
    @State private var askingOff = false
    @State private var calendarsOpen = false
    @State private var groupsOpen = false
    @State private var credentialsOpen = false
    @State private var exported: ExportFile?

    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    var body: some View {
        List {
            if let data = model.data {
                Section {
                } footer: {
                    linked(
                        CasyStrings.myDataIntro(CasyStrings.myDataPrivacyLink), CasyStrings.myDataPrivacyLink,
                        to: "/privacy")
                }
                if !model.consented { consentSection(data) }
                account(data)
                calendars(data)
                busy(data)
                groups(data)
                events(data)
                credentials(data)
                blocked
                Section {
                    Button {
                        Task {
                            if let file = await model.export() { exported = ExportFile(url: file) }
                        }
                    } label: {
                        HStack {
                            ListRow(
                                model.exporting ? CasyStrings.myDataDownloading : CasyStrings.myDataDownload,
                                systemImage: "square.and.arrow.down",
                                detail: CasyStrings.myDataDownloadDetail, tone: .primary)
                            if model.exporting { ProgressView().controlSize(.small) }
                        }
                        .contentShape(Rectangle())
                    }
                    .disabled(model.exporting)
                }
            } else if model.loadFailed {
                Notice(CasyStrings.myDataLoadFailed, tone: .error, bare: true)
            } else {
                HStack(spacing: 8) {
                    ProgressView().controlSize(.small)
                    Text(CasyStrings.myDataLoading)
                        .font(.subheadline)
                        .foregroundStyle(Theme.mutedForeground.color)
                }
            }
            if let failure = model.failure { Notice(failure, tone: .error, bare: true) }
        }
        .casyPushedBar(CasyStrings.myDataTitle, close: CasyStrings.done, action: closeSheet)
        .pageLinks(leave: leave)
        .task { await model.load() }
        .refreshable { await model.load() }
        .confirmationDialog(
            CasyStrings.aiConsentTurnOffMessage, isPresented: $askingOff, titleVisibility: .visible
        ) {
            Button(CasyStrings.aiConsentTurnOff, role: .destructive) {
                Task { await model.setConsent(false) }
            }
            Button(CasyStrings.cancel, role: .cancel) {}
        }
        .sheet(item: $exported) { file in
            ShareSheet(url: file.url)
        }
    }

    // MARK: The sections

    /// The AI switch: at the top while off (with what it means), a row of the AI list once on.
    @ViewBuilder private func consentSection(_ data: MyData) -> some View {
        Section {
            consentRow(data)
        } header: {
            Text(CasyStrings.myDataAi)
        } footer: {
            linked(
                CasyStrings.aiConsentFootnote(CasyStrings.aiConsentPrivacyLink), CasyStrings.aiConsentPrivacyLink,
                to: "/privacy#ai")
        }
    }

    private func consentRow(_ data: MyData) -> some View {
        let detail: String
        if model.consented, let given = data.ai.consent, given.current {
            detail = CasyStrings.myDataAiConsentOn(formatDayMonthYear(given.givenAt, lang))
        } else if model.consented {
            detail = CasyStrings.aiConsentRowOn
        } else {
            detail = data.ai.consent != nil ? CasyStrings.myDataAiConsentAgain : CasyStrings.aiConsentRowOff
        }
        return ListSwitchRow(
            CasyStrings.aiConsentRow,
            isOn: Binding(
                get: { model.consented },
                set: { on in
                    // Turning it off deletes things, so it asks first; on is at once.
                    if on { Task { await model.setConsent(true) } } else { askingOff = true }
                }),
            detail: detail
        )
        .disabled(model.consentSaving)
    }

    private func account(_ data: MyData) -> some View {
        let a = data.account
        return Section(CasyStrings.myDataAccount) {
            fact(CasyStrings.myDataEmail, a.email ?? "-")
            fact(
                CasyStrings.myDataName, a.name ?? CasyStrings.myDataNameNotYet,
                detail: a.name == nil
                    ? nil : (a.nameIsCustom ? CasyStrings.myDataNameCustom : CasyStrings.myDataNameFromLogin))
            fact(
                CasyStrings.myDataPicture,
                a.picture == true ? CasyStrings.myDataPictureKept : CasyStrings.myDataPictureNone)
            fact(
                CasyStrings.myDataSignIn,
                a.signIn.map { CasyStrings.named("myData.signInMethods", $0) }.joined(separator: ", ")
                    .nonEmpty ?? "-",
                detail: a.appleToken ? CasyStrings.myDataAppleToken : nil)
            // Only for someone with notifications: nothing is kept for anyone else.
            if a.push.devices > 0 || !a.push.off.isEmpty {
                fact(
                    CasyStrings.myDataPush,
                    a.push.devices > 0 ? CasyStrings.myDataPushOn(a.push.devices) : CasyStrings.myDataPushOff,
                    detail: CasyStrings.myDataPushDetail)
            }
            fact(
                CasyStrings.myDataEmailLanguage,
                a.language.map { CasyStrings.named("myData.languages", $0) } ?? CasyStrings.myDataLanguagesDa,
                detail: a.language == nil ? CasyStrings.myDataLanguageDefault : nil)
            if let created = a.createdAt {
                fact(CasyStrings.myDataCreated, formatDayMonthYear(created, lang))
            }
        }
    }

    @ViewBuilder private func calendars(_ data: MyData) -> some View {
        if data.calendars.isEmpty {
            Section(CasyStrings.myDataCalendars) {
                Text(CasyStrings.myDataNoCalendars).font(.subheadline)
            }
        } else {
            let count = data.calendars.reduce(0) { $0 + $1.calendars.count }
            let folded = data.calendars.count + count >= Self.foldFrom
            if folded {
                Section(CasyStrings.myDataCalendars) {
                    foldRow(
                        "\(CasyStrings.myDataAccountsCount(data.calendars.count)), \(CasyStrings.calendarsCount(count))",
                        open: $calendarsOpen)
                }
            }
            if !folded || calendarsOpen {
                ForEach(Array(data.calendars.enumerated()), id: \.offset) { i, account in
                    Section {
                        ListRow(
                            account.label ?? CasyStrings.named("provider", account.provider),
                            systemImage: "calendar",
                            detail: "\(CasyStrings.named("provider", account.provider)) · \(CasyStrings.myDataConnectedOn(formatDayMonthYear(account.connectedAt, lang)))"
                        )
                        ForEach(Array(account.calendars.enumerated()), id: \.offset) { _, c in
                            ListRow(
                                c.customName.map { "\($0) (\(c.name ?? ""))" } ?? (c.name ?? "-"),
                                detail: calendarDetail(c),
                                value: CasyStrings.busyBlocks(c.busyCount))
                        }
                    } header: {
                        if !folded && i == 0 { Text(CasyStrings.myDataCalendars) }
                    }
                }
            }
            Section {
                fact(CasyStrings.myDataPrimary, data.primary?.calendar ?? CasyStrings.myDataPrimaryNone)
                fact(CasyStrings.myDataAutoAdd, data.primary?.autoAdd == true ? CasyStrings.myDataOn : CasyStrings.myDataOff)
            }
        }
    }

    private func calendarDetail(_ c: MyData.Calendar) -> String {
        var parts: [String] = []
        if let purpose = c.purpose {
            let name = c.categoryName ?? CasyStrings.named("category", purpose)
            parts.append(c.purposeGuessed ? "\(name) (\(CasyStrings.guessed))" : name)
        }
        parts.append(CasyStrings.named("priority", c.priority))
        if !c.included { parts.append(CasyStrings.myDataNotCounted) }
        return parts.joined(separator: " · ")
    }

    @ViewBuilder private func busy(_ data: MyData) -> some View {
        Section(CasyStrings.myDataBusy) {
            fact(CasyStrings.myDataBusyCount, "\(data.busy.count)")
            fact(CasyStrings.myDataToldCasy, "\(data.toldCasy.count)")
            if let first = data.busy.first { fact(CasyStrings.myDataBusyFrom, formatDayMonthYear(first, lang)) }
            if let last = data.busy.last { fact(CasyStrings.myDataBusyTo, formatDayMonthYear(last, lang)) }
        }
        if !data.busy.next.isEmpty {
            Section {
                ForEach(Array(data.busy.next.enumerated()), id: \.offset) { _, span in
                    Text(storedSpan(span)).font(.subheadline)
                }
            } header: {
                Text(CasyStrings.myDataBusyNext)
            } footer: {
                Text(CasyStrings.myDataBusyNote)
            }
        }
    }

    /// "fre. 9. okt. · 18:00-20:00", or across days, both ends in full.
    private func storedSpan(_ span: MyData.Span) -> String {
        let endDay = parseInstant(span.end).map { isoString($0 - 1) } ?? span.end
        if formatDate(span.start, lang) == formatDate(endDay, lang) {
            return "\(formatDate(span.start, lang)) · \(formatTime(span.start))-\(formatTime(span.end))"
        }
        let to = lang == .da ? "til" : "to"
        return "\(formatDate(span.start, lang)) \(formatTime(span.start)) \(to) \(formatDate(span.end, lang)) \(formatTime(span.end))"
    }

    private func groups(_ data: MyData) -> some View {
        Section(CasyStrings.myDataGroups) {
            if data.groups.isEmpty { Text(CasyStrings.myDataNoGroups).font(.subheadline) }
            let folded = data.groups.count >= Self.foldFrom
            if folded { foldRow(CasyStrings.myDataGroupsCount(data.groups.count), open: $groupsOpen) }
            if !folded || groupsOpen {
                ForEach(Array(data.groups.enumerated()), id: \.offset) { _, g in
                    let members = CasyStrings.members(g.members)
                    let lines = [
                        g.createdByYou ? CasyStrings.myDataGroupDetailYours(members) : members,
                        g.description, g.primeDates == false ? CasyStrings.primeOff : nil,
                    ].compactMap { $0 }.filter { !$0.isEmpty }
                    ListRow(g.name, detail: lines.joined(separator: "\n"))
                }
            }
            fact(
                CasyStrings.myDataInviteLinks,
                CasyStrings.myDataInviteLinksValue(made: data.inviteLinks.made, active: data.inviteLinks.active))
            fact(
                CasyStrings.myDataInvitationsToYou,
                CasyStrings.myDataInvitationsToYouValue(
                    pending: data.invitations.pending, declined: data.invitations.declined))
            fact(CasyStrings.myDataInvitationsSent, "\(data.invitations.sent)")
            fact(CasyStrings.myDataEmailLookups, "\(data.emailLookups)", detail: CasyStrings.myDataEmailLookupsDetail)
            if let links = data.friendLinks, links.made > 0 {
                fact(CasyStrings.friendsLinksInData, CasyStrings.myDataInviteLinksValue(made: links.made, active: links.active))
            }
            if let friends = data.friends, friends.count > 0 {
                fact(CasyStrings.friendsInData, "\(friends.count)")
            }
            if data.safety.reportsSent > 0 {
                fact(CasyStrings.myDataReportsSent, "\(data.safety.reportsSent)")
            }
        }
    }

    @ViewBuilder private func events(_ data: MyData) -> some View {
        Section(CasyStrings.myDataEvents) {
            fact(CasyStrings.myDataInvitedTo, "\(data.events.invitedTo)")
            fact(CasyStrings.myDataSuggested, "\(data.events.suggested)")
            fact(CasyStrings.myDataAnswers, "\(data.events.answers)")
            fact(CasyStrings.myDataDeclined, "\(data.events.declined)")
            fact(CasyStrings.myDataShortcuts, "\(data.shortcuts.count)")
            fact(CasyStrings.myDataShortcutPictures, "\(data.shortcuts.pictures ?? 0)")
            fact(CasyStrings.myDataGroupPictures, "\(data.groupPictures?.count ?? 0)")
        }
        Section(CasyStrings.myDataEntries) {
            fact(CasyStrings.myDataEntriesAdded, "\(data.calendarEntries.added)")
            fact(CasyStrings.myDataEntriesDeleted, "\(data.calendarEntries.deletedByYou)")
        }
        Section {
            if model.consented {
                consentRow(data)
                ListSwitchRow(
                    CasyStrings.myDataShareCorrections,
                    isOn: Binding(
                        get: { data.ai.corrections.sharing },
                        set: { on in Task { await model.setShare(on) } }),
                    detail: data.ai.corrections.sharing ? CasyStrings.myDataShareOn : CasyStrings.myDataShareOff
                )
                .disabled(model.shareSaving)
                fact(CasyStrings.myDataCorrectionsKept, "\(data.ai.corrections.kept)")
                if data.ai.corrections.kept > 0 {
                    Button {
                        Task { await model.deleteCorrections() }
                    } label: {
                        ListRow(CasyStrings.myDataCorrectionsDelete, systemImage: "trash", tone: .danger)
                            .contentShape(Rectangle())
                    }
                    .disabled(model.removingCorrections)
                }
            }
            fact(CasyStrings.myDataLabels, model.labels.map { "\($0)" } ?? "-")
            fact(CasyStrings.myDataAiCalls, "\(data.ai.calls)")
        } header: {
            Text(CasyStrings.myDataAi)
        } footer: {
            Text("\(CasyStrings.myDataAiNote) \(CasyStrings.myDataLabelsNote)")
        }
    }

    @ViewBuilder private func credentials(_ data: MyData) -> some View {
        if !data.calendars.isEmpty {
            Section {
                let folded = data.calendars.count >= Self.foldFrom
                if folded { foldRow(CasyStrings.myDataAccountsCount(data.calendars.count), open: $credentialsOpen) }
                if !folded || credentialsOpen {
                    ForEach(Array(data.calendars.enumerated()), id: \.offset) { _, account in
                        ListRow(
                            account.label ?? CasyStrings.named("provider", account.provider),
                            detail: account.credential.map { CasyStrings.named("myData.credentialKinds", $0) }
                                ?? CasyStrings.myDataCredentialNone)
                    }
                }
            } header: {
                Text(CasyStrings.myDataCredentials)
            } footer: {
                Text(CasyStrings.myDataCredentialsNote)
            }
        }
    }

    /// Nothing at all until someone is blocked, so the screen stays short.
    @ViewBuilder private var blocked: some View {
        if !model.blocked.isEmpty {
            Section {
                ForEach(model.blocked) { person in
                    HStack {
                        ListRow(
                            person.name ?? CasyStrings.blockedUnknownName, systemImage: "person.slash",
                            detail: CasyStrings.blockedSince(formatDayLongMonthYear(person.blockedAt, lang)))
                        if model.unblocking == person.profileId {
                            ProgressView().controlSize(.small)
                        } else {
                            Button(CasyStrings.blockedUnblock) {
                                Task { await model.unblock(person.profileId) }
                            }
                            .buttonStyle(.borderless)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(Theme.primary.color)
                        }
                    }
                }
            } header: {
                Text(CasyStrings.blockedTitle)
            } footer: {
                Text(CasyStrings.blockedFootnote)
            }
        }
    }

    // MARK: Pieces

    /// A fact: what it is, and its value at the end, which wraps if long (an email).
    private func fact(_ label: String, _ value: String, detail: String? = nil) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.foreground.color)
                if let detail {
                    Text(detail)
                        .font(.footnote)
                        .foregroundStyle(Theme.mutedForeground.color)
                }
            }
            Spacer(minLength: 8)
            Text(value)
                .font(.subheadline)
                .foregroundStyle(Theme.mutedForeground.color)
                .multilineTextAlignment(.trailing)
        }
        .accessibilityElement(children: .combine)
    }

    private func foldRow(_ label: String, open: Binding<Bool>) -> some View {
        Button {
            open.wrappedValue.toggle()
        } label: {
            HStack {
                ListRow(label)
                Image(systemName: "chevron.down")
                    .rotationEffect(.degrees(open.wrappedValue ? 180 : 0))
                    .foregroundStyle(Theme.mutedForeground.color)
                    .accessibilityHidden(true)
            }
            .contentShape(Rectangle())
        }
        .accessibilityValue(open.wrappedValue ? "open" : "")
    }

    /// Words with the privacy policy linked inside, opened in Swift by `pageLinks`.
    private func linked(_ words: String, _ linkWords: String, to address: String) -> some View {
        var text = AttributedString(words)
        // The last mention is the link: the words may name the policy earlier too.
        if let range = text.range(of: linkWords, options: .backwards) {
            text[range].link = URL(string: address)
            text[range].underlineStyle = .single
        }
        return Text(text)
    }
}

/// The copy to save, for the share sheet.
private struct ExportFile: Identifiable {
    let url: URL
    var id: URL { url }
}

/// iOS's own share sheet with a file: Gem i Arkiver, AirDrop, Mail.
private struct ShareSheet: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [url], applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

extension String {
    /// Nil for an empty string, so `?? "-"` reads as the web's `|| "-"`.
    fileprivate var nonEmpty: String? { isEmpty ? nil : self }
}
