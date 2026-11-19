import CasyAPI
import CasyCore
import CasyUI
import SwiftUI

/// One group (#198), pushed from Grupper: who is in it, and changing,
/// reporting, leaving or deleting it (`GroupDetails`' phone screen on the
/// web). Left, deleted or gone from elsewhere, it goes back to Grupper.
struct GroupScreen: View {
    let groupId: String

    private enum Asking { case leave, delete }

    /// The group as last seen: shown on while a sheet over it finishes (a
    /// report that left the group says thank you first).
    private struct Shown: Equatable {
        let group: CasyAPI.Group
        let index: Int
    }

    private let model = GroupsModel.shared
    @Environment(\.dismiss) private var dismiss
    @Environment(\.closeSheet) private var closeSheet
    @State private var asking: Asking?
    @State private var removing = false
    @State private var failure: String?
    @State private var editing = false
    @State private var reporting = false
    @State private var inviting = false
    @State private var aboutMembers = false
    /// The switch moves at once while the choice is saved (as the web's).
    @State private var primeSaving: Bool?
    @State private var primeFailure: String?
    @State private var kept: Shown?

    /// Stars are only drawn for groups of four or more (`MIN_GROUP_SIZE`, #171).
    private static let primeMinimum = 4

    private var found: Shown? {
        model.indexed(groupId).map { Shown(group: $0.group, index: $0.index) }
    }

    var body: some View {
        ZStack {
            if let shown = found ?? kept { content(shown.group, index: shown.index) }
        }
        // Left or deleted, here or on another phone: back to the list, once
        // no sheet is open over it.
        .onChange(of: found, initial: true) { _, now in
            if let now { kept = now } else { goBackIfGone() }
        }
        .onChange(of: reporting || editing || inviting) { _, open in
            if !open { goBackIfGone() }
        }
    }

    private func goBackIfGone() {
        if found == nil, !reporting, !editing, !inviting { dismiss() }
    }

