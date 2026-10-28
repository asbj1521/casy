import { useState } from "react";

import { adminPushTest } from "@/api/admin";
import Notice from "@/components/ui/Notice";
import { useLang, useT } from "@/i18n/lang";
import { isNativeApp } from "@/lib/nativeApp";

/**
 * Admin mode in the app (#139): switch notifications on for this phone and
 * send it a test, the whole way through Apple and back. Proves pushes work
 * before anything real is sent.
 */
export default function PushTest() {
  const t = useT();
  const { lang } = useLang();
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  if (!isNativeApp) return null;

  async function send() {
    setBusy(true);
    setAnswer(null);
    try {
      const { enablePush } = await import("@/lib/push");
      if ((await enablePush(lang)) === "denied") {
        setAnswer({ tone: "error", text: t.push.testDenied });
        return;
      }
      const { sent, failed } = await adminPushTest(lang);
      setAnswer(
        sent > 0
          ? { tone: "success", text: t.push.testSent(sent) }
          : { tone: "error", text: t.push.testNone(failed.join(", ")) },
      );
    } catch (err) {
      setAnswer({ tone: "error", text: err instanceof Error ? err.message : t.push.failed });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => void send()}
        disabled={busy}
        className="rounded-full border bg-background px-3.5 py-1.5 text-sm font-semibold text-foreground transition hover:bg-secondary disabled:opacity-60"
      >
        {busy ? t.push.testSending : t.push.testButton}
      </button>
      {answer && (
        <Notice tone={answer.tone} className="mt-2">
          {answer.text}
        </Notice>
      )}
    </div>
  );
}
