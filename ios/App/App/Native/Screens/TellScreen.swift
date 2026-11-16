import CasyAPI
import CasyCore
import CasyUI
import SwiftUI

/// Tilføj til kalender opened by itself (#116, #193, #200; Tell Casy in the
/// code), from the plus at the top of My calendar.
struct TellSheet: View {
    let preferences: NativePreferences
    let onDone: () -> Void
    let leave: (LeavingProfile) -> Void

    var body: some View {
        NavigationStack {
            TellScreen(leave: leave)
        }
        .environment(\.closeSheet, onDone)
        .nativeSheetLook(preferences)
    }
}

/// Say or write when you are away or busy and it is in no calendar, check what
/// we made of it, and keep it. Kept, the sheet closes and the month glides to
/// the first day added (`LeavingProfile.added`). What is kept already is listed
/// under, each with a delete: it counts in every search until then.
struct TellScreen: View {
    let leave: (LeavingProfile) -> Void

    private let calendars = CalendarsModel.shared
    @Environment(\.closeSheet) private var closeSheet
    @Environment(\.growSheet) private var growSheet
    /// What has been written, oldest first.
    @State private var texts: [String] = []
    /// The proposal: the whole list as it stands.
    @State private var entries: [CasyEntry] = []
    @State private var message: String?
    @State private var left: Int?
    @State private var pending = false
    @State private var failure: String?
    /// What was sent when the answer failed, back in the box to fix and send again.
    @State private var failedText = ""
    @State private var adding = false
    @State private var saving = false
    @State private var saveFailure: String?
    @State private var deleting: String?
    @State private var deleteFailure: String?
    @State private var asking: (() -> Void)?

    /// What the server takes as earlier descriptions, at most.
    private static let maxEarlier = 4

