import CasyAPI
import CasyCore
import CasyUI
import CoreImage.CIFilterBuiltins
import SwiftUI

/// One round of inviting to a group (#153), as the web's useInvite: the people
/// ticked and the emails added, a link once asked for, and what was sent.
/// A new one each time the sheet opens.
@MainActor @Observable
final class InviteModel {
    let groupId: String
    let groupName: String

    var picked: [String] = []
    var emails: [String] = []
    var emailOpen = false
    var draft = "" { didSet { emailError = nil } }
    private(set) var emailError: String?
    /// What the last send said, kept after the picks are cleared.
    private(set) var sentNote: String?
    private(set) var sending = false
    private(set) var sendError: String?
    private(set) var link: InviteLink?
    private(set) var makingLink = false
    private(set) var linkError: String?
    var showQr = false
    private(set) var contactsBusy = false
    private(set) var contactsNote: (ok: Bool, text: String)?

    private let groups = GroupsModel.shared

    init(groupId: String, groupName: String) {
        self.groupId = groupId
        self.groupName = groupName
    }

    var count: Int { picked.count + emails.count }
    var people: [KnownPerson] { groups.people(for: groupId) }
    var invited: Set<String> { Set(groups.indexed(groupId)?.group.invited ?? []) }
    var message: String { CasyStrings.inviteMessage(groupName) }
    var shareTitle: String { CasyStrings.inviteShareTitle(groupName) }

    func toggle(_ profileId: String) {
        sentNote = nil
        if let i = picked.firstIndex(of: profileId) { picked.remove(at: i) } else { picked.append(profileId) }
    }

    /// Adds what is in the field; false if it wasn't an address that could be.
    @discardableResult func addEmail() -> Bool {
        let email = draft.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if email.isEmpty { return true }
        guard looksLikeEmail(email) else {
            emailError = CasyStrings.inviteNotAnEmail
            return false
        }
        if !emails.contains(email) {
            guard emails.count < maxEmailsPerInvite else {
                emailError = CasyStrings.inviteTooManyEmails(maxEmailsPerInvite)
                return false
            }
            emails.append(email)
            sentNote = nil
        }
        draft = ""
        return true
    }

    func removeEmail(_ email: String) { emails.removeAll { $0 == email } }

    /// The picks sent; true once they are.
    func send() async -> Bool {
        // An address still in the field goes too, rather than being dropped.
        if looksLikeEmail(draft) { addEmail() }
        guard count > 0 else { return false }
        sending = true
        sendError = nil
        defer { sending = false }
        do {
            try await groups.invite(groupId, profileIds: picked, emails: emails)
            sentNote = emails.isEmpty ? CasyStrings.inviteSent : CasyStrings.inviteSentWithEmail
            picked = []
            emails = []
            return true
        } catch {
            sendError = error.localizedDescription
            return false
        }
    }

    @discardableResult func makeLink() async -> InviteLink? {
        if let link { return link }
        guard !makingLink else { return nil }
        makingLink = true
        linkError = nil
        defer { makingLink = false }
        do {
            let made = try await groups.makeLink(groupId)
            link = made
            return made
        } catch {
            linkError = error.localizedDescription
            return nil
        }
    }

    /// The link was copied, shared or its QR code shown: someone is probably being invited.
    func linkUsed() { groups.inviteSent(groupId) }

    /// Contacts picked, the link made here if there is none yet, and Messages
    /// opened with them; a phone that can't text gets the share sheet.
    func inviteFromContacts() async {
        contactsBusy = true
        contactsNote = nil
        defer { contactsBusy = false }
        guard let url = await makeLink()?.url else { return }
        switch await ContactInviter.shared.invite(message: message, url: url, shareTitle: shareTitle) {
        case .sent:
            contactsNote = (true, CasyStrings.inviteTexted)
            linkUsed()
        case .shared: linkUsed()
        case .failed: contactsNote = (false, CasyStrings.inviteTextFailed)
        case .cancelled, nil: break
        }
    }

    /// "Det virker i 7 dage."
    var linkHelp: String? {
        guard let link, let expires = parseInstant(link.expiresAt) else { return nil }
        let now = Int64(Date().timeIntervalSince1970 * 1000)
        let left: String
        switch linkLife(expiresAt: expires, now: now) {
        case .expired: left = CasyStrings.inviteExpired
        case .days(let n): left = CasyStrings.inviteExpiry(days: n, hours: nil)
        case .hours(let n): left = CasyStrings.inviteExpiry(days: nil, hours: n)
        case .underAnHour: left = CasyStrings.inviteExpiry(days: nil, hours: nil)
        }
        return CasyStrings.inviteLinkHelp(left)
    }
}

