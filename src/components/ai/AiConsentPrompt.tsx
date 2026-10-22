import { useCallback, useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";

import { calendarStatusQuery } from "@/api/calendars";
import { whoAmIQuery } from "@/api/groups";
import Modal, { ModalPanel } from "@/components/ui/Modal";
import Notice from "@/components/ui/Notice";
import { useAuth } from "@/context/auth";
import { useAiAllowed } from "@/hooks/useAiAllowed";
import { useAiConsentSetting } from "@/hooks/useAiConsentSetting";
import { useT } from "@/i18n/lang";
import { rememberAskedAboutAi, wasAskedAboutAi } from "@/lib/aiConsent";
import { hasConnectedCalendar } from "@/lib/calendarPrompt";

/**
 * When this page load began: an answer older than this is the copy remembered
 * from an earlier visit (queryPersistence.ts), which may predate a yes given
 * on another device. The box waits for a fresh one.
 */
const LOADED_AT = Date.now();

/**
 * The one question before Casy's AI reads anything from a calendar (#120),
 * asked on My calendar for anyone the AI is on for who has a calendar
 * connected and hasn't answered yet. Nothing is ticked beforehand and "Not
 * now" is as easy as "Allow"; either way it isn't asked again (the profile's
 * row, AiConsentGroup, changes it any time). Admins and AI testers are asked
 * too, so the flow is one they can try, though they may use the AI without it.
 */
export default function AiConsentPrompt() {
  const { user } = useAuth();
  if (!user) return null;
  return <Prompt key={user.id} userId={user.id} />;
}

function Prompt({ userId }: { userId: string }) {
  const t = useT().aiConsent;
  const titleId = useId();
  const aiOn = useAiAllowed();
  const { consented, set, saving, error } = useAiConsentSetting();
  const [asked, setAsked] = useState(() => wasAskedAboutAi(userId));

  const { dataUpdatedAt } = useQuery(whoAmIQuery(userId));
  const { data: connections } = useQuery({
    ...calendarStatusQuery(userId),
    enabled: aiOn && !consented && !asked,
  });
  const open =
    aiOn &&
    !consented &&
    !asked &&
    dataUpdatedAt >= LOADED_AT &&
    !!connections &&
    hasConnectedCalendar(connections);

  const notNow = useCallback(() => {
    rememberAskedAboutAi(userId);
    setAsked(true);
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) notNow();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, saving, notNow]);

  return (
    <Modal open={open} busy={saving} onClose={notNow}>
      <ModalPanel labelledBy={titleId} className="max-w-lg sm:p-6">
        <h2 id={titleId} className="flex items-center gap-2 text-xl font-bold text-foreground">
          <Sparkles className="h-5 w-5 shrink-0 text-primary" />
          {t.title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{t.intro}</p>
        <p className="mt-3 text-sm text-muted-foreground">{t.sent}</p>
        <p className="mt-3 text-sm text-muted-foreground">{t.shared}</p>
        <p className="mt-3 text-sm text-muted-foreground">{t.corrections}</p>
        <p className="mt-3 text-sm text-muted-foreground">{t.safe}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          {t.privateNote} {t.readMore}{" "}
          <Link to="/privacy#ai" className="underline underline-offset-2 hover:text-foreground">
            {t.privacyLink}
          </Link>
          .
        </p>

        {error && (
          <Notice tone="error" className="mt-4">
            {error}
          </Notice>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => set(true)}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? t.saving : t.allow}
          </button>
          <button
            type="button"
            onClick={notNow}
            disabled={saving}
            className="rounded-full border bg-background px-5 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary disabled:opacity-60"
          >
            {t.notNow}
          </button>
        </div>
      </ModalPanel>
    </Modal>
  );
}