    private var started: Bool { !texts.isEmpty }
    /// Our reading on screen, waiting to be kept: the sheet's main button.
    private var proposing: Bool { started && !entries.isEmpty && !pending && !adding }
    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    var body: some View {
        List {
            if !started {
                if pending {
                    thinking
                } else {
                    Composer(
                        initial: failedText, big: true, placeholder: CasyStrings.tellPlaceholder,
                        sendLabel: CasyStrings.tellSend, send: describe)
                        .id("first-\(failedText)")
                        .plainRow()
                }
            } else {
                if !entries.isEmpty {
                    Section(CasyStrings.tellUnderstood) {
                        ForEach(Array(entries.enumerated()), id: \.offset) { i, entry in
                            EntryRow(entry: entry, lang: lang) {
                                Button {
                                    entries.remove(at: i)
                                } label: {
                                    Image(systemName: "xmark")
                                        .font(.footnote.weight(.semibold))
                                        .foregroundStyle(Theme.mutedForeground.color)
                                        .frame(width: 36, height: 36)
                                        .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                                .disabled(pending || saving)
                                .accessibilityLabel(CasyStrings.tellLeaveOut(entry.label))
                            }
                        }
                    }
                } else if message == nil {
                    Text(CasyStrings.tellNothingFound)
                        .font(.subheadline)
                        .foregroundStyle(Theme.mutedForeground.color)
                        .plainRow()
                }
                if let message { Notice(message, tone: .info).plainRow() }
                if pending {
                    thinking
                } else if adding || entries.isEmpty {
                    Composer(
                        initial: failedText, big: false, placeholder: CasyStrings.tellMorePlaceholder,
                        sendLabel: CasyStrings.tellUpdate,
                        send: { text in
                            describe(text)
                            adding = false
                        },
                        cancel: entries.isEmpty ? nil : { adding = false }
                    )
                    .id("more-\(failedText)")
                    .plainRow()
                } else {
                    HStack(spacing: 8) {
                        GlassButton(systemImage: "text.bubble", size: .small, action: { adding = true }) {
                            Text(CasyStrings.tellAddDetails)
                        }
                        GlassButton(systemImage: "arrow.counterclockwise", size: .small, action: startOver) {
                            Text(CasyStrings.tellAgain)
                        }
                    }
                    .disabled(saving)
                    .plainRow()
                }
            }
            if let failure { Notice(failure, tone: .error).plainRow() }
            if let saveFailure { Notice(saveFailure, tone: .error).plainRow() }
            if let left {
                Text(CasyStrings.aiLeft(left) + ".")
                    .font(.caption)
                    .foregroundStyle(Theme.mutedForeground.color)
                    .plainRow()
            }
            let kept = calendars.data?.entries ?? []
            if !kept.isEmpty {
                Section {
                    ForEach(kept, id: \.id) { stored in
                        EntryRow(entry: stored.entry, lang: lang) {
                            Button {
                                delete(stored.id)
                            } label: {
                                Group {
                                    if deleting == stored.id {
                                        ProgressView().controlSize(.small)
                                    } else {
                                        Image(systemName: "trash")
                                    }
                                }
                                .font(.footnote)
                                .foregroundStyle(Theme.mutedForeground.color)
                                .frame(width: 36, height: 36)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .disabled(deleting != nil)
                            .accessibilityLabel(CasyStrings.tellRemove(stored.label))
                        }
                    }
                } header: {
                    Text(CasyStrings.tellKept)
                } footer: {
                    VStack(alignment: .leading, spacing: 6) {
                        if let deleteFailure { Notice(deleteFailure, tone: .error, bare: true) }
                        Text(CasyStrings.tellKeptNote)
                    }
                }
            }
        }
        .casySheetBar(CasyStrings.tellTitle, close: CasyStrings.tellDone, action: closeSheet)
        // What we made of it needs the room.
        .onChange(of: started) { _, now in if now { growSheet() } }
        .safeAreaInset(edge: .bottom) {
            if proposing {
                FlowButton(busy: saving, action: save) {
                    Text(saving ? CasyStrings.tellSaving : CasyStrings.tellSave(entries.count))
                }
                .accessibilityIdentifier("tell.save")
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
            }
        }
        .aiConsentGate($asking, leave: leave)
        .pageLinks(leave: leave)
        .task { if calendars.data == nil { await calendars.load() } }
    }

    private var thinking: some View {
        HStack(spacing: 8) {
            ProgressView().controlSize(.small)
            Text(CasyStrings.tellThinking)
                .font(.subheadline)
                .foregroundStyle(Theme.mutedForeground.color)
        }
        .plainRow()
    }

    /// A first description, or more details on the proposal so far; asked
    /// first for the yes to the AI if it is missing.
    private func describe(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !pending else { return }
        asking = { ask(trimmed) }
    }

    private func ask(_ text: String) {
        pending = true
        failure = nil
        failedText = ""
        Task {
            defer { pending = false }
            do {
                guard let api = await Native.api() else { throw APIError.failed(status: 401, message: CasyStrings.tellFailed) }
                let proposal = try await api.proposeEntries(
                    text: text, earlier: Array(texts.suffix(Self.maxEarlier)),
                    current: entries.isEmpty ? nil : entries, errorMessage: CasyStrings.tellFailed)
                texts.append(text)
                entries = proposal.entries
                message = proposal.message
                left = proposal.left
            } catch {
                failure = error.localizedDescription
                failedText = text
            }
        }
    }

    private func startOver() {
        texts = []
        entries = []
        message = nil
        failure = nil
        failedText = ""
        saveFailure = nil
    }

    private func save() {
        saving = true
        saveFailure = nil
        Task {
            defer { saving = false }
            do {
                guard let api = await Native.api() else { throw APIError.failed(status: 401, message: CasyStrings.tellSaveFailed) }
                let saved = try await api.saveEntries(entries, errorMessage: CasyStrings.tellSaveFailed)
                calendars.onChanged?()
                // The month glides to the first day added, to show it landed.
                let first = saved.map(\.start).min() ?? entries.map(\.start).min()
                if let first { leave(.added(first)) } else { closeSheet() }
            } catch {
                saveFailure = error.localizedDescription
            }
        }
    }

    private func delete(_ id: String) {
        deleting = id
        deleteFailure = nil
        Task {
            defer { deleting = nil }
            do {
                guard let api = await Native.api() else { throw APIError.failed(status: 401, message: CasyStrings.tellDeleteFailed) }
                try await api.deleteEntry(id, errorMessage: CasyStrings.tellDeleteFailed)
                await calendars.settled()
            } catch {
                deleteFailure = error.localizedDescription
            }
        }
    }
}

/// One entry as a row: what kind, what it is called, and when.
private struct EntryRow<Action: View>: View {
    let entry: CasyEntry
    let lang: Lang
    @ViewBuilder let action: () -> Action

    var body: some View {
        HStack {
            ListRow(
                entry.label, systemImage: entry.kind == "away" ? "airplane" : "clock",
                detail: "\(CasyStrings.tellKind(entry.kind)) · \(entryWhen(entry, lang))")
            action()
        }
    }
}

/// The box to write or say a description in, with the microphone and send
/// beside each other under it (the web's Composer).
private struct Composer: View {
    let big: Bool
    let placeholder: String
    let sendLabel: String
    let send: (String) -> Void
    var cancel: (() -> Void)?

    @State private var draft: String
    /// What was typed before the microphone went on; speech is added after it.
    @State private var before = ""
    @State private var speech = SpeechInput()
    @FocusState private var focused: Bool

    init(
        initial: String, big: Bool, placeholder: String, sendLabel: String, send: @escaping (String) -> Void,
        cancel: (() -> Void)? = nil
    ) {
        _draft = State(initialValue: initial)
        self.big = big
        self.placeholder = placeholder
        self.sendLabel = sendLabel
        self.send = send
        self.cancel = cancel
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack(alignment: .topLeading) {
                if draft.isEmpty {
                    Text(speech.listening ? CasyStrings.listening : placeholder)
                        .foregroundStyle(Theme.mutedForeground.color)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                        .accessibilityHidden(true)
                }
                TextEditor(text: $draft)
                    .focused($focused)
                    .scrollContentBackground(.hidden)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 4)
                    .frame(minHeight: big ? 150 : 84)
                    .accessibilityLabel(placeholder)
                    .accessibilityIdentifier("tell.box")
                    .onChange(of: draft) { _, typed in
                        if typed.count > 500 { draft = String(typed.prefix(500)) }
                    }
            }
            .font(big ? .body : .callout)
            .foregroundStyle(Theme.foreground.color)
            .background(Theme.card.color, in: RoundedRectangle(cornerRadius: 16))
            .overlay {
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(
                        speech.listening || focused ? Theme.primary.color : Theme.border.color,
                        lineWidth: speech.listening ? 2 : 1)
            }
            HStack(spacing: 8) {
                Button {
                    Task {
                        if !speech.listening { before = draft.trimmingCharacters(in: .whitespacesAndNewlines) }
                        await speech.toggle()
                    }
                } label: {
                    Label(
                        speech.listening ? CasyStrings.stopSpeaking : CasyStrings.speak,
                        systemImage: speech.listening ? "stop.fill" : "waveform"
                    )
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.primary.color)
                    .symbolEffect(.variableColor.iterative, isActive: speech.listening)
                    .padding(.horizontal, 12)
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                Spacer()
                if let cancel {
                    Button(CasyStrings.aiCancel, action: cancel)
                        .font(.subheadline)
                        .foregroundStyle(Theme.mutedForeground.color)
                }
                GlassButton(size: .small, action: submit) { Text(sendLabel) }
                    .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    .accessibilityIdentifier("tell.send")
            }
            if let failure = speech.failure {
                Notice(failure, tone: .warning, bare: true)
            }
        }
        .onAppear {
            speech.onHeard = { heard in
                draft = before.isEmpty ? heard : "\(before) \(heard)"
            }
        }
        .onDisappear { Task { await speech.stop() } }
    }

    private func submit() {
        Task {
            await speech.stop()
            send(draft)
        }
    }
}

extension View {
    /// A row that is only its own content: no card behind it, no inset.
    fileprivate func plainRow() -> some View {
        listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets(top: 6, leading: 0, bottom: 6, trailing: 0))
            .listRowSeparator(.hidden)
    }
}
