import { useState, type ReactNode } from "react";
import { Check, Loader2, MessageSquarePlus, Mic, RotateCcw, Sparkles, Square } from "lucide-react";
import { Link } from "react-router-dom";

import type { AiPlanner } from "@/hooks/useAiPlanner";
import { useSpeechInput } from "@/hooks/useSpeechInput";
import { useLang, useT } from "@/i18n/lang";
import { cn } from "@/lib/utils";

/**
 * Planning with AI (#100): the conversation, laid out the same on a phone and
 * a computer. Before a plan, a box to write or say the event in. After it,
 * what was written, Casy's questions (an option is applied at once, "Other"
 * asks again in words), a question for each name it couldn't place, and
 * "Add details" to say more. The settings it gave are shown by the page,
 * under or beside this.
 */
export default function AiConversation({
  planner,
  members,
  summary,
  compact = false,
  className,
}: {
  /** A computer's box: tighter, so it fits the box's height where it can. */
  compact?: boolean;
  planner: AiPlanner;
  /** What Casy picked up, shown once there is a plan (a computer's PlanSummary). */
  summary?: ReactNode;
  /** The group's members, for the names Casy couldn't place. */
  members: { profileId: string; name: string; isYou: boolean }[];
  className?: string;
}) {
  const t = useT();
  const words = t.aiPlan;
  const { session, pending, error } = planner;
  const [adding, setAdding] = useState(false);
  const hasPlan = session.plan !== null;
  const footnote = (
    <>
      {session.left !== null && <>{words.left(session.left)}. </>}
      <Link to="/privacy" className="underline underline-offset-2 hover:text-foreground">
        {words.privacy}
      </Link>
    </>
  );

  return (
    <div className={cn("flex flex-col", compact ? "gap-2.5" : "gap-3", className)}>
      {/* What Casy picked up, where there's room for it (a computer); the
          words it came from fold away, since speech recognition often
          mishears and the settings are what count. */}
      {hasPlan && summary}
      {session.texts.length > 0 && (
        <div className="flex items-start justify-between gap-3">
          <details className="group text-sm text-muted-foreground">
            <summary className="w-fit cursor-pointer select-none font-medium hover:text-foreground">
              {words.youWrote}
            </summary>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {session.texts.map((text, i) => (
                <li
                  key={i}
                  className="whitespace-pre-wrap rounded-xl bg-secondary/60 px-3 py-2 text-foreground"
                >
                  {text}
                </li>
              ))}
            </ul>
          </details>
          {/* A computer's box has no line to spare for the count. */}
          {compact && hasPlan && session.left !== null && (
            <span className="shrink-0 pt-px text-xs text-muted-foreground">
              {words.left(session.left)}
            </span>
          )}
        </div>
      )}

      {session.questions.map(({ question, picked }, qi) => (
        <QuestionCard
          key={`${session.texts.length}-${qi}`}
          question={question.question}
          options={question.options.map((o) => o.label)}
          picked={picked}
          disabled={pending}
          onPick={(oi) => planner.answer(qi, oi)}
          onOther={(text) => planner.answerOther(qi, text)}
        />
      ))}

      {session.names.map((n, ni) => {
        const others = members.filter((m) => !m.isYou);
        const choices =
          n.candidates.length > 0
            ? others.filter((m) => n.candidates.includes(m.profileId))
            : others;
        return (
          <ChoiceCard
            key={`${session.texts.length}-name-${ni}`}
            question={
              n.candidates.length > 0 ? words.whoIs(n.written) : words.noOneNamed(n.written)
            }
            options={[
              ...choices.map((m) => ({ key: m.profileId, label: m.name })),
              { key: "none", label: words.noneOfThem },
            ]}
            picked={n.picked}
            onPick={(key) => planner.pickName(ni, key)}
          />
        );
      })}

      {pending ? (
        <p className="flex items-center gap-2 text-[15px] text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" />
          {words.thinking}
        </p>
      ) : !hasPlan || adding ? (
        <Composer
          // A failed answer brings back what was sent, to fix and send again.
          key={planner.failedText}
          initial={planner.failedText}
          big={!hasPlan}
          compact={compact}
          label={hasPlan ? words.morePlaceholder : words.placeholder}
          placeholder={
            hasPlan
              ? words.morePlaceholder
              : compact
                ? `${words.introTitle}. ${words.intro}\n\n${words.placeholder}`
                : words.placeholder
          }
          note={compact ? footnote : undefined}
          sendLabel={hasPlan ? words.update : words.send}
          onSend={(text) => {
            planner.describe(text);
            setAdding(false);
          }}
          onCancel={hasPlan ? () => setAdding(false) : undefined}
        />
      ) : (
        <div className={cn("flex flex-wrap items-center", compact ? "gap-1" : "gap-2")}>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border bg-card font-bold text-foreground transition hover:bg-secondary",
              compact ? "h-9 px-2.5 text-sm" : "h-10 px-3.5 text-[15px]",
            )}
          >
            <MessageSquarePlus className="h-4 w-4 text-primary" />
            {words.addDetails}
          </button>
          <button
            type="button"
            onClick={planner.reset}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground",
              compact ? "h-9 px-2 text-sm" : "h-10 px-3 text-[15px]",
            )}
          >
            <RotateCcw className="h-4 w-4" />
            {words.again}
          </button>
        </div>
      )}

      {error && <p className="text-[15px] text-red-700">{error}</p>}

      {!compact ? <p className="text-xs text-muted-foreground">{footnote}</p> : null}
    </div>
  );
}

