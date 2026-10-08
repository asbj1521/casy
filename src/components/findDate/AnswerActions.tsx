import { Check, ChevronLeft, Loader2, Send } from "lucide-react";

import { useT } from "@/i18n/lang";

/**
 * Step back, step on, and send the date to the group (or first sign off the
 * time off it costs you). Drawn in the answer card on wider screens and in
 * the bar pinned to the bottom of the phone's flow, so it is a fragment for
 * either. The flow lists the dates instead of stepping through them, so it
 * leaves the stepping out (`stepping`).
 */
export default function AnswerActions({
  stepping = true,
  canStepBack,
  canStepOn,
  onStepBack,
  onStepOn,
  approving,
  onAccept,
  canSuggest,
  checking,
  suggesting,
  suggested,
  onSuggest,
}: {
  stepping?: boolean;
  canStepBack: boolean;
  canStepOn: boolean;
  onStepBack: () => void;
  onStepOn: () => void;
  /** The date costs you time off you haven't signed off yet: "Accept" first. */
  approving: boolean;
  onAccept: () => void;
  canSuggest: boolean;
  /** Making sure everyone's calendars are fresh before the date goes (#85). */
  checking: boolean;
  suggesting: boolean;
  /** This exact date has just gone to the group. */
  suggested: boolean;
  onSuggest: () => void;
}) {
  const t = useT();
  return (
    <>
      {stepping && (
        <>
          <button
            type="button"
            onClick={onStepBack}
            disabled={!canStepBack}
            aria-label={t.scheduler.previousTime}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-card text-foreground transition hover:bg-secondary disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onStepOn}
            disabled={!canStepOn}
            className="h-12 min-w-0 flex-1 truncate rounded-xl border bg-card px-3 text-[15px] font-semibold text-foreground transition hover:bg-secondary disabled:opacity-30 sm:flex-none sm:px-4"
          >
            <span className="sm:hidden">{t.scheduler.nextShort}</span>
            <span className="hidden sm:inline">{t.scheduler.nextOption}</span>
          </button>
        </>
      )}
      {approving ? (
        <button
          type="button"
          onClick={onAccept}
          className="inline-flex h-12 min-w-0 flex-[2] items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-[15px] font-bold text-white transition hover:bg-amber-700 sm:flex-none sm:px-5"
        >
          <Check className="h-5 w-5 shrink-0" />
          {t.scheduler.accept}
        </button>
      ) : (
        <button
          type="button"
          onClick={onSuggest}
          disabled={!canSuggest || checking || suggesting || suggested}
          className="inline-flex h-12 min-w-0 flex-[2] items-center justify-center gap-2 rounded-xl bg-orange-700 px-4 text-[15px] font-bold text-white transition hover:bg-orange-800 disabled:opacity-50 sm:flex-none sm:px-5"
        >
          {checking || suggesting ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
          ) : suggested ? (
            <Check className="h-5 w-5 shrink-0" />
          ) : (
            <Send className="h-5 w-5 shrink-0" />
          )}
          <span className="truncate">
            {suggested ? (
              stepping ? (
                t.scheduler.suggested
              ) : (
                t.schedulerFlow.sent
              )
            ) : !stepping ? (
              // The phone flow's last step, where this is the only button:
              // room to say what it does in so many words.
              checking ? (
                t.scheduler.checking
              ) : (
                t.schedulerFlow.send
              )
            ) : checking ? (
              <>
                <span className="sm:hidden">{t.scheduler.checkingShort}</span>
                <span className="hidden sm:inline">{t.scheduler.checking}</span>
              </>
            ) : (
              <>
                <span className="sm:hidden">{t.scheduler.suggestShort}</span>
                <span className="hidden sm:inline">{t.scheduler.suggest}</span>
              </>
            )}
          </span>
        </button>
      )}
    </>
  );
}
