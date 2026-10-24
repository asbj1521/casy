import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { SlidersHorizontal, Sparkles } from "lucide-react";

import { PlaceNoteSettings, VoteSettings } from "@/components/findDate/EventExtraSettings";
import ParticipantSettings, {
  type ParticipantProps,
} from "@/components/findDate/ParticipantSettings";
import { useT } from "@/i18n/lang";
import { type EventExtras } from "@/lib/scheduler";
import type { PlanField } from "@/lib/aiPlan";
import { cn } from "@/lib/utils";
import { MAX_NAME_LENGTH, type Props, TABS, type Tab } from "./options";
import { TimeSettings } from "./parts";

/**
 * The computer's settings box, beside the answer (#98): the group and the
 * name always in view, everything else in tabs. Every tab is drawn in the
 * same grid cell, the hidden ones invisible, so the box is always as tall
 * as its tallest tab: switching tabs never moves the chart below.
 */
export function SettingsPanel({
  groupSwitcher,
  name,
  onName,
  settings,
  onChange,
  extras,
  onExtras,
  participants,
  ai,
  onOverChart,
  className,
}: Props & {
  /** The place, note and vote settings (#84, #99). */
  extras: EventExtras;
  onExtras: (patch: Partial<EventExtras>) => void;
  /** Who the event is for (#89). */
  participants: ParticipantProps;
  /**
   * Planning with AI (#100), for someone signed in: the view that takes the
   * whole box (given a way back to the settings), and what Casy guessed, to
   * mark on Tidspunkt.
   */
  ai?: {
    view: (close: () => void) => ReactNode;
    guessed: readonly PlanField[];
    /** Once Casy has answered: "Add details" and "Start over", in the top row (#124). */
    actions?: ReactNode;
  };
  /** Whether the AI's panel reaches down over the chart, for the page to fade it (#124). */
  onOverChart?: (over: boolean) => void;
  className?: string;
}) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("time");
  const [aiOpen, setAiOpen] = useState(false);
  // Whether the AI's panel has grown past the box, to lift it with a shadow.
  const [grown, setGrown] = useState(false);
  const boxRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const panel = panelRef.current;
    const box = boxRef.current;
    if (!aiOpen || !panel || !box) return;
    // Called once on observing, and again on every change of either size.
    const observer = new ResizeObserver(() => setGrown(panel.offsetHeight > box.offsetHeight + 4));
    observer.observe(panel);
    observer.observe(box);
    return () => {
      observer.disconnect();
      setGrown(false);
    };
  }, [aiOpen]);
  useEffect(() => onOverChart?.(grown), [grown, onOverChart]);
  const id = useId();

  // Left and right move between tabs, as in any tab list.
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = TABS[(TABS.indexOf(tab) + step + TABS.length) % TABS.length];
    setTab(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  }
  const closeAi = () => {
    setAiOpen(false);
    setTab("time");
  };
  // The same width and place in the AI view below, so the picker never moves.
  const group = <div className="w-60 shrink-0 2xl:w-72">{groupSwitcher}</div>;

  return (
    <section
      ref={boxRef}
      className={cn(
        "relative hidden flex-col rounded-2xl border bg-card p-5 shadow-sm xl:flex",
        className,
      )}
    >
      {/* The settings stay drawn under the AI's view, unseen, so the box keeps
          the height they give it and the chart below never moves. */}
      <div
        className={cn("flex flex-1 flex-col", aiOpen && "invisible")}
        inert={aiOpen}
        aria-hidden={aiOpen}
      >
        <div className="flex items-center gap-4">
          {group}
          <label className="min-w-0 flex-1">
            <input
              type="text"
              aria-label={t.scheduler.name}
              value={name}
              maxLength={MAX_NAME_LENGTH}
              onChange={(e) => onName(e.target.value)}
              placeholder={t.scheduler.namePlaceholder}
              className="h-[42px] w-full rounded-lg border bg-card px-3.5 text-base font-bold text-foreground outline-none transition placeholder:font-medium placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          {ai && (
            <button
              type="button"
              onClick={() => setAiOpen(true)}
              className="inline-flex h-[42px] shrink-0 items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 text-sm font-bold text-orange-900 transition hover:bg-orange-100"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              {t.aiPlan.start}
            </button>
          )}
        </div>

        <div
          role="tablist"
          aria-label={t.settingsPanel.tabsLabel}
          onKeyDown={onKeyDown}
          className="mt-3 flex gap-1 overflow-x-auto border-b"
        >
          {TABS.map((key) => (
            <button
              key={key}
              id={`${id}-tab-${key}`}
              type="button"
              role="tab"
              aria-selected={tab === key}
              aria-controls={`${id}-panel-${key}`}
              tabIndex={tab === key ? 0 : -1}
              onClick={() => setTab(key)}
              className={cn(
                "-mb-px whitespace-nowrap border-b-2 px-2 pb-2 pt-1 text-sm font-semibold transition-colors 2xl:px-3",
                tab === key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.settingsPanel.tabs[key]}
            </button>
          ))}
        </div>

        <div className="mt-3 grid flex-1">
          {TABS.map((key) => (
            <div
              key={key}
              id={`${id}-panel-${key}`}
              role="tabpanel"
              aria-labelledby={`${id}-tab-${key}`}
              aria-hidden={tab !== key}
              // inert keeps a hidden tab's controls out of reach; invisible keeps its size.
              inert={tab !== key}
              className={cn("[grid-area:1/1]", tab !== key && "invisible")}
            >
              {key === "time" ? (
                <TimeSettings settings={settings} onChange={onChange} guessed={ai?.guessed} />
              ) : key === "people" ? (
                <ParticipantSettings {...participants} />
              ) : key === "place" ? (
                <PlaceNoteSettings extras={extras} onChange={onExtras} />
              ) : (
                <VoteSettings extras={extras} onChange={onExtras} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Planning with AI (#100): the whole box, the group still at hand. It
          is as tall as the box, and when Casy's questions need more room it
          reaches down over the chart, as far as it needs and no further than
          near the bottom of the window (then it scrolls); the answer stays in
          view beside it, and closing it leaves the page as it was. */}
      {ai && aiOpen && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t.aiPlan.start}
          onKeyDown={(e) => {
            if (e.key === "Escape") closeAi();
          }}
          className={cn(
            "absolute -left-px -right-px -top-px z-20 flex max-h-[min(44rem,calc(100dvh_-_8rem))] min-h-[calc(100%_+_2px)] flex-col rounded-2xl border bg-card p-5 transition-shadow",
            grown ? "shadow-xl" : "shadow-sm",
          )}
        >
          <div className="flex items-center gap-4">
            {group}
            {/* Once Casy has answered, the row's room goes to what can be
                done next; the heading stays for screen readers. */}
            <h2
              className={cn(
                "h-[42px] min-w-0 flex-1 items-center gap-1.5 text-base font-extrabold text-foreground",
                ai.actions ? "sr-only" : "flex",
              )}
            >
              <Sparkles className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{t.aiPlan.start}</span>
            </h2>
            {ai.actions && <div className="min-w-0 flex-1">{ai.actions}</div>}
            <button
              type="button"
              onClick={closeAi}
              className="inline-flex h-[42px] shrink-0 items-center gap-1.5 rounded-lg border bg-card px-3 text-sm font-bold text-foreground transition hover:bg-secondary"
            >
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              {t.aiPlan.backToSettings}
            </button>
          </div>
          <div className="mt-3 min-h-0 overflow-y-auto">{ai.view(closeAi)}</div>
        </div>
      )}
    </section>
  );
}