/** The box to write (or say) a description or more details in. */
function Composer({
  initial,
  big,
  compact,
  label,
  note,
  placeholder,
  sendLabel,
  onSend,
  onCancel,
}: {
  /** What the box starts with: the text whose answer failed, or nothing. */
  initial: string;
  /** The first description: the screen's main thing, so a big box. */
  big: boolean;
  /** Sized for a computer's box rather than a phone's screen. */
  compact: boolean;
  /** What the box is, for screen readers (the placeholder may say more). */
  label: string;
  /** Small print beside the buttons (a computer's box, which has no room under it). */
  note?: ReactNode;
  placeholder: string;
  sendLabel: string;
  onSend: (text: string) => void;
  onCancel?: () => void;
}) {
  const t = useT();
  const words = t.aiPlan;
  const { lang } = useLang();
  const [draft, setDraft] = useState(initial);
  // What was typed before the microphone went on; speech is added after it.
  const [before, setBefore] = useState("");
  const speech = useSpeechInput(lang, (heard) => setDraft(before ? `${before} ${heard}` : heard));

  function send() {
    speech.stop();
    if (draft.trim()) onSend(draft);
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          "rounded-2xl border bg-card transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
          big && "border-orange-200 shadow-sm",
          speech.listening && "border-primary ring-2 ring-primary/20",
        )}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends on a computer; Shift+Enter is a new line.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          rows={big ? 6 : compact ? 2 : 3}
          maxLength={500}
          placeholder={speech.listening ? words.listening : placeholder}
          aria-label={label}
          className={cn(
            "block w-full resize-none rounded-2xl bg-transparent px-3.5 pt-3 text-foreground outline-none placeholder:text-muted-foreground",
            big && !compact ? "text-[17px] leading-relaxed" : "text-[16px] leading-6",
          )}
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          {speech.supported ? (
            <button
              type="button"
              onClick={() => {
                if (speech.listening) speech.stop();
                else {
                  setBefore(draft.trim());
                  speech.start();
                }
              }}
              aria-pressed={speech.listening}
              className={cn(
                "inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-[15px] font-bold transition",
                speech.listening
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-orange-50 text-orange-900 hover:bg-orange-100",
              )}
            >
              {speech.listening ? (
                <Square className="h-4 w-4 fill-current" />
              ) : (
                <Mic className="h-5 w-5 text-primary" />
              )}
              {speech.listening ? words.stopSpeaking : words.speak}
            </button>
          ) : (
            <span />
          )}
          {note && (
            <p className="min-w-0 flex-1 text-[11px] leading-tight text-muted-foreground">{note}</p>
          )}
          <div className="flex shrink-0 items-center gap-1">
            {onCancel && (
              <button
                type="button"
                onClick={() => {
                  speech.stop();
                  onCancel();
                }}
                className="h-10 rounded-xl px-3 text-[15px] font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                {words.cancel}
              </button>
            )}
            <button
              type="button"
              onClick={send}
              disabled={!draft.trim()}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-cta px-3.5 text-[15px] font-bold text-white transition hover:bg-cta-hover disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {sendLabel}
            </button>
          </div>
        </div>
      </div>
      {speech.error && (
        <p className="text-sm text-red-700">
          {speech.error === "denied" ? words.micDenied : words.micFailed}
          {speech.errorDetail && (
            <span className="mt-0.5 block text-xs opacity-80">({speech.errorDetail})</span>
          )}
        </p>
      )}
    </div>
  );
}

