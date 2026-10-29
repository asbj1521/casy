import type { RefObject } from "react";

import BottomSheet from "@/components/ui/BottomSheet";
import { ListGroup, ListPickRow } from "@/components/ui/ListGroup";
import type { AiPlanner } from "@/hooks/useAiPlanner";
import { useT } from "@/i18n/lang";

/** How long a last answer's tick shows before the sheet closes on its own. */
const CLOSE_AFTER_MS = 300;

/**
 * What Casy needs to know before it fills in the Planlæg sheet (#173): its
 * questions and the names it couldn't place, dropped from the name field as
 * one short sheet of tap answers. Answering the last one closes it, and
 * Færdig does too, the rest left as Casy guessed; either way the sheet is
 * filled in after (`onDone`).
 */
export default function AiQuestionsSheet({
  open,
  planner,
  members,
  origin,
  onDone,
}: {
  open: boolean;
  planner: AiPlanner;
  members: { profileId: string; name: string; isYou: boolean }[];
  origin: RefObject<HTMLElement | null>;
  onDone: () => void;
}) {
  const t = useT();
  const words = t.aiPlan;
  const { questions, names } = planner.session;
  const open_ = [
    ...questions.map((q) => q.picked === null),
    ...names.map((n) => n.picked === null),
  ].filter(Boolean).length;
  // The last one answered: a moment to see its tick, then on to the filling in.
  const answered = (wasOpen: boolean) => {
    if (wasOpen && open_ === 1) window.setTimeout(onDone, CLOSE_AFTER_MS);
  };
  const others = members.filter((m) => !m.isYou);

  return (
    <BottomSheet
      open={open}
      onClose={onDone}
      title={words.quickQuestion}
      doneLabel={t.schedulerFlow.done}
      origin={origin}
      edge="top"
    >
      {questions.map(({ question, picked }, qi) => (
        <ListGroup key={`q${qi}`} title={question.question} className={qi === 0 ? "mt-0" : ""}>
          {question.options.map((option, oi) => (
            <ListPickRow
              key={oi}
              type="radio"
              name={`ai-q${qi}`}
              checked={picked === oi}
              onChange={() => {
                planner.answer(qi, oi);
                answered(picked === null);
              }}
              label={option.label}
            />
          ))}
        </ListGroup>
      ))}
      {names.map((n, ni) => {
        const choices =
          n.candidates.length > 0
            ? others.filter((m) => n.candidates.includes(m.profileId))
            : others;
        return (
          <ListGroup
            key={`n${ni}`}
            title={n.candidates.length > 0 ? words.whoIs(n.written) : words.noOneNamed(n.written)}
            className={questions.length === 0 && ni === 0 ? "mt-0" : ""}
          >
            {[
              ...choices.map((m) => ({ key: m.profileId, label: m.name })),
              { key: "none", label: words.noneOfThem },
            ].map((c) => (
              <ListPickRow
                key={c.key}
                type="radio"
                name={`ai-n${ni}`}
                checked={n.picked === c.key}
                onChange={() => {
                  planner.pickName(ni, c.key);
                  answered(n.picked === null);
                }}
                label={c.label}
              />
            ))}
          </ListGroup>
        );
      })}
    </BottomSheet>
  );
}
