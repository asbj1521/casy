#if DEBUG
import AVFAudio
import Speech
import SwiftUI

/// The spike's speech test (#196, step 5): does iOS 26's SpeechAnalyzer take
/// Danish on this phone? Apple's list of languages isn't published and a
/// listed one can still fail to download its model, so this asks each API,
/// downloads the model and transcribes for real. SFSpeechRecognizer is what
/// the app uses today (through the Capacitor plugin) and already works for
/// Danish: it is the fallback, reported but not recorded with here.
/// Debug builds only; deleted when the spike ends.
@MainActor @Observable
final class SpeechLabModel {
    enum Engine: String, CaseIterable, Identifiable {
        case speech = "SpeechTranscriber"
        case dictation = "DictationTranscriber"
        var id: String { rawValue }
    }

    var report: [String] = []
    var engine = Engine.speech
    var status = ""
    var recording = false
    /// What is settled, and what is still being heard.
    var transcript = ""
    var volatile = ""

    private let danish = Locale(identifier: "da_DK")
    private let audio = AVAudioEngine()
    private var analyzer: SpeechAnalyzer?
    private var input: AsyncStream<AnalyzerInput>.Continuation?
    private var results: Task<Void, Never>?

    func check() async {
        func danishOnes(_ locales: [Locale]) -> String {
            let ones = locales.map(\.identifier).filter { $0.hasPrefix("da") }
            return ones.isEmpty ? "none" : ones.joined(separator: ", ")
        }
        var lines = ["SpeechTranscriber.isAvailable: \(SpeechTranscriber.isAvailable)"]
        let speech = await SpeechTranscriber.supportedLocale(equivalentTo: danish)
        lines.append("SpeechTranscriber da_DK: \(speech?.identifier ?? "not supported")")
        lines.append("  installed: \(danishOnes(await SpeechTranscriber.installedLocales))")
        let dictation = await DictationTranscriber.supportedLocale(equivalentTo: danish)
        lines.append("DictationTranscriber da_DK: \(dictation?.identifier ?? "not supported")")
        lines.append("  installed: \(danishOnes(await DictationTranscriber.installedLocales))")
        let old = SFSpeechRecognizer(locale: Locale(identifier: "da-DK"))
        lines.append(
            "SFSpeechRecognizer da-DK: "
                + (old.map { "available \($0.isAvailable), on device \($0.supportsOnDeviceRecognition)" }
                    ?? "none"))
        report = lines
    }

    func toggle() async {
        if recording { await stop() } else { await start() }
    }

