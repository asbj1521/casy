// The speech transcript across pauses: src/lib/speechTranscript.ts. Apple's
// recognizer, kept listening, may start its transcript over after a pause: the
// first words after it arrive as the whole text. A start-over is told from a
// correction by length: suddenly much shorter is a start-over.

public struct Transcript: Codable, Sendable, Equatable {
    /// The sentences before the latest pause, in order.
    public var done: String
    /// What the recognizer has of the sentence being spoken now.
    public var current: String

    public init(done: String = "", current: String = "") {
        self.done = done
        self.current = current
    }

    /// Everything said so far, as one line.
    public var text: String { joined(done, current) }
}

/// Shorter than this share of the sentence before, it's a start-over.
private let startOverShare = 0.6
/// A sentence of fewer words than this is never taken as finished.
private let startOverMinWords = 3

private func joined(_ a: String, _ b: String) -> String {
    !a.isEmpty && !b.isEmpty ? "\(a) \(b)" : a.isEmpty ? b : a
}

private func wordCount(_ text: String) -> Int {
    text.split(separator: " ").count
}

/// The transcript once `heard` (the recognizer's latest text, tidied) has arrived.
public func hearSpeech(_ transcript: Transcript, _ heard: String, earlier: String = "") -> Transcript {
    let now = joined(earlier, heard)
    let startedOver =
        wordCount(transcript.current) >= startOverMinWords
        && Double(now.utf16.count) < Double(transcript.current.utf16.count) * startOverShare
    return startedOver
        ? Transcript(done: joined(transcript.done, transcript.current), current: now)
        : Transcript(done: transcript.done, current: now)
}

/// Runs of white space as one space, none at the ends.
public func tidySpeech(_ text: String) -> String {
    text.split(whereSeparator: \.isWhitespace).joined(separator: " ")
}
