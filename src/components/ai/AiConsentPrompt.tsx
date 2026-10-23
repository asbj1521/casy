import { useCallback, useEffect, useId, useRef, useState } from "react";
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

  // Which page is showing: read from where the pages have been scrolled to.
  const track = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const onScroll = () => {
    const el = track.current;
    if (el && el.clientWidth > 0) setPage(Math.round(el.scrollLeft / el.clientWidth));
  };
  const goTo = (i: number) => {
    const el = track.current;
    if (!el) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: i * el.clientWidth, behavior: still ? "auto" : "smooth" });
  };

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

  const pages = [
    <p key="gives">{t.intro}</p>,
    <p key="sent">{t.sent}</p>,
    <div key="receives" className="space-y-3">
      <p>{t.shared}</p>
      <p>{t.corrections}</p>
    </div>,
    <div key="control" className="space-y-3">
      <p>{t.safe}</p>
      <p>
        {t.privateNote} {t.readMore}{" "}
        <Link to="/privacy#ai" className="underline underline-offset-2 hover:text-foreground">
          {t.privacyLink}
        </Link>
        .
      </p>
    </div>,
  ];
  const last = page === pages.length - 1;

  return (
    <Modal open={open} busy={saving} onClose={notNow}>
      <ModalPanel labelledBy={titleId} className="max-w-lg sm:p-6">
        <h2 id={titleId} className="flex items-center gap-2 text-xl font-bold text-foreground">
          <Sparkles className="h-5 w-5 shrink-0 text-primary" />
          {t.title}
        </h2>

        {/* The pages sit side by side and snap into place, so a swipe or a
            trackpad turns them; the box is as tall as the longest, so it never
            jumps. A page out of sight can't be tabbed into. */}
        <div
          ref={track}
          onScroll={onScroll}
          className="-mx-1 mt-4 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {pages.map((body, i) => (
            <section
              key={i}
              inert={i !== page}
              aria-label={t.pageDot(i + 1, pages.length)}
              className="w-full shrink-0 snap-start px-1 text-sm text-muted-foreground"
            >
              <h3 className="mb-2 text-[15px] font-semibold text-foreground">{t.pages[i]}</h3>
              {body}
            </section>
          ))}
        </div>

        <div className="mt-4 flex justify-center gap-2">
          {pages.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={t.pageDot(i + 1, pages.length)}
              aria-current={i === page ? "step" : undefined}
              className="-m-1.5 p-1.5"
            >
              <span
                className={`block h-2 rounded-full transition-all ${
                  i === page ? "w-5 bg-primary" : "w-2 bg-muted-foreground/30"
                }`}
              />
            </button>
          ))}
        </div>

        {error && (
          <Notice tone="error" className="mt-4">
            {error}
          </Notice>
        )}

        <div className="mt-5 flex items-center gap-3">
          {last ? (
            <button
              type="button"
              onClick={() => set(true)}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? t.saving : t.allow}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => goTo(page + 1)}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              {t.next}
            </button>
          )}
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