    private func content(_ group: CasyAPI.Group, index: Int) -> some View {
        let sole = group.members.count <= 1
        // The same rule as Grupper's swipe, so the two never offer different things.
        let canDelete = model.swipe(for: group) == .deleteForAll
        // GroupDetails' phone screen (#281): its ListGroups under the centred
        // heading, px-4 as the sheet's, pb-4 at the end.
        return ScrollView {
            VStack(spacing: 0) {
                header(group, index: index)

                CardList(CasyStrings.groupMembers, accessory: AnyView(membersHelp)) {
                    ForEach(Array(group.members.enumerated()), id: \.element.id) { i, member in
                        CardRow(member.isYou ? CasyStrings.groupWithYou(member.name) : member.name) {
                            Avatar(
                                name: member.name, index: i, size: .row,
                                url: member.avatarUrl.flatMap(URL.init(string:)))
                        }
                    }
                    Button {
                        inviting = true
                    } label: {
                        CardRow(CasyStrings.groupInvitePeople, icon: "plus", tone: .primary)
                    }
                    .buttonStyle(.cardRow)
                }

                CardList {
                    Button {
                        editing = true
                    } label: {
                        CardRow(CasyStrings.groupEdit, icon: "pencil")
                    }
                    .buttonStyle(.cardRow)
                }

                // Stars are the home page's (#171), only for groups of four or more.
                if group.members.count >= Self.primeMinimum {
                    CardList(footnote: primeFailure ?? CasyStrings.groupPrimeFootnote) {
                        CardRow(CasyStrings.groupPrimeTitle, icon: "calendar-heart") {
                            Toggle(
                                CasyStrings.groupPrimeTitle,
                                isOn: Binding(
                                    get: { primeSaving ?? (group.primeDates != false) },
                                    set: { setPrime(group, on: $0) })
                            )
                            .labelsHidden()
                            .tint(Theme.primary.color)
                            .disabled(primeSaving != nil)
                        }
                    }
                }

                CardList {
                    // Report or block (#142): only once there is someone else to report.
                    if !sole {
                        Button {
                            reporting = true
                        } label: {
                            CardRow(CasyStrings.reportOrBlock, icon: "flag")
                        }
                        .buttonStyle(.cardRow)
                    }
                    Button {
                        asking = .leave
                    } label: {
                        CardRow(
                            sole ? CasyStrings.groupDeleteGroup : CasyStrings.groupLeave,
                            icon: sole ? "trash" : "log-out", tone: .danger)
                    }
                    .buttonStyle(.cardRow)
                    if canDelete {
                        Button {
                            asking = .delete
                        } label: {
                            CardRow(CasyStrings.groupDeleteForAll, icon: "trash", tone: .danger)
                        }
                        .buttonStyle(.cardRow)
                    }
                }
                .disabled(removing)
                if let failure {
                    Notice(failure, tone: .error, bare: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 12)
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 16)
        }
        .accessibilityIdentifier("group.screen")
        .casyPushedBar(group.name, close: CasyStrings.done, action: closeSheet)
        .askFirst(
            isPresented: isAsking, presenting: asking,
            words: { asked in
                AskWords(
                    message: question(group, sole: sole),
                    confirm: asked == .delete || sole ? CasyStrings.groupDeleteGroup : CasyStrings.groupLeave)
            }
        ) { asked in
            // `asked`, not `asking`: the sheet lets go of `asking` before it runs.
            remove(group, forAll: asked == .delete)
        }
        .sheet(isPresented: $editing) {
            EditGroupSheet(group: group, index: index)
                .nativeSheetLook(NativePreferences.shared)
        }
        .sheet(isPresented: $inviting) {
            InviteSheet(group: group)
                .nativeSheetLook(NativePreferences.shared)
        }
        .sheet(isPresented: $reporting) {
            ReportSheet(group: group)
                .nativeSheetLook(NativePreferences.shared)
        }
    }

    /// The picture, the name, how big and how old, and what it is for: mt-2,
    /// centred; the picture 96 (its letter 32); the name mt-3, 20 bold (its
    /// line 28), wrapping; the facts 14 muted (20); the description mt-1,
    /// 15 in the text's colour (22.5).
    private func header(_ group: CasyAPI.Group, index: Int) -> some View {
        VStack(spacing: 0) {
            Avatar(
                name: group.name, index: index, size: .extraLarge,
                url: group.pictureUrl.flatMap(URL.init(string:)))
            Text(group.name)
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(Theme.foreground.color)
                .cssLineHeight(28, size: 20)
                .padding(.top, 12)
            Text(facts(group))
                .font(.system(size: 14))
                .foregroundStyle(Theme.mutedForeground.color)
                .cssLineHeight(20, size: 14)
            if let description = group.description, !description.isEmpty {
                Text(description)
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.foreground.color)
                    .cssLineHeight(22.5, size: 15)
                    .padding(.top, 4)
            }
        }
        .multilineTextAlignment(.center)
        .fixedSize(horizontal: false, vertical: true)
        .frame(maxWidth: .infinity)
        .padding(.top, 8)
    }

    /// "4 medlemmer · lavet sep. 2026".
    private func facts(_ group: CasyAPI.Group) -> String {
        let members = CasyStrings.members(group.members.count)
        guard let made = parseInstant(group.createdAt) else { return members }
        let lang: Lang = CasyStrings.language == "en" ? .en : .da
        return "\(members) · \(CasyStrings.groupMade(monthYear(made, lang)))"
    }

    /// Medlemmer's ? (HelpButton): a 20 point circle-help in orange, a 44
    /// point touch area that moves nothing; what members see of each other
    /// in the system's popover.
    private var membersHelp: some View {
        HStack(spacing: 0) {
            Button {
                aboutMembers = true
            } label: {
                LucideIcon("circle-question-mark", size: 20)
                    .foregroundStyle(Theme.primary.color)
                    .frame(width: 20, height: 20)
                    .contentShape(Rectangle().inset(by: -12))
            }
            .buttonStyle(.borderless)
            .accessibilityLabel(CasyStrings.groupWhatMembersSee)
            .popover(isPresented: $aboutMembers) {
                Text(CasyStrings.groupWhatMembersSeeBody)
                    .font(.subheadline)
                    .foregroundStyle(Theme.foreground.color)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .textCase(nil)
                    .padding(20)
                    .frame(idealWidth: 320)
                    .presentationCompactAdaptation(.popover)
            }
        }
    }

    private var isAsking: Binding<Bool> {
        Binding(get: { asking != nil }, set: { if !$0 { asking = nil } })
    }

    private func question(_ group: CasyAPI.Group, sole: Bool) -> String {
        if asking == .delete { return CasyStrings.groupsDeleteConfirm(group.name, members: group.members.count) }
        return sole ? CasyStrings.groupLeaveSole(group.name) : CasyStrings.groupLeaveConfirm(group.name)
    }

