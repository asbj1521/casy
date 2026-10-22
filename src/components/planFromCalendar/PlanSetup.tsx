import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw, Sparkles, Users } from "lucide-react";

import AiConversation from "@/components/findDate/ai/AiConversation";
import { StepSettings } from "@/components/SchedulerSettings";
import DanishTimeNote from "@/components/time/DanishTimeNote";
import BottomSheet from "@/components/ui/BottomSheet";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import type { Planning } from "@/hooks/usePlanning";
import { useT } from "@/i18n/lang";

import DetailsStep from "./DetailsStep";
import GroupStep from "./GroupStep";

/** The two views swap with a short fade and lift. */
const SWAP = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.22, ease: "easeOut" },
} as const;

/**
 * What the Planlæg sheet on My calendar holds (#126). The settings by hand
 * first: the group, what and when, the optional details. For those Casy's AI
 * is on for, one eye-catching button above them: pressed, the AI takes over
 * the sheet (`aiMode`), the event written or said, Casy's questions answered,
 * and then the settings come back filled in, its guesses marked. From there
 * it is the settings by hand again; the AI only starts over ("Beskriv på ny"),
 * it doesn't refine.
 */
export default function PlanSetup({
  planning,
  aiMode,
  onAiMode,
}: {
  planning: Planning;
  aiMode: boolean;
  onAiMode: (on: boolean) => void;
}) {
  const t = useT();
  const {
    user,
    groups,
    activeGroup,
    activeGroupId,
    selectGroup,
    openNewGroup,
    aiOn,
    planner,
    name,
    setName,
    sched,
    updateSettingsByHand,
    extras,
    updateExtras,
    peopleChoice,
    updatePeople,
  } = planning;
  const [picking, setPicking] = useState(false);
  const planned = planner.session.plan !== null;

  return (
    <>
      <ListGroup className="mb-4 mt-0">
        <ListRow
          icon={Users}
          label={t.scheduler.group}
          value={activeGroup?.name}
          chevron
          onClick={() => setPicking(true)}
        />
      </ListGroup>

      <AnimatePresence mode="wait" initial={false}>
        {aiMode ? (
          <motion.div key="ai" {...SWAP}>
            <AiConversation
              planner={planner}
              members={activeGroup?.members ?? []}
              // No "Add details" here: once Casy has answered, the settings are yours.
              adding={false}
              onAdding={() => {}}
            />
          </motion.div>
        ) : (
          <motion.div key="manual" {...SWAP}>
            {aiOn &&
              (planned ? (
                <div className="mb-5 flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">{t.aiPlan.guessedNote}</p>
                  <button
                    type="button"
                    onClick={() => {
                      planner.reset();
                      onAiMode(true);
                    }}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border bg-card/70 px-3 text-sm font-semibold text-foreground transition hover:bg-secondary"
                  >
                    <RotateCcw className="h-4 w-4" />
                    {t.aiPlan.again}
                  </button>
                </div>
              ) : (
                <AiButton onClick={() => onAiMode(true)} label={t.aiPlan.start} />
              ))}

            <h3 className="mb-3 text-lg font-extrabold tracking-tight text-foreground">
              {t.schedulerFlow.what}
            </h3>
            <StepSettings
              name={name}
              onName={setName}
              settings={sched}
              onChange={updateSettingsByHand}
              guessed={planner.session.guessed}
            />
            <DanishTimeNote className="mt-4 px-1" />
            <DetailsStep
              extras={extras}
              onExtras={updateExtras}
              participants={{
                members: activeGroup?.members ?? [],
                choice: peopleChoice,
                onChange: updatePeople,
                meeting: !sched.multiDay,
                example: !activeGroup || activeGroup.isExample,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <BottomSheet
        open={picking}
        onClose={() => setPicking(false)}
        title={t.scheduler.group}
        doneLabel={t.schedulerFlow.done}
      >
        <GroupStep
          groups={groups}
          selectedId={activeGroupId}
          signedIn={!!user}
          onPick={(id) => {
            selectGroup(id);
            setPicking(false);
          }}
          onCreate={() => {
            setPicking(false);
            openNewGroup();
          }}
        />
      </BottomSheet>
    </>
  );
}

/**
 * Planlæg med AI as one slim button that draws the eye: Casy's orange with a
 * slow band of light across it, without taking the settings' room.
 */
function AiButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="animate-ai-shimmer mb-5 flex h-11 w-full items-center justify-center gap-2 rounded-full text-[15px] font-bold text-white shadow-[0_8px_24px_-10px_rgba(194,65,12,0.8)] transition active:scale-[0.98]"
      style={{
        backgroundImage:
          "linear-gradient(110deg, rgb(194 65 12) 0%, rgb(234 88 12) 40%, rgb(253 186 116) 50%, rgb(234 88 12) 60%, rgb(194 65 12) 100%)",
      }}
    >
      <Sparkles className="h-4 w-4" />
      {label}
    </button>
  );
}
