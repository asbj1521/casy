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

    /// The web's TellCasySheet (#281): one column 12 apart, the box first;
    /// what we made of it as a CardList, its two glass buttons under it; what
    /// is kept as a CardList with its footnote.
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                if !started {
                    if pending {
                        thinking
                    } else {
                        Composer(
                            initial: failedText, big: true, placeholder: CasyStrings.tellPlaceholder,
                            sendLabel: CasyStrings.tellSend, send: describe)
                            .id("first-\(failedText)")
                    }
                } else {
                    if !entries.isEmpty {
                        CardList(CasyStrings.tellUnderstood, spaced: false) {
                            ForEach(Array(entries.enumerated()), id: \.offset) { i, entry in
                                EntryRow(entry: entry, lang: lang) {
                                    RowIconButton(icon: "x", label: CasyStrings.tellLeaveOut(entry.label)) {
                                        entries.remove(at: i)
                                    }
                                    .disabled(pending || saving)
                                }
                            }
                        }
                    } else if message == nil {
                        Text(CasyStrings.tellNothingFound)
                            .font(.system(size: 15))
                            .foregroundStyle(Theme.mutedForeground.color)
                            .padding(.horizontal, 4)
                    }
                    if let message { Notice(message, tone: .info) }
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
                    } else {
                        WrapLayout(spacing: 8) {
                            GlassButton(icon: "message-square-plus", size: .small, action: { adding = true }) {
                                Text(CasyStrings.tellAddDetails)
                            }
                            GlassButton(icon: "rotate-ccw", size: .small, action: startOver) {
                                Text(CasyStrings.tellAgain)
                            }
                        }
                        .disabled(saving)
                    }
                }
                if let failure { Notice(failure, tone: .error) }
                if let saveFailure { Notice(saveFailure, tone: .error) }
                if let left {
                    Text(CasyStrings.aiLeft(left) + ".")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.mutedForeground.color)
                        .cssLineHeight(16, size: 12)
                        .padding(.horizontal, 4)
                }
                let kept = calendars.data?.entries ?? []
                if !kept.isEmpty {
                    CardList(CasyStrings.tellKept, footnote: CasyStrings.tellKeptNote, spaced: false) {
                        ForEach(kept, id: \.id) { stored in
                            EntryRow(entry: stored.entry, lang: lang) {
                                RowIconButton(
                                    icon: "trash", spinning: deleting == stored.id,
                                    label: CasyStrings.tellRemove(stored.label)
                                ) {
                                    delete(stored.id)
                                }
                                .disabled(deleting != nil)
                            }
                        }
                    }
                    // The web's mt-3, on top of the column's 12.
                    .padding(.top, 12)
                }
                if let deleteFailure { Notice(deleteFailure, tone: .error) }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 16)
        }
        .solidHalfSheet(plain: true)
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

    /// The web's Thinking: a 16 point spinner and 15 point muted words.
    private var thinking: some View {
        HStack(spacing: 8) {
            ProgressView().controlSize(.small)
            Text(CasyStrings.tellThinking)
                .font(.system(size: 15))
                .foregroundStyle(Theme.mutedForeground.color)
        }
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

/// One entry as a row (the web's EntryRow): plane or clock, what it is
/// called, what kind and when, and its button at the end.
private struct EntryRow<Action: View>: View {
    let entry: CasyEntry
    let lang: Lang
    @ViewBuilder let action: () -> Action

    var body: some View {
        CardRow(
            entry.label, icon: entry.kind == "away" ? "plane" : "clock",
            detail: "\(CasyStrings.tellKind(entry.kind)) · \(entryWhen(entry, lang))"
        ) {
            action()
        }
    }
}

/// A row's 36 point round button at its end (`-mr-2`), its 16 point icon muted.
private struct RowIconButton: View {
    let icon: String
    var spinning = false
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Group {
                if spinning {
                    ProgressView().controlSize(.small)
                } else {
                    LucideIcon(icon, size: 16)
                }
            }
            .foregroundStyle(Theme.mutedForeground.color)
            .frame(width: 36, height: 36)
            .contentShape(Circle().inset(by: -4))
        }
        .buttonStyle(.plain)
        .padding(.trailing, -8)
        .accessibilityLabel(label)
    }
}

