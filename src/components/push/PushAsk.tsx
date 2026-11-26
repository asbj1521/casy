import { useEffect, useRef, useState } from "react";

import BottomSheet from "@/components/ui/BottomSheet";
import FlowButton from "@/components/ui/FlowButton";
import Notice from "@/components/ui/Notice";
import { useNativeScreen, useNativeScreenKnown } from "@/hooks/useNativeScreen";
import { useNativeSheet } from "@/hooks/useNativeSheet";
import { useLang, useT } from "@/i18n/lang";
import { reviewAskedAt } from "@/lib/appReview";
import { APP_BUILD } from "@/lib/feedback";
import { askPushInApp, handAsksToApp } from "@/lib/nativeBridge";
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
 * The parity build (#281) asks from its address (`?pushAsk=sent`), so a test
 * opens it on the web and natively alike, whatever iOS has been asked.
 */
function parityAsk(): AskReason | null {
  if (APP_BUILD !== "parity") return null;
  const asked = new URLSearchParams(location.search).get("pushAsk");
  return asked === "sent" || asked === "answered" || asked === "joined" ? asked : null;
}

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
  const [reason, setReason] = useState<AskReason | null>(parityAsk);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showing = useRef(reason !== null);
  // Where the app decides when to ask (#202), each moment goes to it; what this
  // page counted before is handed over once.
  const appAsks = useNativeScreenKnown("asks");
  const appAsksNow = useRef(appAsks);
  useEffect(() => {
    appAsksNow.current = appAsks;
    if (!appAsks) return;
    const { asked, last } = readAskState();
    handAsksToApp({
      pushAsked: asked,
      pushLast: last ?? undefined,
      reviewAsked: reviewAskedAt() ?? undefined,
    }).catch(() => {});
  }, [appAsks]);

  useEffect(
    () =>
      onAskForPush((next) => {
        if (appAsksNow.current) {
          askPushInApp(next).catch(() => {});
          return;
        }
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

  // The app may draw it natively (#200): when is still decided here, and
  // its button turns notifications on through the page, as this one does.
  const native = useNativeScreen("push");
  // Couldn't be shown natively: the page's own sheet asks instead.
  const [nativeFailed, setNativeFailed] = useState(false);
  const drawnNatively = native && !nativeFailed;
  useNativeSheet(
    "push",
    reason !== null && drawnNatively,
    close,
    () => setNativeFailed(true),
    () => ({
      reason,
    }),
  );

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
      open={reason !== null && !drawnNatively}
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
