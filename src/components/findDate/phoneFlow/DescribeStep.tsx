import type { ParticipantProps } from "@/components/findDate/ParticipantSettings";
import AiConversation from "@/components/findDate/ai/AiConversation";
import { StepSettings } from "@/components/SchedulerSettings";
import DanishTimeNote from "@/components/time/DanishTimeNote";
import type { AiPlanner } from "@/hooks/useAiPlanner";
import { useT } from "@/i18n/lang";
import type { EventExtras, SchedulerSettings } from "@/lib/scheduler";

import DetailsStep from "./DetailsStep";

/**
 * The AI flow's middle step (#100): the event written or said, Casy's
 * questions, and then the settings it gave, right here to check and adjust,
 * with its guesses marked. "Add details" asks again in words; the button
 * below moves on to the dates, as the normal flow's last step.
 */
export default function DescribeStep({
  planner,
  members,
  name,
  onName,
  settings,
  onChange,
  extras,
  onExtras,
  participants,
}: {
  planner: AiPlanner;
  members: { profileId: string; name: string; isYou: boolean }[];
  name: string;
  onName: (name: string) => void;
  settings: SchedulerSettings;
  onChange: (patch: Partial<SchedulerSettings>) => void;
  extras: EventExtras;
  onExtras: (patch: Partial<EventExtras>) => void;
  participants: ParticipantProps;
}) {
  const t = useT();
  const { plan, guessed } = planner.session;

  return (
    <>
      <AiConversation planner={planner} members={members} />

      {plan && (
        <section className="mt-8">
          <h3 className="text-lg font-extrabold tracking-tight text-foreground">
            {t.aiPlan.understood}
          </h3>
          {guessed.length > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">{t.aiPlan.guessedNote}</p>
          )}
          <div className="mt-4">
            <StepSettings
              name={name}
              onName={onName}
              settings={settings}
              onChange={onChange}
              guessed={guessed}
            />
            <DanishTimeNote className="mt-4 px-1" />
          </div>
          <DetailsStep extras={extras} onExtras={onExtras} participants={participants} />
        </section>
      )}
    </>
  );
}
