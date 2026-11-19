import CasyAPI
import CasyCore
import CasyUI
import CoreImage.CIFilterBuiltins
import SwiftUI

/// One round of inviting to a group (#153), as the web's useInvite: the people
/// ticked and the emails added, a link once asked for, and what was sent. Or
/// of adding a friend (#226, `forFriend`), which is only the contacts and a
/// link. A new one each time the sheet opens.
@MainActor @Observable
final class InviteModel {
    /// The group invited to; nil for a friend link.
    let groupId: String?
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

    private init() {
        groupId = nil
        groupName = ""
    }

    /// Tilføj en ven (#226): a link anyone can open to become your friend.
    static func forFriend() -> InviteModel { InviteModel() }

    var isFriend: Bool { groupId == nil }
    var count: Int { picked.count + emails.count }
    var people: [KnownPerson] { groupId.map { groups.people(for: $0) } ?? [] }
    var invited: Set<String> { Set(groupId.flatMap { groups.indexed($0)?.group.invited } ?? []) }
    var title: String { isFriend ? CasyStrings.friendLinkAdd : CasyStrings.inviteTitle(groupName) }
    var message: String { isFriend ? CasyStrings.friendLinkMessage : CasyStrings.inviteMessage(groupName) }
    var shareTitle: String {
        isFriend ? CasyStrings.friendLinkShareTitle : CasyStrings.inviteShareTitle(groupName)
    }
    var qrLabel: String { isFriend ? CasyStrings.friendLinkShareTitle : CasyStrings.inviteQrLabel(groupName) }
    var qrHelp: String { isFriend ? CasyStrings.friendLinkQrHelp : CasyStrings.inviteQrHelp }

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
        guard count > 0, let groupId else { return false }
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
            let made: InviteLink
            if let groupId {
                made = try await groups.makeLink(groupId)
            } else {
                made = try await groups.makeFriendLink()
            }
            link = made
            return made
        } catch {
            linkError = error.localizedDescription
            return nil
        }
    }

    /// The link was copied, shared or its QR code shown: someone is probably being invited.
    func linkUsed() {
        if let groupId { groups.inviteSent(groupId) }
    }

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
        // The app's clock: a UI test's fixed moment, as the backend's link was made at.
        let now = Native.now
        let left: String
        switch linkLife(expiresAt: expires, now: now) {
        case .expired: left = CasyStrings.inviteExpired
        case .days(let n): left = CasyStrings.inviteExpiry(days: n, hours: nil)
        case .hours(let n): left = CasyStrings.inviteExpiry(days: nil, hours: n)
        case .underAnHour: left = CasyStrings.inviteExpiry(days: nil, hours: nil)
        }
        return isFriend ? CasyStrings.friendLinkHelp(left) : CasyStrings.inviteLinkHelp(left)
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

/// What an invite sheet holds, the web's InviteBody on a phone (#227, #281):
/// one list of the ways that need no list (the contacts, email and the
/// addresses added, the link, copying and sharing it, its QR code), the email
/// field under it once opened, the link's lifetime, the QR code, then the
/// people from your groups to tick, folded past four. Its main button sends
/// the picks. Adding a friend (#226) is the contacts and the link alone. As
/// tall as what is in it, in iOS's glass.
struct InviteContent: View {
    let model: InviteModel
    /// Once the picks are sent, for a sheet that ends there (a new group, #227).
    let onSent: (() -> Void)?
    /// Over the rest: a new group's picture that didn't come along.
    var note: String?

    /// Folded (#227): this many show, with the rest behind Vis alle.
    private static let foldedTo = 4
    /// Past this many, a search field keeps the list usable.
    private static let filterFrom = 8

    @Environment(\.dismiss) private var dismiss
    @State private var showAll = false
    @State private var filter = ""
    @State private var copied = false
    @State private var contentHeight: CGFloat = 300