    private func remove(_ group: CasyAPI.Group, forAll: Bool) {
        removing = true
        failure = nil
        Task {
            defer { removing = false }
            do {
                // Gone from the list: the screen goes back by itself.
                try await model.remove(group, forAll: forAll)
            } catch {
                failure = error.localizedDescription
            }
        }
    }

    private func setPrime(_ group: CasyAPI.Group, on: Bool) {
        primeSaving = on
        primeFailure = nil
        Task {
            defer { primeSaving = nil }
            do {
                try await model.setPrimeDates(group, on: on)
            } catch {
                primeFailure = error.localizedDescription
            }
        }
    }
}

/// A group's picture, name and description in one sheet (#227), as the web's
/// EditGroupSheet: any member may change them, and only what changed is saved.
struct EditGroupSheet: View {
    let group: CasyAPI.Group
    let index: Int

    private static let maxName = 60
    private static let maxDescription = 200

    private let model = GroupsModel.shared
    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var description: String
    @State private var picture = PictureChange.keep
    @State private var saving = false
    @State private var failure: String?

    init(group: CasyAPI.Group, index: Int) {
        self.group = group
        self.index = index
        _name = State(initialValue: group.name)
        _description = State(initialValue: group.description ?? "")
    }

    private var trimmedName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }

    private var hasPicture: Bool {
        switch picture {
        case .keep: group.pictureUrl != nil
        case .set: true
        case .remove: false
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    PictureMenu(
                        hasPicture: hasPicture,
                        addLabel: CasyStrings.groupPictureAdd,
                        changeLabel: CasyStrings.groupPictureChange,
                        onPicked: { jpeg in
                            failure = nil
                            picture = .set(jpeg)
                        },
                        onRemove: { picture = .remove },
                        onUnreadable: { failure = CasyStrings.picturesUnreadable }
                    ) {
                        shownPicture
                    }
                    .buttonStyle(.borderless)
                    .accessibilityLabel(hasPicture ? CasyStrings.groupPictureChange : CasyStrings.groupPictureAdd)
                    CasyField(CasyStrings.groupNameLabel, text: $name)
                        .onChange(of: name) { _, now in
                            if now.count > Self.maxName { name = String(now.prefix(Self.maxName)) }
                        }
                    CasyField(
                        CasyStrings.groupDescriptionLabel, text: $description,
                        placeholder: CasyStrings.groupDescriptionPlaceholder
                    )
                    .onChange(of: description) { _, now in
                        if now.count > Self.maxDescription {
                            description = String(now.prefix(Self.maxDescription))
                        }
                    }
                    if let failure { Notice(failure, tone: .error) }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 24)
            }
            .background(Theme.background.color)
            .casySheetBar(CasyStrings.groupEdit, close: CasyStrings.cancel, disabled: saving) {
                dismiss()
            }
            .safeAreaInset(edge: .bottom) {
                FlowButton(busy: saving, action: save) {
                    Text(CasyStrings.save)
                }
                .disabled(trimmedName.isEmpty)
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
            }
        }
        .interactiveDismissDisabled(saving)
    }

    /// The new picture before it is saved, else the group's or its letter.
    @ViewBuilder private var shownPicture: some View {
        if case .set(let jpeg) = picture, let data = Data(base64Encoded: jpeg),
            let image = UIImage(data: data)
        {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
                .frame(width: AvatarSize.hero.rawValue, height: AvatarSize.hero.rawValue)
                .clipShape(Circle())
        } else {
            Avatar(
                name: trimmedName.isEmpty ? group.name : trimmedName, index: index, size: .hero,
                url: picture == .remove ? nil : group.pictureUrl.flatMap(URL.init(string:)))
        }
    }

    private func save() {
        saving = true
        failure = nil
        let description = description.trimmingCharacters(in: .whitespacesAndNewlines)
        Task {
            defer { saving = false }
            do {
                try await model.save(group, name: trimmedName, description: description, picture: picture)
                dismiss()
            } catch {
                failure = error.localizedDescription
            }
        }
    }
}

