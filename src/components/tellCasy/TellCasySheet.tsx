import { useState, type ReactNode, type RefObject } from "react";
import { Clock, Loader2, MessageSquarePlus, Plane, RotateCcw, Trash2, X } from "lucide-react";

import { Composer } from "@/components/findDate/ai/AiConversation";
import FlowButton from "@/components/ui/FlowButton";
import GlassButton from "@/components/ui/GlassButton";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import Notice from "@/components/ui/Notice";
import Sheet from "@/components/ui/Sheet";
import { useTellCasy, type TellCasy } from "@/hooks/useTellCasy";
import { useLang, useT } from "@/i18n/lang";
import { entryWhen, type CasyEntry, type StoredEntry } from "@/lib/casyEntries";

/**
 * Tell Casy (#116): say or write when you are away or busy and it is in no
 * calendar, check what Casy made of it, and keep it. On a phone a glass sheet
 * dropping from the plus at the top of My calendar (#169), clear of the
 * keyboard; a dialog on a computer (ui/Sheet, #153). What is kept is
 * listed under, each with a delete: it counts in every search and shows on
 * My calendar until then.
 */
export default function TellCasySheet({
  open,
  onClose,
  kept,
  origin,
}: {
  open: boolean;
  onClose: () => void;
  /** The plus it drops out of (#169). */
  origin?: RefObject<HTMLElement | null>;
  /** The entries already kept (from My calendar's data). */
  kept: StoredEntry[];
}) {
  const t = useT();
  const tell = useTellCasy();
  const { session, pending } = tell;
  const [adding, setAdding] = useState(false);
  // Casy's reading on screen, waiting to be kept: the sheet's main button.
  const proposing = session.texts.length > 0 && session.entries.length > 0 && !pending && !adding;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t.tellCasy.title}
      closeLabel={t.tellCasy.done}
      origin={origin}
      edge="top"
      // Always a footer (switching layouts would slide the sheet in again);
      // the button only while Casy's reading waits to be kept.
      footer={
        <>
          {proposing && (
            <FlowButton onClick={tell.save} busy={tell.saving}>
              {tell.saving ? t.tellCasy.saving : t.tellCasy.save(session.entries.length)}
            </FlowButton>
          )}
        </>
      }
    >
      <TellCasyBody kept={kept} tell={tell} adding={adding} onAdding={setAdding} />
    </Sheet>
  );
}

function TellCasyBody({
  kept,
  tell,
  adding,
  onAdding,
}: {
  kept: StoredEntry[];
  tell: TellCasy;
  adding: boolean;
  onAdding: (adding: boolean) => void;
}) {
  const t = useT();
  const words = t.tellCasy;
  const { session, pending, error } = tell;
  const started = session.texts.length > 0;
  const left = session.left !== null ? <>{t.aiPlan.left(session.left)}.</> : null;

  return (
    <div className="flex flex-col gap-3">
      {!started ? (
        pending ? (
          <Thinking />
        ) : (
          <>
            <p className="px-1 text-[15px] text-muted-foreground">{words.rowDetail}</p>
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
          {session.entries.length > 0 ? (
            <ListGroup title={words.understood} className="mt-0">
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
                      className="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  }
                />
              ))}
            </ListGroup>
          ) : (
            !session.message && (
              <p className="px-1 text-[15px] text-muted-foreground">{words.nothingFound}</p>
            )
          )}
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
                onAdding(false);
              }}
              onCancel={session.entries.length > 0 ? () => onAdding(false) : undefined}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <GlassButton
                size="sm"
                icon={MessageSquarePlus}
                onClick={() => onAdding(true)}
                disabled={tell.saving}
              >
                {words.addDetails}
              </GlassButton>
              <GlassButton size="sm" icon={RotateCcw} onClick={tell.reset} disabled={tell.saving}>
                {words.again}
              </GlassButton>
            </div>
          )}
        </>
      )}

      {error && <Notice tone="error">{error}</Notice>}
      {tell.saveError && <Notice tone="error">{tell.saveError}</Notice>}
      {left && <p className="px-1 text-xs text-muted-foreground">{left}</p>}

      {kept.length > 0 && (
        <ListGroup title={words.kept} footnote={words.keptNote} className="mt-3">
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
                  className="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-red-700 disabled:opacity-50"
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
        </ListGroup>
      )}
      {tell.deleteError && <Notice tone="error">{tell.deleteError}</Notice>}
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

/** One entry as a row: what kind, what it is called, and when. */
function EntryRow({ entry, action }: { entry: CasyEntry; action: ReactNode }) {
  const { lang } = useLang();
  const words = useT().tellCasy;
  return (
    <ListRow
      icon={entry.kind === "away" ? Plane : Clock}
      label={entry.label}
      detail={`${words.kinds[entry.kind]} · ${entryWhen(entry, lang)}`}
      trailing={action}
    />
  );
}