    var body: some View {
        @Bindable var model = model
        // The send button under the list, not over it (the web's footer row).
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    if let note { Notice(note, tone: .error, bare: true).padding(.bottom, 12) }
                    if let sent = model.sentNote { Notice(sent, tone: .success).padding(.bottom, 16) }
                    if let error = model.sendError { Notice(error, tone: .error).padding(.bottom, 16) }

                    CardList(spaced: false) {
                        contactsRow
                        if !model.isFriend { emailRows }
                        linkRows
                    }
                    if let contacts = model.contactsNote {
                        Notice(contacts.text, tone: contacts.ok ? .success : .error).padding(.top, 8)
                    }
                    if model.emailOpen { emailField }
                    if let help = model.linkHelp { footnote(help).padding(.horizontal, 16).padding(.top, 6) }
                    if model.showQr, let link = model.link {
                        VStack(spacing: 8) {
                            QrCode(text: link.url, label: model.qrLabel)
                            Text(model.qrHelp)
                                .font(.system(size: 12))
                                .foregroundStyle(Theme.mutedForeground.color)
                                .cssLineHeight(16, size: 12)
                                .multilineTextAlignment(.center)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.top, 12)
                    }
                    if let error = model.linkError { Notice(error, tone: .error, bare: true).padding(.top, 8) }
                    if !model.isFriend { people }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { contentHeight = $0 }
            }
            .scrollBounceBehavior(.basedOnSize)
            .accessibilityIdentifier(model.isFriend ? "addFriend.screen" : "invite.screen")
            if model.count > 0 {
                FlowButton(busy: model.sending) {
                    Task {
                        if await model.send() { onSent?() }
                    }
                } label: {
                    Text(CasyStrings.inviteSend(model.count))
                }
                .padding(.horizontal, 16)
                .padding(.top, 12)
                .padding(.bottom, 8)
            }
        }
        .casySheetBar(model.title, close: CasyStrings.done) { dismiss() }
        // Without its button, the bar alone over the words.
        .sheetFits(contentHeight, chrome: model.count > 0 ? 150 : 90)
        .task { await GroupsModel.shared.loadFriends() }
    }

    private func footnote(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 12))
            .foregroundStyle(Theme.mutedForeground.color)
            .cssLineHeight(16, size: 12)
            .fixedSize(horizontal: false, vertical: true)
    }

    /// The contacts, then Messages with the link (the share sheet on a phone that can't text).
    private var contactsRow: some View {
        Button {
            Task { await model.inviteFromContacts() }
        } label: {
            CardRow(CasyStrings.inviteFromContacts, icon: "book-user", tone: .primary) {
                if model.contactsBusy { ProgressView().controlSize(.small) }
            }
        }
        .buttonStyle(.cardRow)
        .disabled(model.contactsBusy)
    }

    /// Med e-mail, opening its field, and each address added with its x.
    @ViewBuilder private var emailRows: some View {
        Button {
            model.emailOpen.toggle()
        } label: {
            CardRow(CasyStrings.inviteEmail, expanded: model.emailOpen) { CardRowIcon("mail") }
        }
        .buttonStyle(.cardRow)
        ForEach(model.emails, id: \.self) { address in
            CardRow(address, icon: "mail") {
                Button {
                    model.removeEmail(address)
                } label: {
                    LucideIcon("x", size: 16)
                        .foregroundStyle(Theme.mutedForeground.color)
                        .frame(width: 36, height: 36)
                        .contentShape(Circle())
                }
                .buttonStyle(.plain)
                .padding(.trailing, -8)
                .accessibilityLabel(CasyStrings.inviteRemoveEmail(address))
            }
        }
    }

    /// EmailField: the field and Tilføj side by side, 12 under the list, the
    /// error and the help under them.
    @ViewBuilder private var emailField: some View {
        @Bindable var model = model
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                CasyField(
                    nil, text: $model.draft, placeholder: CasyStrings.inviteEmailPlaceholder,
                    accessibilityLabel: CasyStrings.inviteEmail, autofocus: true
                )
                .keyboardType(.emailAddress)
                .textContentType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.done)
                .onSubmit { model.addEmail() }
                GlassButton(icon: "plus", size: .small) {
                    model.addEmail()
                } label: {
                    Text(CasyStrings.inviteAddEmail)
                }
                .disabled(model.draft.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            if let error = model.emailError {
                Text(error)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.red700.color)
                    .padding(.horizontal, 4)
            }
            footnote(CasyStrings.inviteEmailHelp).padding(.horizontal, 16)
        }
        .padding(.top, 12)
    }

    /// LinkRows: making a link, then copying it and sharing it, and its QR code.
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
                CardRow(link.url, icon: "link-2") {
                    HStack(spacing: 4) {
                        LucideIcon(copied ? "check" : "copy", size: 16)
                        Text(copied ? CasyStrings.copied : CasyStrings.copy)
                            .font(.system(size: 14))
                    }
                    .foregroundStyle(Theme.primary.color)
                    .fixedSize()
                }
            }
            .buttonStyle(.cardRow)
            if let url = URL(string: link.url) {
                ShareLink(item: url, subject: Text(model.shareTitle), message: Text(model.message)) {
                    CardRow(CasyStrings.inviteShareLink, icon: "share")
                }
                .buttonStyle(.cardRow)
                .simultaneousGesture(TapGesture().onEnded { model.linkUsed() })
            }
        } else {
            Button {
                Task { await model.makeLink() }
            } label: {
                CardRow(
                    model.makingLink ? CasyStrings.inviteMakingLink : CasyStrings.inviteMakeLink,
                    icon: "link-2"
                ) {
                    if model.makingLink { ProgressView().controlSize(.small) }
                }
            }
            .buttonStyle(.cardRow)
            .disabled(model.makingLink)
        }
        Button {
            model.showQr.toggle()
            if model.showQr {
                model.linkUsed()
                Task { await model.makeLink() }
            }
        } label: {
            CardRow(
                model.showQr ? CasyStrings.inviteHideQr : CasyStrings.inviteShowQr, expanded: model.showQr
            ) { CardRowIcon("qr-code") }
        }
        .buttonStyle(.cardRow)
    }

    /// PeopleList, folded: the first few and anyone picked, until asked for all.
    @ViewBuilder private var people: some View {
        let everyone = model.people
        if everyone.isEmpty {
            footnote(
                (GroupsModel.shared.groups?.count ?? 0) > 1
                    ? CasyStrings.inviteAllIn : CasyStrings.invitePeopleEmpty
            )
            .padding(.horizontal, 16)
            .padding(.top, 24)
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
            let searchable = everyone.count > Self.filterFrom && !shut
            let invited = model.invited
            if searchable {
                CasyField(nil, text: $filter, placeholder: CasyStrings.inviteFilter)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .padding(.top, 24)
            }
            CardList(
                CasyStrings.invitePeople, footnote: model.count > 0 ? CasyStrings.inviteConsent : nil,
                spaced: false
            ) {
                ForEach(Array(shown.enumerated()), id: \.element.id) { i, person in
                    PickRow(
                        label: person.name,
                        detail: person.groupNames.isEmpty
                            ? CasyStrings.inviteFromPast
                            : CasyStrings.inviteFrom(person.groupNames.joined(separator: ", ")),
                        picked: model.picked.contains(person.profileId),
                        value: invited.contains(person.profileId) ? CasyStrings.inviteInvited : nil,
                        action: { model.toggle(person.profileId) }
                    ) {
                        Avatar(
                            name: person.name, index: i, size: .row,
                            url: person.avatarUrl.flatMap(URL.init(string:)))
                    }
                }
                if shown.isEmpty { CardRow(CasyStrings.inviteNoMatch) }
                if canFold {
                    Button {
                        showAll.toggle()
                        filter = ""
                    } label: {
                        CardRow(
                            showAll ? CasyStrings.inviteShowFewer : CasyStrings.inviteShowAll(everyone.count),
                            tone: .primary, expanded: showAll)
                    }
                    .buttonStyle(.cardRow)
                }
            }
            .padding(.top, searchable ? 12 : 24)
        }
    }
}

