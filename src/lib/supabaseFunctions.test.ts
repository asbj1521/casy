import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadMessages, setCurrentLang } from "@/i18n/current";
import { callFunction } from "@/lib/supabaseFunctions";

vi.mock("@/lib/supabase", () => ({
  supabaseAuth: { getSession: async () => ({ data: { session: null } }) },
}));

function answer(status: number, body: unknown) {
  const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("callFunction", () => {
  beforeEach(() => setCurrentLang("da"));
  afterEach(() => vi.unstubAllGlobals());

  it("shows the function's own error rather than the fallback", async () => {
    answer(400, { error: "Invitationslinket er ikke gyldigt." });
    await expect(callFunction("groups", { body: {}, errorMessage: "Kunne ikke" })).rejects.toThrow(
      "Invitationslinket er ikke gyldigt.",
    );
  });

  it("falls back to the caller's message when the function says nothing", async () => {
    answer(500, {});
    await expect(callFunction("groups", { body: {}, errorMessage: "Kunne ikke" })).rejects.toThrow(
      "Kunne ikke (HTTP 500)",
    );
  });

  it("says which function failed when there is no message at all", async () => {
    answer(502, {});
    await expect(callFunction("groups", { body: {} })).rejects.toThrow("groups fejlede (HTTP 502)");
  });

  it("says there is no connection, in plain words, when the request never gets through", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("Load failed"))),
    );
    await expect(callFunction("groups", { body: {} })).rejects.toThrow(
      "Ingen forbindelse til Casy. Tjek dit internet, og prøv igen.",
    );
  });

  it("says it took too long when the request times out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new DOMException("signal timed out", "TimeoutError"))),
    );
    // English is fetched before a page switches to it (#157); here by hand.
    await loadMessages("en");
    setCurrentLang("en");
    await expect(callFunction("groups", { body: {} })).rejects.toThrow(
      "Casy took too long to answer. Try again.",
    );
  });

  it("calls the function by name, in the page's language", async () => {
    const fetchMock = answer(200, { ok: true });
    setCurrentLang("en");
    await callFunction("calendar-busy", { params: { from: "a" } });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe(
      "https://test-project.supabase.co/functions/v1/calendar-busy",
    );
    expect(url.searchParams.get("lang")).toBe("en");
    expect(url.searchParams.get("from")).toBe("a");
  });
});
