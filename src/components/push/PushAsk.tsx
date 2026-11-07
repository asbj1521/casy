import { useEffect, useRef, useState } from "react";

import BottomSheet from "@/components/ui/BottomSheet";
import FlowButton from "@/components/ui/FlowButton";
import Notice from "@/components/ui/Notice";
import { useLang, useT } from "@/i18n/lang";
import { enablePush, pushPermission } from "@/lib/push";
import {
  type AskReason,
  markPushAskOpen,
  mayAsk,
  onAskForPush,
  readAskState,
  recordAsk,
} from "@/lib/pushAsk";

/**
 * A clear beat after what the person did, so the sheet neither lands on the page
 * still moving nor reads as the sheet just closed coming back (#230).
 */
const SHOW_AFTER_MS = 1200;

/**
 * What Casy says before iOS's question (#139): shown where people are waiting
 * on others, never more often than pushAsk.ts allows. Its one button, "Fortsæt",
 * leads straight to iOS's prompt, where the person answers, so the sheet can only
 * be put away if that failed (App Store guideline 5.1.1(iv), #147). Lives in the
 * app only (PushLinks).
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
            markPushAskOpen(true);
          }, SHOW_AFTER_MS);
        })();
      }),
    [],
  );

  function close() {
    showing.current = false;
    setReason(null);
    markPushAskOpen(false);
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
    <BottomSheet
      open={reason !== null}
      onClose={error ? close : () => undefined}
      title={t.push.askTitle[reason ?? "sent"]}
      doneLabel={error ? t.push.askLater : undefined}
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
    </BottomSheet>
  );
}
