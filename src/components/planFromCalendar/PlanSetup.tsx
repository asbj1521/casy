import { useEffect, useRef, useState, type ReactNode } from "react";
import { Star } from "lucide-react";

import { usePrimeWhen } from "@/hooks/usePrimeWhen";

import DanishTimeNote from "@/components/time/DanishTimeNote";
import type { Planning } from "@/hooks/usePlanning";
import { useLang, useT } from "@/i18n/lang";
import { capitalize, dayLabel } from "@/lib/format";
import type { AiPlan } from "@/lib/aiPlan";
import { flexAround, flexOf } from "@/lib/startFlex";

import { useAiConsentGate } from "@/hooks/useAiConsentGate";
import AiQuestionsSheet from "./AiQuestionsSheet";
import GroupRow from "./GroupRow";
import HowManyRow from "./HowManyRow";
import NameField from "./NameField";
import PlanMonths from "./PlanMonths";
import TimeRows from "./TimeRows";
import { useAiFill, type PlanState } from "./useAiFill";

/**
 * What the Planlæg sheet on My calendar holds (#126), decisions first (#173):
 * the group, the name, the time as rows, the months in view, and the rest
 * folded behind "Flere detaljer". For those Casy's AI is on for, the name
 * field is also where it is asked (NameField's ✨): what is written goes to
 * Casy, its questions (if any) drop from the field (AiQuestionsSheet), and
 * then the sheet fills itself in before your eyes (useAiFill), its guesses
 * marked. Every setting stays yours to change by hand after.
 *
 * The group shares its row with Genveje (#175), which is as wide as its word. A
 * genvej's own editor shows the plan without the group, who in it is coming or
 * the months (a genvej has none of them: it runs with the group chosen, from
 * today), its times in their place (`editor`).
 */
export default function PlanSetup({
  planning,
  onShortcuts,
  editor,
}: {
  planning: Planning;
  /** Genveje beside the group (#175); none in a genvej's own editor. */
  onShortcuts?: () => void;
  /** A genvej's editor (#175): no group and no months, its times (`top`) in the group's place. */
  editor?: { top: ReactNode };
}) {
  const t = useT();
  const { lang } = useLang();
  const {
    activeGroup,
    aiOn,
    planner,
    name,
    setName,
    sched,
    updateSettings,
    updateSettingsByHand,
    extras,
    peopleChoice,
  } = planning;
  const members = activeGroup?.members ?? [];

  const fill = useAiFill({ name, settings: sched, extras, people: peopleChoice });
  // The sheet as it was when Casy was asked, played forward once it has answered.
  const before = useRef<PlanState | null>(null);
  const [asking, setAsking] = useState(false);
  const consent = useAiConsentGate();
  const field = useRef<HTMLDivElement>(null);
  // Names aren't asked about here: the phone leaves nobody out by name (#260).
  const needsAnswers = (plan: AiPlan) => plan.questions.length > 0;

  function askAi() {
    consent.guard(() => {
      const from: PlanState = { name, settings: sched, extras, people: peopleChoice };
      planner.describe(name, {
        fresh: true,
        onAnswer: (plan) => {
          before.current = from;
          if (needsAnswers(plan)) {
            fill.hold(from);
            setAsking(true);
          } else fill.start(from);
        },
      });
    });
  }
  function questionsDone() {
    if (!asking) return;
    setAsking(false);
    if (before.current) fill.start(before.current);
  }

  // The phone's rows know a start as an hour give or take: a window Casy's
  // AI (or a widened search) chose is put in that shape (flexAround).
  useEffect(() => {
    if (!sched.multiDay && !sched.anyTime && sched.startWindow && flexOf(sched) === null) {
      updateSettings(flexAround(sched.startWindow));
    }
  }, [sched, updateSettings]);

  const shown = fill.settings ?? sched;
  // A starred day's free hours (#243), while it is the day being planned.
  const primeWhen = usePrimeWhen(planning.prime);

  return (
    <>
      {/* Nothing to press while Casy fills the sheet in. */}
      <div inert={fill.active || planner.pending}>
        {editor ? (
          <>
            {/* A genvej: its name first, plain, then its times (#175). */}
            <NameField
              value={name}
              onChange={setName}
              ai={null}
              fieldRef={field}
              lit={false}
              label={t.shortcuts.nameLabel}
              placeholder={t.shortcuts.namePlaceholder}
            />
            {editor.top && <div className="mt-4">{editor.top}</div>}
          </>
        ) : (
          <>
            {/* Planning a starred day (#243): which, and when everyone is free, said first. */}
            {planning.prime && (
              <p className="mb-3 flex items-center gap-2 px-1 text-[0.9375rem] text-foreground">
                <Star aria-hidden className="h-4 w-4 shrink-0 fill-primary text-primary" />
                <span className="min-w-0">
                  <span className="font-semibold">{t.prime.title}</span>
                  {" · "}
                  {capitalize(dayLabel(new Date(planning.prime.day), lang))}
                  {primeWhen && `, ${primeWhen}`}
                </span>
              </p>
            )}
            <div className="flex gap-3">
              <GroupRow planning={planning} className="mt-0 min-w-0 flex-1" />
              {onShortcuts && (
                <button
                  type="button"
                  onClick={onShortcuts}
                  className="flex shrink-0 items-center justify-center rounded-2xl border bg-card px-3.5 text-[0.9375rem] font-medium text-primary transition-colors active:bg-secondary"
                >
                  {t.shortcuts.title}
                </button>
              )}
            </div>
            <NameField
              value={fill.name ?? name}
              onChange={setName}
              ai={aiOn ? { pending: planner.pending, error: planner.error, onAsk: askAi } : null}
              fieldRef={field}
              lit={fill.lit === "name"}
            />
          </>
        )}

        <TimeRows
          anyTimeLabel={primeWhen && capitalize(primeWhen)}
          settings={shown}
          onChange={updateSettingsByHand}
          lit={fill.lit}
          drive={fill.active ? { sheet: fill.sheet, press: fill.press } : null}
        />
        {!editor && (
          <PlanMonths
            value={shown.period}
            onChange={(period) => updateSettingsByHand({ period })}
            lit={fill.lit === "months"}
          />
        )}
        {!editor && <HowManyRow planning={planning} />}
        <DanishTimeNote className="mt-3 px-1 text-xs" />
      </div>

      {consent.sheet}
      {aiOn && (
        <AiQuestionsSheet
          open={asking}
          planner={planner}
          members={members}
          origin={field}
          onDone={questionsDone}
        />
      )}
    </>
  );
}