    private func start() async {
        transcript = ""
        volatile = ""
        guard await AVAudioApplication.requestRecordPermission() else {
            status = "No microphone permission"
            return
        }
        let speechAllowed = await withCheckedContinuation { done in
            SFSpeechRecognizer.requestAuthorization { done.resume(returning: $0 == .authorized) }
        }
        status = speechAllowed ? "" : "Speech recognition not allowed (trying anyway)"
        do {
            let module: any SpeechModule
            switch engine {
            case .speech:
                guard let locale = await SpeechTranscriber.supportedLocale(equivalentTo: danish) else {
                    status = "SpeechTranscriber: Danish not supported"
                    return
                }
                let transcriber = SpeechTranscriber(
                    locale: locale, transcriptionOptions: [], reportingOptions: [.volatileResults],
                    attributeOptions: [])
                module = transcriber
                results = Task { [weak self] in
                    do {
                        for try await result in transcriber.results {
                            self?.heard(String(result.text.characters), final: result.isFinal)
                        }
                    } catch { self?.status = "Results failed: \(error.localizedDescription)" }
                }
            case .dictation:
                guard let locale = await DictationTranscriber.supportedLocale(equivalentTo: danish) else {
                    status = "DictationTranscriber: Danish not supported"
                    return
                }
                let transcriber = DictationTranscriber(locale: locale, preset: .progressiveShortDictation)
                module = transcriber
                results = Task { [weak self] in
                    do {
                        for try await result in transcriber.results {
                            self?.heard(String(result.text.characters), final: result.isFinal)
                        }
                    } catch { self?.status = "Results failed: \(error.localizedDescription)" }
                }
            }

            if let request = try await AssetInventory.assetInstallationRequest(supporting: [module]) {
                status = "Downloading the Danish model…"
                let started = Date()
                try await request.downloadAndInstall()
                status = "Model installed in \(Int(Date().timeIntervalSince(started))) s"
                await check()
            }

            guard let format = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [module])
            else {
                status = "No audio format for the model"
                return
            }
            let (stream, continuation) = AsyncStream<AnalyzerInput>.makeStream()
            let analyzer = SpeechAnalyzer(modules: [module])
            try await analyzer.start(inputSequence: stream)
            self.analyzer = analyzer
            self.input = continuation

            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .measurement)
            try session.setActive(true)
            let microphone = audio.inputNode.outputFormat(forBus: 0)
            guard let converter = AVAudioConverter(from: microphone, to: format) else {
                status = "Can't convert \(microphone) to \(format)"
                return
            }
            audio.inputNode.installTap(onBus: 0, bufferSize: 4096, format: microphone) { buffer, _ in
                if let converted = Self.convert(buffer, with: converter, to: format) {
                    continuation.yield(AnalyzerInput(buffer: converted))
                }
            }
            audio.prepare()
            try audio.start()
            recording = true
            if status.hasPrefix("Model") == false { status = "Listening (\(engine.rawValue))" }
        } catch {
            status = "Failed: \(error.localizedDescription)"
            await stop()
        }
    }

    private func stop() async {
        audio.inputNode.removeTap(onBus: 0)
        audio.stop()
        input?.finish()
        input = nil
        do {
            try await analyzer?.finalizeAndFinishThroughEndOfInput()
        } catch {
            status = "Finishing failed: \(error.localizedDescription)"
        }
        analyzer = nil
        _ = await results?.value
        results = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        recording = false
        if status.hasPrefix("Listening") { status = "Stopped" }
    }

    private func heard(_ text: String, final: Bool) {
        if final {
            transcript += text
            volatile = ""
        } else {
            volatile = text
        }
    }

    /// The microphone's buffer in the model's format (another sample rate, as a rule).
    private nonisolated static func convert(
        _ buffer: AVAudioPCMBuffer, with converter: AVAudioConverter, to format: AVAudioFormat
    ) -> AVAudioPCMBuffer? {
        let ratio = format.sampleRate / buffer.format.sampleRate
        let capacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 1
        guard let out = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: capacity) else { return nil }
        var handedOver = false
        var error: NSError?
        converter.convert(to: out, error: &error) { _, state in
            if handedOver {
                state.pointee = .noDataNow
                return nil
            }
            handedOver = true
            state.pointee = .haveData
            return buffer
        }
        return error == nil ? out : nil
    }
}

struct SpeechLab: View {
    @State private var model = SpeechLabModel()

    var body: some View {
        List {
            Section("What iOS says about Danish") {
                ForEach(model.report, id: \.self) { line in
                    Text(line).font(.footnote.monospaced())
                }
                Button("Check again") { Task { await model.check() } }
            }
            Section {
                Picker("Engine", selection: $model.engine) {
                    ForEach(SpeechLabModel.Engine.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .disabled(model.recording)
                Button(model.recording ? "Stop" : "Record in Danish") {
                    Task { await model.toggle() }
                }
            } header: {
                Text("Record")
            } footer: {
                Text(model.status)
            }
            Section("Transcript") {
                (Text(model.transcript) + Text(model.volatile).foregroundStyle(.secondary))
                    .frame(maxWidth: .infinity, minHeight: 80, alignment: .topLeading)
            }
        }
        .navigationTitle("Speech")
        .task { await model.check() }
    }
}
#endif