/// Bringing more people into a group (#153), from the group's Invitér folk.
struct InviteSheet: View {
    @State private var model: InviteModel

    init(group: CasyAPI.Group) {
        _model = State(initialValue: InviteModel(groupId: group.id, groupName: group.name))
    }

    var body: some View {
        NavigationStack {
            InviteContent(model: model, onSent: nil)
        }
    }
}

/// What an invite sheet holds, most used first (`InviteBody` on a phone): the
/// ways that need no list (contacts, email, a link, its QR code), then the
/// people from your groups, folded past a few. Its main button sends the picks.
struct InviteContent: View {
    let model: InviteModel
    /// Once the picks are sent, for a sheet that ends there (a new group, #227).
    let onSent: (() -> Void)?

    /// Folded (#227): this many show, with the rest behind Vis alle.
    private static let foldedTo = 4
    /// Past this many, a search field keeps the list usable.
    private static let filterFrom = 8

    @Environment(\.dismiss) private var dismiss
    @State private var showAll = false
    @State private var filter = ""
    @State private var copied = false
    @FocusState private var emailFocused: Bool

    var body: some View {
        @Bindable var model = model
        List {
            if let note = model.sentNote { Notice(note, tone: .success, bare: true) }
            if let error = model.sendError { Notice(error, tone: .error, bare: true) }

            Section {
                Button {
                    Task { await model.inviteFromContacts() }
                } label: {
                    HStack {
                        ListRow(CasyStrings.inviteFromContacts, systemImage: "person.crop.circle", tone: .primary)
                        if model.contactsBusy { ProgressView().controlSize(.small) }
                    }
                    .contentShape(Rectangle())
                }
                .disabled(model.contactsBusy)
                Button {
                    model.emailOpen.toggle()
                    emailFocused = model.emailOpen
                } label: {
                    ListRow(CasyStrings.inviteEmail, systemImage: "envelope").contentShape(Rectangle())
                }
                ForEach(model.emails, id: \.self) { address in
                    HStack {
                        ListRow(address, systemImage: "envelope")
                        Button {
                            model.removeEmail(address)
                        } label: {
                            Image(systemName: "xmark")
                                .foregroundStyle(Theme.mutedForeground.color)
                                .frame(minWidth: 44, minHeight: 44)
                        }
                        .buttonStyle(.borderless)
                        .accessibilityLabel(CasyStrings.inviteRemoveEmail(address))
                    }
                }
                linkRows
                if let note = model.contactsNote {
                    Notice(note.text, tone: note.ok ? .success : .error, bare: true)
                }
                if let error = model.linkError { Notice(error, tone: .error, bare: true) }
            } footer: {
                if let help = model.linkHelp { Text(help) }
            }

            if model.emailOpen {
                Section {
                    HStack(spacing: 8) {
                        TextField(CasyStrings.inviteEmailPlaceholder, text: $model.draft)
                            .keyboardType(.emailAddress)
                            .textContentType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .focused($emailFocused)
                            .submitLabel(.done)
                            .onSubmit { model.addEmail() }
                            .accessibilityLabel(CasyStrings.inviteEmail)
                        Button(CasyStrings.inviteAddEmail) { model.addEmail() }
                            .buttonStyle(.borderless)
                            .foregroundStyle(Theme.primary.color)
                            .disabled(model.draft.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                } footer: {
                    if let error = model.emailError {
                        Text(error).foregroundStyle(Theme.red600.color)
                    } else {
                        Text(CasyStrings.inviteEmailHelp)
                    }
                }
            }

            if model.showQr, let link = model.link {
                Section {
                    QrCode(text: link.url, label: CasyStrings.inviteQrLabel(model.groupName))
                } footer: {
                    Text(CasyStrings.inviteQrHelp).frame(maxWidth: .infinity)
                }
                .listRowBackground(Color.clear)
            }

            people
        }
        .navigationTitle(CasyStrings.inviteTitle(model.groupName))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button(CasyStrings.done) { dismiss() }
            }
        }
        .safeAreaInset(edge: .bottom) {
            if model.count > 0 {
                FlowButton(busy: model.sending) {
                    Task {
                        if await model.send() { onSent?() }
                    }
                } label: {
                    Text(CasyStrings.inviteSend(model.count))
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
            }
        }
        .task { await GroupsModel.shared.loadFriends() }
    }

    /// Making a link, copying and sharing it, and its QR code.
    @ViewBuilder private var linkRows: some View {
        if let link = model.link {
            Button {
                UIPasteboard.general.string = link.url
                model.linkUsed()
                copied = true
                Task {
                    try? await Task.sleep(for: .seconds(2))
                    copied = false
                }
            } label: {
                // The address gives way; Kopiér always shows in full.
                HStack(spacing: 12) {
                    Image(systemName: "link")
                        .foregroundStyle(Theme.mutedForeground.color)
                        .frame(width: 24)
                        .accessibilityHidden(true)
                    Text(link.url)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.foreground.color)
                        .lineLimit(1)
                        .truncationMode(.middle)
                    Spacer(minLength: 8)
                    HStack(spacing: 4) {
                        Image(systemName: copied ? "checkmark" : "doc.on.doc")
                        Text(copied ? CasyStrings.copied : CasyStrings.copy)
                    }
                    .font(.subheadline)
                    .foregroundStyle(Theme.primary.color)
                    .layoutPriority(1)
                }
                .contentShape(Rectangle())
            }
            if let url = URL(string: link.url) {
                ShareLink(item: url, subject: Text(model.shareTitle), message: Text(model.message)) {
                    ListRow(CasyStrings.inviteShareLink, systemImage: "square.and.arrow.up")
                        .contentShape(Rectangle())
                }
                .simultaneousGesture(TapGesture().onEnded { model.linkUsed() })
            }
        } else {
            Button {
                Task { await model.makeLink() }
            } label: {
                HStack {
                    ListRow(
                        model.makingLink ? CasyStrings.inviteMakingLink : CasyStrings.inviteMakeLink,
                        systemImage: "link")
                    if model.makingLink { ProgressView().controlSize(.small) }
                }
                .contentShape(Rectangle())
            }
            .disabled(model.makingLink)
        }
        Button {
            model.showQr.toggle()
            if model.showQr {
                model.linkUsed()
                Task { await model.makeLink() }
            }
        } label: {
            ListRow(
                model.showQr ? CasyStrings.inviteHideQr : CasyStrings.inviteShowQr,
                systemImage: "qrcode"
            )
            .contentShape(Rectangle())
        }
    }

