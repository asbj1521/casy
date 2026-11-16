import AVFAudio
import CasyCore
import CasyUI
import Speech

/// Talking instead of typing (#100, #200), natively: Danish or English as Casy
/// is set. On iOS 26, Apple's on-phone dictation (`SpeechAnalyzer` with
/// `DictationTranscriber`, which the spike found takes Danish, #196); before
/// that `SFSpeechRecognizer`, as the web's plugin used, on the phone where it
/// can and Apple's servers where it can't (the privacy policy says so). Casy
/// only ever gets the text. `onHeard` has everything said so far.
@MainActor @Observable
final class SpeechInput {
    private(set) var listening = false
    /// Why it stopped or never started, in words for the person.
    private(set) var failure: String?

    @ObservationIgnored var onHeard: ((String) -> Void)?

    @ObservationIgnored private let audio = AVAudioEngine()
    @ObservationIgnored private var transcript = Transcript()
    @ObservationIgnored private var stopping: (() async -> Void)?

    private var locale: Locale { Locale(identifier: CasyStrings.language == "en" ? "en_GB" : "da_DK") }

    func toggle() async {
        if listening { await stop() } else { await start() }
    }

    func start() async {
        guard !listening else { return }
        failure = nil
        transcript = Transcript()
        #if DEBUG
            // The simulator has no microphone to speak into.
            if TestLaunch.isActive { return }
        #endif
        guard await AVAudioApplication.requestRecordPermission(), await Self.speechAllowed() else {
            failure = CasyStrings.micDenied
            return
        }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true, options: .notifyOthersOnDeactivation)
            if #available(iOS 26, *), let dictation = try await startDictation() {
                stopping = dictation
            } else {
                stopping = try startRecognizer()
            }
            listening = true
        } catch {
            failure = CasyStrings.micFailed
            await stop()
        }
    }

    func stop() async {
        if audio.isRunning {
            audio.inputNode.removeTap(onBus: 0)
            audio.stop()
        }
        let finish = stopping
        stopping = nil
        listening = false
        await finish?()
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private static func speechAllowed() async -> Bool {
        await withCheckedContinuation { done in
            SFSpeechRecognizer.requestAuthorization { done.resume(returning: $0 == .authorized) }
        }
    }

    private func heard(_ text: String, earlier: String = "") {
        transcript = hearSpeech(transcript, tidySpeech(text), earlier: tidySpeech(earlier))
        onHeard?(transcript.text)
    }

    // MARK: iOS 26: dictation on the phone

    /// Nil when the language has no dictation model: the older recognizer then.
    @available(iOS 26, *)
    private func startDictation() async throws -> (() async -> Void)? {
        guard let locale = await DictationTranscriber.supportedLocale(equivalentTo: locale) else { return nil }
        let transcriber = DictationTranscriber(locale: locale, preset: .progressiveShortDictation)
        if let request = try await AssetInventory.assetInstallationRequest(supporting: [transcriber]) {
            try await request.downloadAndInstall()
        }
        guard let format = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [transcriber]) else {
            return nil
        }
        let results = Task { [weak self] in
            // Finished sentences, and the one still being heard.
            var settled = ""
            do {
                for try await result in transcriber.results {
                    let text = String(result.text.characters)
                    if result.isFinal {
                        settled += text
                        self?.heard(settled)
                    } else {
                        self?.heard(settled + text)
                    }
                }
            } catch {
                self?.failure = CasyStrings.micFailed
            }
        }
        let (stream, input) = AsyncStream<AnalyzerInput>.makeStream()
        let analyzer = SpeechAnalyzer(modules: [transcriber])
        try await analyzer.start(inputSequence: stream)
        let microphone = audio.inputNode.outputFormat(forBus: 0)
        guard let converter = AVAudioConverter(from: microphone, to: format) else {
            results.cancel()
            return nil
        }
        audio.inputNode.installTap(onBus: 0, bufferSize: 4096, format: microphone) { buffer, _ in
            if let converted = Self.convert(buffer, with: converter, to: format) {
                input.yield(AnalyzerInput(buffer: converted))
            }
        }
        audio.prepare()
        try audio.start()
        return {
            input.finish()
            try? await analyzer.finalizeAndFinishThroughEndOfInput()
            _ = await results.value
        }
    }

    /// The microphone's buffer in the model's format (another sample rate, as a rule).
    nonisolated private static func convert(
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

    // MARK: Before iOS 26: SFSpeechRecognizer

    private func startRecognizer() throws -> () async -> Void {
        guard let recognizer = SFSpeechRecognizer(locale: locale), recognizer.isAvailable else {
            throw CancellationError()
        }
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.requiresOnDeviceRecognition = recognizer.supportsOnDeviceRecognition
        let task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            let text = result?.bestTranscription.formattedString
            let failed = error != nil && result == nil
            Task { @MainActor in
                guard let self else { return }
                if let text { self.heard(text) }
                if failed && self.listening {
                    self.failure = CasyStrings.micFailed
                    await self.stop()
                }
            }
        }
        let microphone = audio.inputNode.outputFormat(forBus: 0)
        audio.inputNode.installTap(onBus: 0, bufferSize: 4096, format: microphone) { buffer, _ in
            request.append(buffer)
        }
        audio.prepare()
        try audio.start()
        return {
            request.endAudio()
            task.finish()
        }
    }
}