const OPTION =
  "inline-flex min-h-10 items-center rounded-xl border px-3 text-[15px] font-bold transition disabled:opacity-50";

/** A question with its options as buttons, the picked one filled. */
function ChoiceCard({
  question,
  options,
  picked,
  disabled = false,
  onPick,
  children,
}: {
  question: string;
  options: { key: string; label: string }[];
  picked: string | null;
  disabled?: boolean;
  onPick: (key: string) => void;
  children?: ReactNode;
}) {
  const [reopened, setReopened] = useState(false);
  const answer = options.find((o) => o.key === picked)?.label;
  if (answer && !reopened) {
    return (
      <button
        type="button"
        onClick={() => setReopened(true)}
        className="flex w-full items-center gap-2 rounded-2xl border bg-card px-3.5 py-2.5 text-left text-[15px] transition hover:bg-secondary"
      >
        <Check className="h-4 w-4 shrink-0 text-green-600" />
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{question}</span>
        <span className="shrink-0 font-bold text-foreground">{answer}</span>
      </button>
    );
  }
  return (
    <div className="rounded-2xl border bg-card p-3.5">
      <p className="flex items-start gap-2 text-[15px] font-bold text-foreground">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        {question}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            disabled={disabled}
            onClick={() => {
              onPick(o.key);
              setReopened(false);
            }}
            aria-pressed={picked === o.key}
            className={cn(
              OPTION,
              picked === o.key
                ? "border-cta bg-cta text-white"
                : "border-orange-200 bg-orange-50 text-orange-900 hover:bg-orange-100",
            )}
          >
            {o.label}
          </button>
        ))}
        {children}
      </div>
    </div>
  );
}

/** One of Casy's questions: its options, and "Other" to answer in words. */
function QuestionCard({
  question,
  options,
  picked,
  disabled,
  onPick,
  onOther,
}: {
  question: string;
  options: string[];
  picked: number | null;
  disabled: boolean;
  onPick: (index: number) => void;
  onOther: (text: string) => void;
}) {
  const t = useT();
  const words = t.aiPlan;
  const [other, setOther] = useState<string | null>(null);
  return (
    <ChoiceCard
      question={question}
      options={options.map((label, i) => ({ key: String(i), label }))}
      picked={picked === null ? null : String(picked)}
      disabled={disabled}
      onPick={(key) => onPick(Number(key))}
    >
      {other === null ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOther("")}
          className={cn(OPTION, "border-dashed bg-card text-muted-foreground hover:bg-secondary")}
        >
          {words.other}
        </button>
      ) : (
        <form
          className="flex w-full gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (other.trim()) onOther(other);
          }}
        >
          <input
            autoFocus
            value={other}
            maxLength={200}
            onChange={(e) => setOther(e.target.value)}
            placeholder={words.otherPlaceholder}
            className="h-10 min-w-0 flex-1 rounded-xl border bg-card px-3 text-[16px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="submit"
            disabled={disabled || !other.trim()}
            className="h-10 rounded-xl bg-cta px-3.5 text-[15px] font-bold text-white transition hover:bg-cta-hover disabled:opacity-50"
          >
            {words.answer}
          </button>
        </form>
      )}
    </ChoiceCard>
  );
}
