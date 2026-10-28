/**
 * The app's speech transcript across pauses (useSpeechInput.ts). Apple's
 * recognizer, kept listening, starts its transcript over after a pause in
 * the same session: the first words after the pause arrive as the whole
 * text, and the sentence before it is gone. The speech plugin passes that
 * on as it is (it only keeps earlier sentences in its push-to-talk mode,
 * which Casy doesn't use), so the sentences said so far are kept here.
 *
 * A start-over is told apart from a correction by length: while someone
 * speaks, the transcript grows, and a correction changes a word or two; a
 * start-over is suddenly much shorter. Under three words a start-over can't
 * be told from a correction, so a pause that soon loses those words.
 */

export interface Transcript {
  /** The sentences before the latest pause, in order. */
  done: string;
  /** What the recognizer has of the sentence being spoken now. */
  current: string;
}

export const EMPTY_TRANSCRIPT: Transcript = { done: "", current: "" };

/** Shorter than this share of the sentence before, it's a start-over. */
const START_OVER_SHARE = 0.6;
/** A sentence of fewer words than this is never taken as finished. */
const START_OVER_MIN_WORDS = 3;

const wordCount = (text: string) => text.split(" ").filter(Boolean).length;

const joined = (a: string, b: string) => (a && b ? `${a} ${b}` : a || b);

/**
 * The transcript once `heard` (the recognizer's latest text, tidied) has
 * arrived. `earlier` is what the plugin itself kept from before a pause,
 * when it does.
 */
export function hearSpeech(transcript: Transcript, heard: string, earlier = ""): Transcript {
  const now = joined(earlier, heard);
  const { done, current } = transcript;
  const startedOver =
    wordCount(current) >= START_OVER_MIN_WORDS && now.length < current.length * START_OVER_SHARE;
  return startedOver ? { done: joined(done, current), current: now } : { done, current: now };
}

/** Everything said so far, as one line. */
export const transcriptText = ({ done, current }: Transcript) => joined(done, current);
