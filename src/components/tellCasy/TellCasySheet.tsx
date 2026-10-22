import { useEffect, useId, useState, type ReactNode } from "react";
import { Clock, Loader2, MessageSquarePlus, Plane, RotateCcw, Trash2, X } from "lucide-react";

import { Composer } from "@/components/findDate/ai/AiConversation";
import BottomSheet from "@/components/ui/BottomSheet";
import Modal, { ModalPanel } from "@/components/ui/Modal";
import Notice from "@/components/ui/Notice";
import { useTellCasy, type TellCasy } from "@/hooks/useTellCasy";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useLang, useT } from "@/i18n/lang";
import { entryWhen, type CasyEntry, type StoredEntry } from "@/lib/casyEntries";

/**
 * Tell Casy (#116): say or write when you are away or busy and it is in no
 * calendar, check what Casy made of it, and keep it. A sheet from the bottom
 * on a phone, a dialog on a computer. What is kept is listed under, each
 * with a delete: it counts in every search and shows on My calendar until
 * then.
 */
export default function TellCasySheet({
  open,
  onClose,
  kept,
}: {
  open: boolean;
  onClose: () => void;
  /** The entries already kept (from My calendar's data). */
  kept: StoredEntry[];
}) {
  const t = useT();
  const phone = usePhoneLayout();
  const tell = useTellCasy();
  const headingId = useId();
  // The phone's sheet closes on Esc by itself; a computer's dialog does here.
  useEffect(() => {
    if (!open || phone) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, phone, onClose]);

  const body = <TellCasyBody kept={kept} tell={tell} />;
  if (phone) {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title={t.tellCasy.title}
        doneLabel={t.tellCasy.done}
      >
        {body}
      </BottomSheet>
    );
  }
  return (
    <Modal open={open} onClose={onClose}>
      <ModalPanel className="max-w-lg" labelledBy={headingId}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id={headingId} className="text-lg font-bold text-foreground">
            {t.tellCasy.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.tellCasy.done}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {body}
      </ModalPanel>
    </Modal>
  );
}

function TellCasyBody({ kept, tell }: { kept: StoredEntry[]; tell: TellCasy }) {
  const t = useT();
  const words = t.tellCasy;
  const { session, pending, error } = tell;
  const started = session.texts.length > 0;
  const [adding, setAdding] = useState(false);
  const left = session.left !== null ? <>{t.aiPlan.left(session.left)}.</> : null;

  return (
    <div className="flex flex-col gap-3">
      {!started ? (
        pending ? (
          <Thinking />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{words.intro}</p>
            <Composer
              // A failed answer brings back what was sent, to fix and send again.
              key={tell.failedText}
              initial={tell.failedText}
              big
              compact={false}
              label={words.placeholder}
              placeholder={words.placeholder}
              sendLabel={words.send}
              onSend={tell.describe}
            />
          </>
        )
      ) : (
        <>
          <section aria-label={words.understood} className="flex flex-col gap-2">
            <h3 className="text-sm font-bold text-foreground">{words.understood}</h3>
            {session.entries.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {session.entries.map((entry, i) => (
                  <EntryRow
                    key={`${entry.start}-${entry.label}-${i}`}
                    entry={entry}
                    action={
                      <button
                        type="button"
                        onClick={() => tell.drop(i)}
                        disabled={pending || tell.saving}
                        aria-label={words.leaveOut(entry.label)}
                        title={words.leaveOut(entry.label)}
                        className="rounded-lg p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    }
                  />
                ))}
              </ul>
            ) : (
              !session.message && (
                <p className="text-sm text-muted-foreground">{words.nothingFound}</p>
              )
            )}
          </section>
          {session.message && <Notice tone="info">{session.message}</Notice>}

          {pending ? (
            <Thinking />
          ) : adding || session.entries.length === 0 ? (
            <Composer
              key={tell.failedText}
              initial={tell.failedText}
              big={false}
              compact={false}
              label={words.morePlaceholder}
              placeholder={words.morePlaceholder}
              sendLabel={words.update}
              onSend={(text) => {
                tell.describe(text);
                setAdding(false);
              }}
              onCancel={session.entries.length > 0 ? () => setAdding(false) : undefined}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={tell.save}
                disabled={tell.saving}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-cta px-4 text-[15px] font-bold text-white transition hover:bg-cta-hover disabled:opacity-50"
              >
                {tell.saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {tell.saving ? words.saving : words.save(session.entries.length)}
              </button>
              <button
                type="button"
                onClick={() => setAdding(true)}
                disabled={tell.saving}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border bg-card px-3.5 text-[15px] font-bold text-foreground transition hover:bg-secondary disabled:opacity-50"
              >
                <MessageSquarePlus className="h-4 w-4 text-primary" />
                {words.addDetails}
              </button>
              <button
                type="button"
                onClick={tell.reset}
                disabled={tell.saving}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-[15px] font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" />
                {words.again}
              </button>
            </div>
          )}
        </>
      )}

      {error && <Notice tone="error">{error}</Notice>}
      {tell.saveError && <Notice tone="error">{tell.saveError}</Notice>}
      {left && <p className="text-xs text-muted-foreground">{left}</p>}

      {kept.length > 0 && (
        <section aria-label={words.kept} className="mt-1 flex flex-col gap-2 border-t pt-3">
          <h3 className="text-sm font-bold text-foreground">{words.kept}</h3>
          <ul className="flex flex-col gap-2">
            {kept.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                action={
                  <button
                    type="button"
                    onClick={() => tell.deleteEntry(entry.id)}
                    disabled={tell.deletingId === entry.id}
                    aria-label={words.remove(entry.label)}
                    title={words.remove(entry.label)}
                    className="rounded-lg p-2 text-muted-foreground transition hover:bg-secondary hover:text-red-700 disabled:opacity-50"
                  >
                    {tell.deletingId === entry.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                }
              />
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">{words.keptNote}</p>
          {tell.deleteError && <Notice tone="error">{tell.deleteError}</Notice>}
        </section>
      )}
    </div>
  );
}

function Thinking() {
  const words = useT().tellCasy;
  return (
    <p className="flex items-center gap-2 text-[15px] text-muted-foreground" role="status">
      <Loader2 className="h-4 w-4 animate-spin" />
      {words.thinking}
    </p>
  );
}

/** One entry: what kind, what it is called, and when. */
function EntryRow({ entry, action }: { entry: CasyEntry; action: ReactNode }) {
  const { lang } = useLang();
  const words = useT().tellCasy;
  const Icon = entry.kind === "away" ? Plane : Clock;
  return (
    <li className="flex items-center gap-3 rounded-2xl border bg-card px-3.5 py-2.5">
      <Icon aria-hidden className="h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold text-foreground">{entry.label}</p>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium">{words.kinds[entry.kind]}</span>
          {" · "}
          {entryWhen(entry, lang)}
        </p>
      </div>
      {action}
    </li>
  );
}