/// The box to write or say a description in, as the web's Composer: a card
/// (`rounded-2xl border`, the first one's border orange-200 with a small
/// shadow, orange with a soft ring while written in or listening), the text
/// 17 at 1.625 (16 at 24 for more details), and inside along its bottom the
/// microphone (a 44 point orange-50 circle with the waveform, red while
/// listening) and the send as a glass capsule with sparkles.
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

    private var size: CGFloat { big ? 17 : 16 }
    private var line: CGFloat { big ? 27.625 : 24 }
    private var lit: Bool { focused || speech.listening }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            VStack(spacing: 0) {
                ZStack(alignment: .topLeading) {
                    if draft.isEmpty {
                        Text(speech.listening ? CasyStrings.listening : placeholder)
                            .foregroundStyle(Theme.mutedForeground.color)
                            .cssLineHeight(line, size: size)
                            .padding(.horizontal, 14)
                            .padding(.top, 12)
                            .accessibilityHidden(true)
                    }
                    TextEditor(text: $draft)
                        .focused($focused)
                        .scrollContentBackground(.hidden)
                        .lineSpacing(line - size * 1.193)
                        // The editor's own inset (5 across, 8 down) taken off the web's px-3.5 pt-3.
                        .padding(.horizontal, 9)
                        .padding(.top, 4 + (line - size * 1.193) / 2)
                        .frame(height: (big ? 6 : 3) * line + 12)
                        .accessibilityLabel(placeholder)
                        .accessibilityIdentifier("tell.box")
                        .onChange(of: draft) { _, typed in
                            if typed.count > 500 { draft = String(typed.prefix(500)) }
                        }
                }
                .font(.system(size: size))
                .foregroundStyle(Theme.foreground.color)
                HStack(spacing: 4) {
                    MicButton(listening: speech.listening) {
                        Task {
                            if !speech.listening { before = draft.trimmingCharacters(in: .whitespacesAndNewlines) }
                            await speech.toggle()
                        }
                    }
                    Spacer(minLength: 8)
                    if let cancel {
                        Button {
                            Task { await speech.stop() }
                            cancel()
                        } label: {
                            Text(CasyStrings.aiCancel)
                                .font(.system(size: 15, weight: .medium))
                                .foregroundStyle(Theme.mutedForeground.color)
                                .padding(.horizontal, 12)
                                .frame(height: 40)
                                .contentShape(Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                    Button(action: submit) {
                        HStack(spacing: 6) {
                            LucideIcon("sparkles", size: 16)
                            Text(sendLabel)
                        }
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Theme.primary.color)
                        .padding(.horizontal, 14)
                        .frame(height: 40)
                        .casyGlass()
                        .contentShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .opacity(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.5 : 1)
                    .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    .accessibilityIdentifier("tell.send")
                }
                .padding(.horizontal, 8)
                .padding(.bottom, 8)
            }
            .background(Theme.card.color, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(
                        lit ? Theme.primary.color : big ? Theme.orange200.color : Theme.border.color, lineWidth: 1)
            }
            // The web's ring-2 ring-primary/20, outside the border.
            .background {
                if lit {
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(Theme.primary.color.opacity(0.2))
                        .padding(-2)
                }
            }
            .shadow(color: .black.opacity(big ? 0.05 : 0), radius: 1, y: 1)
            .contentShape(Rectangle())
            .onTapGesture { focused = true }
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

/// The web's speak button: a 44 point circle, orange-50 with the orange
/// waveform (red-600 and white while listening), a ring spreading out of it
/// (`animate-sound-ring`: 1 to 1.55, 45 % to nothing, 2.6 s).
private struct MicButton: View {
    let listening: Bool
    let action: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Button(action: action) {
            ZStack {
                if !reduceMotion {
                    TimelineView(.animation) { context in
                        let t = context.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 2.6) / 2.6
                        // ease-out
                        let eased = 1 - pow(1 - t, 3)
                        Circle()
                            .fill(listening ? Theme.red600.color.opacity(0.4) : Theme.primary.color.opacity(0.3))
                            .scaleEffect(1 + 0.55 * eased)
                            .opacity(0.45 * (1 - eased))
                    }
                }
                Circle().fill(listening ? Theme.red600.color : Theme.orange50.color)
                SoundWave(listening: listening)
                    .foregroundStyle(listening ? Color.white : Theme.primary.color)
            }
            .frame(width: 44, height: 44)
            .contentShape(Circle())
        }
        .buttonStyle(PressScale())
        .accessibilityLabel(listening ? CasyStrings.stopSpeaking : CasyStrings.speak)
        .accessibilityAddTraits(listening ? .isSelected : [])
    }
}

/// `active:scale-95`.
private struct PressScale: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.scaleEffect(configuration.isPressed ? 0.95 : 1)
    }
}

/// The web's SoundWave: five 3 point bars, 3 apart, 24 high, peaking in the
/// middle, each breathing slowly at rest and fast and tall while listening.
private struct SoundWave: View {
    let listening: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private static let rest: [Double] = [0.4, 0.7, 1, 0.65, 0.35]

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { context in
            let now = context.date.timeIntervalSinceReferenceDate
            HStack(spacing: 3) {
                ForEach(0..<5, id: \.self) { i in
                    let rest = Self.rest[i]
                    let low = listening ? 0.2 : rest * 0.55
                    let high = listening ? min(1, rest + 0.3) : rest
                    let speed = listening ? 0.7 : 1.8
                    let delay = Double(i) * (listening ? -0.15 : -0.35)
                    // ease-in-out between low and high, there and back in `speed`.
                    let phase = ((now - delay) / speed).truncatingRemainder(dividingBy: 1)
                    let wave = (1 - cos(phase * 2 * .pi)) / 2
                    Capsule()
                        .frame(width: 3, height: 24)
                        .scaleEffect(y: reduceMotion ? rest : low + (high - low) * wave)
                }
            }
            .frame(height: 24)
        }
        .accessibilityHidden(true)
    }
}
