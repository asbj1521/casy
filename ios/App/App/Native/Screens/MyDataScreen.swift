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
///
/// Drawn as the web draws it (#281): the intro, then CasyUI's CardLists;
/// a fact's value 14 muted at the end, one line, at most 224 wide (the web's
/// max-w-[14rem] truncate); a list of 5 rows or more folded behind one row.
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
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // The web's intro: 14 muted, the policy's name medium and underlined.
                linked(
                    CasyStrings.myDataIntro(CasyStrings.myDataPrivacyLink), CasyStrings.myDataPrivacyLink,
                    to: "/privacy", strong: true
                )
                .font(.system(size: 14))
                .foregroundStyle(Theme.mutedForeground.color)
                .tint(Theme.foreground.color)  // a link's colour
                .cssLineHeight(20, size: 14)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 4)
                if let data = model.data {
                    if !model.consented { consentList(data) }
                    account(data)
                    calendars(data)
                    busy(data)
                    groups(data)
                    events(data)
                    credentials(data)
                    blocked
                    download
                } else if model.loadFailed {
                    Notice(CasyStrings.myDataLoadFailed, tone: .error)
                        .padding(.top, 24)
                } else {
                    // 14 muted with a 16 point spinner, 8 between (mt-6).
                    HStack(spacing: 8) {
                        ProgressView().controlSize(.small)
                        Text(CasyStrings.myDataLoading)
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.mutedForeground.color)
                    }
                    .padding(.top, 24)
                }
                if let failure = model.failure {
                    Notice(failure, tone: .error, bare: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 8)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.bottom, 16)
        }
        .accessibilityIdentifier("mydata.list")
        .casyPushedBar(CasyStrings.myDataTitle, close: CasyStrings.done, action: closeSheet)
        .pageLinks(leave: leave)
        .task { await model.load() }
        .refreshable { await model.load() }
        .askFirst(
            AskWords(
                message: CasyStrings.aiConsentTurnOffMessage, confirm: CasyStrings.aiConsentTurnOff, danger: false),
            isPresented: $askingOff
        ) { await model.setConsent(false) }
        .sheet(item: $exported) { file in
            ShareSheet(url: file.url)
        }
    }

    // MARK: The lists

    /// The AI switch at the top while off, with what it means and the policy's link.
    private func consentList(_ data: MyData) -> some View {
        CardList(
            CasyStrings.myDataAi,
            footnoteText: linked(
                CasyStrings.aiConsentFootnote(CasyStrings.aiConsentPrivacyLink),
                CasyStrings.aiConsentPrivacyLink, to: "/privacy#ai")
        ) {
            consentRow(data)
        }
        .tint(Theme.mutedForeground.color)  // the footnote's link, as its words
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
        return switchRow(
            CasyStrings.aiConsentRow, detail: detail,
            isOn: Binding(
                get: { model.consented },
                set: { on in
                    // Turning it off deletes things, so it asks first; on is at once.
                    if on { Task { await model.setConsent(true) } } else { askingOff = true }
                }),
            saving: model.consentSaving)
    }

    private func account(_ data: MyData) -> some View {
        let a = data.account
        return CardList(CasyStrings.myDataAccount) {
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

    /// Every account and every calendar is a row: from 5 together they fold
    /// behind one. Each account is a list of its own, 12 apart.
    @ViewBuilder private func calendars(_ data: MyData) -> some View {
        if data.calendars.isEmpty {
            CardList(CasyStrings.myDataCalendars) {
                CardRow(CasyStrings.myDataNoCalendars)
            }
        } else {
            let count = data.calendars.reduce(0) { $0 + $1.calendars.count }
            let folded = data.calendars.count + count >= Self.foldFrom
            if folded {
                CardList(CasyStrings.myDataCalendars) {
                    foldRow(
                        "\(CasyStrings.myDataAccountsCount(data.calendars.count)), \(CasyStrings.calendarsCount(count))",
                        open: $calendarsOpen)
                }
            }
            if !folded || calendarsOpen {
                ForEach(Array(data.calendars.enumerated()), id: \.offset) { i, account in
                    CardList(!folded && i == 0 ? CasyStrings.myDataCalendars : nil, spaced: false) {
                        CardRow(
                            account.label ?? CasyStrings.named("provider", account.provider),
                            detail: "\(CasyStrings.named("provider", account.provider)) · \(CasyStrings.myDataConnectedOn(formatDayMonthYear(account.connectedAt, lang)))"
                        ) {
                            ProviderBadge(provider: account.provider)
                        }
                        ForEach(Array(account.calendars.enumerated()), id: \.offset) { _, c in
                            CardRow(
                                c.customName.map { "\($0) (\(c.name ?? ""))" } ?? (c.name ?? "-"),
                                detail: calendarDetail(c),
                                value: CasyStrings.busyBlocks(c.busyCount))
                        }
                    }
                    .padding(.top, 12)
                }
            }
            CardList(spaced: false) {
                fact(CasyStrings.myDataPrimary, data.primary?.calendar ?? CasyStrings.myDataPrimaryNone)
                fact(
                    CasyStrings.myDataAutoAdd,
                    data.primary?.autoAdd == true ? CasyStrings.myDataOn : CasyStrings.myDataOff)
            }
            .padding(.top, 12)
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
        CardList(CasyStrings.myDataBusy) {
            fact(CasyStrings.myDataBusyCount, "\(data.busy.count)")
            fact(CasyStrings.myDataToldCasy, "\(data.toldCasy.count)")
            if let first = data.busy.first { fact(CasyStrings.myDataBusyFrom, formatDayMonthYear(first, lang)) }
            if let last = data.busy.last { fact(CasyStrings.myDataBusyTo, formatDayMonthYear(last, lang)) }
        }
        if !data.busy.next.isEmpty {
            CardList(CasyStrings.myDataBusyNext, footnote: CasyStrings.myDataBusyNote, spaced: false) {
                ForEach(Array(data.busy.next.enumerated()), id: \.offset) { _, span in
                    CardRow(storedSpan(span))
                }
            }
            .padding(.top, 12)
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
        CardList(CasyStrings.myDataGroups) {
            if data.groups.isEmpty { CardRow(CasyStrings.myDataNoGroups) }
            let folded = data.groups.count >= Self.foldFrom
            if folded { foldRow(CasyStrings.myDataGroupsCount(data.groups.count), open: $groupsOpen) }
            if !folded || groupsOpen {
                ForEach(Array(data.groups.enumerated()), id: \.offset) { _, g in
                    let members = CasyStrings.members(g.members)
                    // The web's lines under the name, each its own line.
                    let lines = [
                        g.createdByYou ? CasyStrings.myDataGroupDetailYours(members) : members,
                        g.description, g.primeDates == false ? CasyStrings.primeOff : nil,
                    ].compactMap { $0 }.filter { !$0.isEmpty }
                    CardRow(g.name, detail: lines.joined(separator: "\n"), wrap: lines.count > 1)
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
                fact(
                    CasyStrings.friendsLinksInData,
                    CasyStrings.myDataInviteLinksValue(made: links.made, active: links.active))
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
        CardList(CasyStrings.myDataEvents) {
            fact(CasyStrings.myDataInvitedTo, "\(data.events.invitedTo)")
            fact(CasyStrings.myDataSuggested, "\(data.events.suggested)")
            fact(CasyStrings.myDataAnswers, "\(data.events.answers)")
            fact(CasyStrings.myDataDeclined, "\(data.events.declined)")
            fact(CasyStrings.myDataShortcuts, "\(data.shortcuts.count)")
            fact(CasyStrings.myDataShortcutPictures, "\(data.shortcuts.pictures ?? 0)")
            fact(CasyStrings.myDataGroupPictures, "\(data.groupPictures?.count ?? 0)")
        }
        CardList(CasyStrings.myDataEntries) {
            fact(CasyStrings.myDataEntriesAdded, "\(data.calendarEntries.added)")
            fact(CasyStrings.myDataEntriesDeleted, "\(data.calendarEntries.deletedByYou)")
        }
        CardList(CasyStrings.myDataAi, footnote: "\(CasyStrings.myDataAiNote) \(CasyStrings.myDataLabelsNote)") {
            if model.consented {
                consentRow(data)
                switchRow(
                    CasyStrings.myDataShareCorrections,
                    detail: data.ai.corrections.sharing ? CasyStrings.myDataShareOn : CasyStrings.myDataShareOff,
                    isOn: Binding(
                        get: { data.ai.corrections.sharing },
                        set: { on in Task { await model.setShare(on) } }),
                    saving: model.shareSaving)
                fact(CasyStrings.myDataCorrectionsKept, "\(data.ai.corrections.kept)")
                if data.ai.corrections.kept > 0 {
                    Button {
                        Task { await model.deleteCorrections() }
                    } label: {
                        CardRow(CasyStrings.myDataCorrectionsDelete, tone: .danger) {
                            busyIcon("trash", busy: model.removingCorrections, color: Theme.red600.color)
                        }
                    }
                    .buttonStyle(.cardRow)
                    .disabled(model.removingCorrections)
                }
            }
            fact(CasyStrings.myDataLabels, model.labels.map { "\($0)" } ?? "-")
            fact(CasyStrings.myDataAiCalls, "\(data.ai.calls)")
        }
    }

    @ViewBuilder private func credentials(_ data: MyData) -> some View {
        if !data.calendars.isEmpty {
            CardList(CasyStrings.myDataCredentials, footnote: CasyStrings.myDataCredentialsNote) {
                let folded = data.calendars.count >= Self.foldFrom
                if folded { foldRow(CasyStrings.myDataAccountsCount(data.calendars.count), open: $credentialsOpen) }
                if !folded || credentialsOpen {
                    ForEach(Array(data.calendars.enumerated()), id: \.offset) { _, account in
                        CardRow(
                            account.label ?? CasyStrings.named("provider", account.provider),
                            detail: account.credential.map { CasyStrings.named("myData.credentialKinds", $0) }
                                ?? CasyStrings.myDataCredentialNone)
                    }
                }
            }
        }
    }

    /// Nothing at all until someone is blocked, so the screen stays short.
    @ViewBuilder private var blocked: some View {
        if !model.blocked.isEmpty {
            CardList(CasyStrings.blockedTitle, footnote: CasyStrings.blockedFootnote) {
                ForEach(model.blocked) { person in
                    CardRow(
                        person.name ?? CasyStrings.blockedUnknownName, icon: "user-x",
                        detail: CasyStrings.blockedSince(formatDayLongMonthYear(person.blockedAt, lang))
                    ) {
                        if model.unblocking == person.profileId {
                            ProgressView().controlSize(.small)
                        } else {
                            Button(CasyStrings.blockedUnblock) {
                                Task { await model.unblock(person.profileId) }
                            }
                            .buttonStyle(.plain)
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(Theme.primary.color)
                            .frame(minHeight: 44)
                            .contentShape(Rectangle())
                        }
                    }
                }
            }
        }
    }

    /// Hent en kopi: everything above as a file, to share or save.
    private var download: some View {
        CardList {
            Button {
                Task {
                    if let file = await model.export() { exported = ExportFile(url: file) }
                }
            } label: {
                CardRow(
                    model.exporting ? CasyStrings.myDataDownloading : CasyStrings.myDataDownload,
                    detail: CasyStrings.myDataDownloadDetail, tone: .primary
                ) {
                    busyIcon("download", busy: model.exporting, color: Theme.primary.color)
                }
            }
            .buttonStyle(.cardRow)
            .disabled(model.exporting)
        }
    }

    // MARK: Pieces

    /// A fact: what it is, and its value at the end, cut with "..." if long (an email).
    private func fact(_ label: String, _ value: String, detail: String? = nil) -> some View {
        CardRow(label, detail: detail) {
            EmptyView()
        } trailing: {
            Text(value)
                .font(.system(size: 14))
                .foregroundStyle(Theme.mutedForeground.color)
                .lineLimit(1)
                // Its own width, at most 224 (cut there), never squeezed by the label.
                .frame(maxWidth: 224, alignment: .trailing)
                .fixedSize()
        }
        .accessibilityElement(children: .combine)
    }

    /// A row with a switch at its end (the web's Switch, size lg).
    private func switchRow(_ label: String, detail: String, isOn: Binding<Bool>, saving: Bool) -> some View {
        CardRow(label, detail: detail) {
            EmptyView()
        } trailing: {
            Toggle(label, isOn: isOn)
                .labelsHidden()
                .tint(Theme.primary.color)
                .disabled(saving)
        }
        .accessibilityElement(children: .contain)
    }

    /// A row's 20 point icon, or the spinner while it works.
    @ViewBuilder private func busyIcon(_ name: String, busy: Bool, color: Color) -> some View {
        if busy {
            ProgressView().controlSize(.small).tint(color).frame(width: 20, height: 20)
        } else {
            LucideIcon(name, size: 20).foregroundStyle(color)
        }
    }

    private func foldRow(_ label: String, open: Binding<Bool>) -> some View {
        Button {
            open.wrappedValue.toggle()
        } label: {
            CardRow(label, expanded: open.wrappedValue)
        }
        .buttonStyle(.cardRow)
        .accessibilityValue(open.wrappedValue ? "open" : "")
    }

    /// Words with a link inside, opened in Swift by `pageLinks`; `strong`:
    /// the link medium in the text's own colour (the intro's), else only underlined.
    private func linked(_ words: String, _ linkWords: String, to address: String, strong: Bool = false) -> Text {
        var text = AttributedString(words)
        // The last mention is the link: the words may name the policy earlier too.
        if let range = text.range(of: linkWords, options: .backwards) {
            text[range].link = URL(string: address)
            text[range].underlineStyle = .single
            if strong { text[range].font = .system(size: 14, weight: .medium) }
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