    /// The people to tick: the first few and anyone picked, until asked for all.
    @ViewBuilder private var people: some View {
        let everyone = model.people
        if everyone.isEmpty {
            Section {
            } footer: {
                Text(
                    (GroupsModel.shared.groups?.count ?? 0) > 1
                        ? CasyStrings.inviteAllIn : CasyStrings.invitePeopleEmpty)
            }
        } else {
            let canFold = everyone.count > Self.foldedTo
            let shut = canFold && !showAll
            let needle = filter.trimmingCharacters(in: .whitespaces).lowercased()
            let matching = needle.isEmpty ? everyone : everyone.filter { $0.name.lowercased().contains(needle) }
            let shown =
                shut
                ? matching.enumerated().filter { $0.offset < Self.foldedTo || model.picked.contains($0.element.profileId) }
                    .map(\.element)
                : matching
            let invited = model.invited
            Section {
                if everyone.count > Self.filterFrom && !shut {
                    TextField(CasyStrings.inviteFilter, text: $filter)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
                ForEach(Array(shown.enumerated()), id: \.element.id) { i, person in
                    personRow(person, index: i, already: invited.contains(person.profileId))
                }
                if shown.isEmpty { Text(CasyStrings.inviteNoMatch).foregroundStyle(Theme.mutedForeground.color) }
                if canFold {
                    Button {
                        showAll.toggle()
                        filter = ""
                    } label: {
                        ListRow(
                            showAll ? CasyStrings.inviteShowFewer : CasyStrings.inviteShowAll(everyone.count),
                            tone: .primary
                        )
                        .contentShape(Rectangle())
                    }
                }
            } header: {
                Text(CasyStrings.invitePeople)
            } footer: {
                if model.count > 0 { Text(CasyStrings.inviteConsent) }
            }
        }
    }

    private func personRow(_ person: KnownPerson, index: Int, already: Bool) -> some View {
        let picked = model.picked.contains(person.profileId)
        return Button {
            model.toggle(person.profileId)
        } label: {
            ListAvatarRow(
                person.name,
                detail: person.groupNames.isEmpty
                    ? CasyStrings.inviteFromPast
                    : CasyStrings.inviteFrom(person.groupNames.joined(separator: ", ")),
                index: index, url: person.avatarUrl.flatMap(URL.init(string:))
            ) {
                if already {
                    Text(CasyStrings.inviteInvited)
                        .font(.subheadline)
                        .foregroundStyle(Theme.mutedForeground.color)
                } else {
                    Image(systemName: "checkmark")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Theme.primary.color)
                        .opacity(picked ? 1 : 0)
                        .accessibilityHidden(true)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(already)
        .accessibilityAddTraits(picked ? .isSelected : [])
    }
}

/// A link as a QR code (#150), to scan with another phone's camera.
private struct QrCode: View {
    let text: String
    let label: String

    var body: some View {
        Group {
            if let image = Self.image(text) {
                Image(uiImage: image)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
                    .padding(12)
                    .background(Color.white, in: RoundedRectangle(cornerRadius: 12))
                    .frame(width: 224, height: 224)
                    .accessibilityLabel(label)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private static func image(_ text: String) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(text.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage,
            let cg = CIContext().createCGImage(output, from: output.extent)
        else { return nil }
        return UIImage(cgImage: cg)
    }
}

/// "Ny gruppe" (#153), two steps in one sheet: the picture, the name and what
/// it is for, and Næste makes the group; then the same sheet is its Invite.
/// Sending ends it (#227), as does Færdig.
struct NewGroupSheet: View {
    private static let maxName = 60
    private static let maxDescription = 200

    private let groups = GroupsModel.shared
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var description = ""
    @State private var picture: String?
    @State private var creating = false
    @State private var failure: String?
    @State private var invite: InviteModel?
    @State private var pictureLost = false

    private var trimmedName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        NavigationStack {
            if let invite {
                InviteContent(model: invite, onSent: { dismiss() })
                    .safeAreaInset(edge: .top) {
                        if pictureLost {
                            Notice(CasyStrings.newGroupPictureLost, tone: .error, bare: true)
                                .padding(.horizontal, 16)
                        }
                    }
            } else {
                nameStep
            }
        }
        .interactiveDismissDisabled(creating)
    }

    private var nameStep: some View {
        ScrollView {
            VStack(spacing: 20) {
                PictureMenu(
                    hasPicture: picture != nil,
                    addLabel: CasyStrings.groupPictureAdd,
                    changeLabel: CasyStrings.groupPictureChange,
                    onPicked: { jpeg in
                        failure = nil
                        picture = jpeg
                    },
                    onRemove: { picture = nil },
                    onUnreadable: { failure = CasyStrings.picturesUnreadable }
                ) {
                    if let picture, let data = Data(base64Encoded: picture), let image = UIImage(data: data) {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFill()
                            .frame(width: AvatarSize.hero.rawValue, height: AvatarSize.hero.rawValue)
                            .clipShape(Circle())
                    } else {
                        Avatar(name: trimmedName, index: 0, size: .hero)
                    }
                }
                .buttonStyle(.borderless)
                .accessibilityLabel(picture == nil ? CasyStrings.groupPictureAdd : CasyStrings.groupPictureChange)
                CasyField(CasyStrings.groupNameLabel, text: $name, placeholder: CasyStrings.newGroupPlaceholder)
                    .onChange(of: name) { _, now in
                        if now.count > Self.maxName { name = String(now.prefix(Self.maxName)) }
                    }
                CasyField(
                    CasyStrings.groupDescriptionLabel, text: $description,
                    placeholder: CasyStrings.groupDescriptionPlaceholder
                )
                .onChange(of: description) { _, now in
                    if now.count > Self.maxDescription { description = String(now.prefix(Self.maxDescription)) }
                }
                if let failure { Notice(failure, tone: .error) }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 24)
        }
        .background(Theme.background.color)
        .navigationTitle(CasyStrings.newGroupTitle)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button(CasyStrings.cancel) { dismiss() }.disabled(creating)
            }
        }
        .safeAreaInset(edge: .bottom) {
            FlowButton(busy: creating, action: create) {
                Text(CasyStrings.newGroupNext)
            }
            .disabled(trimmedName.isEmpty)
            .padding(.horizontal, 16)
            .padding(.bottom, 8)
        }
    }

    private func create() {
        creating = true
        failure = nil
        let name = trimmedName
        let description = description.trimmingCharacters(in: .whitespacesAndNewlines)
        Task {
            defer { creating = false }
            do {
                let made = try await groups.create(name: name, description: description, picture: picture)
                pictureLost = made.pictureLost
                invite = InviteModel(groupId: made.id, groupName: name)
            } catch {
                failure = error.localizedDescription
            }
        }
    }
}
