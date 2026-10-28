import { describe, expect, it } from "vitest";

import {
  EMPTY_TRANSCRIPT,
  hearSpeech,
  transcriptText,
  type Transcript,
} from "@/lib/speechTranscript";

/** The transcript after hearing each text in turn. */
const hearAll = (texts: string[], start: Transcript = EMPTY_TRANSCRIPT) =>
  texts.reduce((transcript, heard) => hearSpeech(transcript, heard), start);

describe("hearSpeech", () => {
  it("follows the recognizer while a sentence grows", () => {
    const t = hearAll(["Middag", "Middag med", "Middag med Sara på fredag"]);
    expect(transcriptText(t)).toBe("Middag med Sara på fredag");
  });

  it("takes a correction of a word as the same sentence", () => {
    const t = hearAll(["Middag med Sara på fre dag", "Middag med Sara på fredag"]);
    expect(transcriptText(t)).toBe("Middag med Sara på fredag");
  });

  it("keeps the sentence before a pause when the recognizer starts over", () => {
    const t = hearAll([
      "Middag med Sara på fredag",
      "Klokken",
      "Klokken seks",
      "Klokken seks om aftenen",
    ]);
    expect(transcriptText(t)).toBe("Middag med Sara på fredag Klokken seks om aftenen");
  });

  it("keeps every sentence through several pauses", () => {
    const t = hearAll([
      "Middag med Sara på fredag",
      "Klokken",
      "Klokken seks om aftenen",
      "Hos",
      "Hos mig",
    ]);
    expect(transcriptText(t)).toBe("Middag med Sara på fredag Klokken seks om aftenen Hos mig");
  });

  it("can't tell a start-over from a correction under three words", () => {
    const t = hearAll(["Middag med", "Fre"]);
    expect(transcriptText(t)).toBe("Fre");
  });

  it("puts what the plugin kept from before a pause first", () => {
    const t = hearSpeech(EMPTY_TRANSCRIPT, "klokken seks", "Middag med Sara");
    expect(transcriptText(t)).toBe("Middag med Sara klokken seks");
  });
});