/// A link as a QR code (#150), to scan with another phone's camera.
private struct QrCode: View {
    let text: String
    let label: String

    var body: some View {
        Group {
            if let image = Self.image(for: text) {
                // The web's QrCode: 224 (h-56), rounded-xl, black on white with
                // the standard four modules of white around; Core Image draws
                // one, so three more of the same size go around it.
                let modules = image.size.width + 6
                Image(uiImage: image)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
                    .padding(224 * 3 / modules)
                    .frame(width: 224, height: 224)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .accessibilityLabel(label)
            }
        }
        .frame(maxWidth: .infinity)
    }

    /// Drawn once per link: the sheet redraws on every keystroke and tick.
    private static let context = CIContext()
    private static var drawn: (text: String, image: UIImage)?

    private static func image(for text: String) -> UIImage? {
        if let drawn, drawn.text == text { return drawn.image }
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(text.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage,
            let cg = context.createCGImage(output, from: output.extent)
        else { return nil }
        let image = UIImage(cgImage: cg)
        drawn = (text, image)
        return image
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
    @State private var contentHeight: CGFloat = 380

    private var trimmedName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        NavigationStack {
            if let invite {
                InviteContent(
                    model: invite, onSent: { dismiss() },
                    note: pictureLost ? CasyStrings.newGroupPictureLost : nil)
            } else {
                nameStep
            }
        }
        .interactiveDismissDisabled(creating)
    }

    /// The web's name step on a phone: the picture (112, the name's letter
    /// on bg-secondary, 40 point, the camera badge) 20 above the fields, Fjern
    /// billede under it once there is one; Gruppenavn (semibold) and what the
    /// group is for, 16 apart; Næste along the bottom.
    private var nameStep: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                VStack(spacing: 0) {
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
                        Group {
                            if let picture, let data = Data(base64Encoded: picture), let image = UIImage(data: data) {
                                Image(uiImage: image)
                                    .resizable()
                                    .scaledToFill()
                            } else {
                                ZStack {
                                    Circle().fill(Theme.secondary.color)
                                    Text(avatarLetter(trimmedName))
                                        .font(.system(size: 40, weight: .semibold))
                                        .foregroundStyle(Theme.foreground.color)
                                }
                            }
                        }
                        .frame(width: AvatarSize.hero.rawValue, height: AvatarSize.hero.rawValue)
                        .clipShape(Circle())
                        .cameraBadge()
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(picture == nil ? CasyStrings.groupPictureAdd : CasyStrings.groupPictureChange)
                    if picture != nil {
                        Button(CasyStrings.picturesRemove) { picture = nil }
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Theme.primary.color)
                            .frame(minHeight: 44)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.bottom, 20)
                CasyField(
                    CasyStrings.groupNameLabel, text: $name, placeholder: CasyStrings.newGroupPlaceholder,
                    weight: .semibold
                )
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
                .padding(.top, 16)
                if let failure { Notice(failure, tone: .error).padding(.top, 12) }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 16)
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { contentHeight = $0 }
        }
        .scrollBounceBehavior(.basedOnSize)
        .accessibilityIdentifier("newGroup.screen")
        .casySheetBar(CasyStrings.newGroupTitle, close: CasyStrings.cancel, disabled: creating) {
            dismiss()
        }
        .safeAreaInset(edge: .bottom) {
            FlowButton(busy: creating, action: create) {
                Text(CasyStrings.newGroupNext)
            }
            .disabled(trimmedName.isEmpty)
            .padding(.horizontal, 16)
            .padding(.bottom, 8)
        }
        .sheetFits(contentHeight)
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
