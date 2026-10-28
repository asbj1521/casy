import { useEffect, useRef, useState } from "react";

import FlowButton from "@/components/ui/FlowButton";
import Notice from "@/components/ui/Notice";
import Sheet from "@/components/ui/Sheet";
import { useLang, useT } from "@/i18n/lang";
import { enablePush, pushPermission } from "@/lib/push";
import { type AskReason, mayAsk, onAskForPush, readAskState, recordAsk } from "@/lib/pushAsk";

/** A beat after what the person did, so the sheet doesn't land on top of the page still moving. */
const SHOW_AFTER_MS = 700;

/**
 * Casy's own question before iOS's (#139): shown where people are waiting on
 * others, never more often than pushAsk.ts allows. "Slå til" hands over to
 * iOS's prompt; "Ikke nu" (or swiping it away) leaves the question for a
 * later moment. Lives in the app only (PushLinks).
 */
export default function PushAsk() {
  const t = useT();
  const { lang } = useLang();
  const [reason, setReason] = useState<AskReason | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showing = useRef(false);

  useEffect(
    () =>
      onAskForPush((next) => {
        if (showing.current) return;
        showing.current = true;
        void (async () => {
          const permission = await pushPermission().catch(() => "denied" as const);
          if (!mayAsk(readAskState(), permission, Date.now())) {
            showing.current = false;
            return;
          }
          setTimeout(() => {
            recordAsk(Date.now());
            setError(null);
            setReason(next);
          }, SHOW_AFTER_MS);
        })();
      }),
    [],
  );

  function close() {
    showing.current = false;
    setReason(null);
  }

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      await enablePush(lang);
      close();
    } catch {
      setError(t.push.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={reason !== null}
      onClose={close}
      title={t.push.askTitle[reason ?? "sent"]}
      closeLabel={t.push.askLater}
      busy={busy}
      footer={
        <FlowButton busy={busy} onClick={() => void enable()}>
          {t.push.askEnable}
        </FlowButton>
      }
    >
      <p className="text-xs text-muted-foreground">{t.push.askNote}</p>
      {error && (
        <Notice tone="error" className="mt-3">
          {error}
        </Notice>
      )}
    </Sheet>
  );
}