/// Reporting something in a group to us (#142, App Store guideline 1.2), as
/// the web's ReportDialog: the group or a member, why, and a note; a member
/// can be blocked with it, and the group left. Whoever is reported isn't told.
struct ReportSheet: View {
    /// The group a report is about, with its members to choose from and to leave; nil for an event.
    private let group: CasyAPI.Group?
    private let choices: [Choice]

    /// A group, or one of its members (#142).
    init(group: CasyAPI.Group) {
        self.group = group
        choices =
            [Choice(label: CasyStrings.reportTargetGroup(group.name), target: .group(groupId: group.id), person: nil)]
            + group.members.filter { !$0.isYou }.map {
                Choice(label: $0.name, target: .member(groupId: group.id, memberId: $0.profileId), person: $0)
            }
    }

    /// Someone else's event: only the event itself, as the web's ReportEventButton.
    init(event: SuggestedEvent) {
        group = nil
        choices = [
            Choice(
                label: CasyStrings.reportTargetEvent(CasyStrings.eventTitle(event.title)),
                target: .event(groupId: event.group.id, eventId: event.id), person: nil)
        ]
    }

    private struct Choice {
        let label: String
        let target: ReportTarget
        /// A member, who can be blocked too.
        let person: GroupMember?
    }

    private static let reasons = ["spam", "offensive", "harassment", "other"]
    private static let maxNote = 500

    private let model = GroupsModel.shared
    @Environment(\.dismiss) private var dismiss
    @State private var picked = 0
    @State private var reason: String?
    @State private var note = ""
    @State private var block = false
    @State private var leaveToo = false
    @State private var sending = false
    @State private var sent = false
    @State private var failure: String?

    var body: some View {
        let choice = choices[min(picked, choices.count - 1)]
        return NavigationStack {
            List {
                if sent {
                    Notice(CasyStrings.reportSent, tone: .success, bare: true)
                } else {
                    form(choice)
                }
            }
            .casySheetBar(
                CasyStrings.reportTitle, close: sent ? CasyStrings.close : CasyStrings.cancel,
                disabled: sending
            ) {
                dismiss()
            }
            .safeAreaInset(edge: .bottom) {
                if !sent {
                    FlowButton(busy: sending) {
                        send(choice)
                    } label: {
                        Text(CasyStrings.reportSend)
                    }
                    .disabled(reason == nil)
                    .padding(.horizontal, 16)
                    .padding(.bottom, 8)
                }
            }
        }
        .interactiveDismissDisabled(sending)
    }

    @ViewBuilder private func form(_ choice: Choice) -> some View {
        if choices.count > 1 {
            Section(CasyStrings.reportWhat) {
                ForEach(Array(choices.enumerated()), id: \.offset) { i, option in
                    ListPickRow(option.label, isSelected: picked == i) {
                        picked = i
                        block = false
                    }
                }
            }
        }
        Section(CasyStrings.reportWhy) {
            ForEach(Self.reasons, id: \.self) { option in
                ListPickRow(CasyStrings.reportReason(option), isSelected: reason == option) {
                    reason = option
                }
            }
        }
        Section(CasyStrings.reportNote) {
            TextField("", text: $note, axis: .vertical)
                .lineLimit(3...6)
                .accessibilityLabel(CasyStrings.reportNote)
                .onChange(of: note) { _, now in
                    if now.count > Self.maxNote { note = String(now.prefix(Self.maxNote)) }
                }
        }
        // The promise that whoever is reported isn't told, always (rule 7).
        Section {
            if let person = choice.person {
                ListSwitchRow(
                    CasyStrings.reportBlockToo(person.name), isOn: $block, systemImage: "nosign",
                    detail: CasyStrings.reportBlockHelp(person.name))
            }
            if let group {
                ListSwitchRow(
                    CasyStrings.reportLeaveToo(group.name), isOn: $leaveToo,
                    systemImage: "rectangle.portrait.and.arrow.right")
            }
        } footer: {
            Text(CasyStrings.reportIntro)
        }
        if let failure { Notice(failure, tone: .error, bare: true) }
    }

    private func send(_ choice: Choice) {
        guard let reason else { return }
        sending = true
        failure = nil
        Task {
            defer { sending = false }
            do {
                try await model.report(
                    choice.target, reason: reason, note: note,
                    block: block ? choice.person?.profileId : nil, leave: leaveToo ? group : nil)
                // Left the group: its screen goes back by itself once the sheet closes.
                sent = true
            } catch {
                failure = error.localizedDescription
            }
        }
    }
}
