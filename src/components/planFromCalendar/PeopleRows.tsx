import { Check, Users, X } from "lucide-react";

import type { ParticipantProps } from "@/components/findDate/ParticipantSettings";
import { Stepper } from "@/components/schedulerSettings/parts";
import Avatar from "@/components/ui/Avatar";
import { ListGroup, ListRow, ListSwitchRow } from "@/components/ui/ListGroup";
import { useT } from "@/i18n/lang";
import { haptic } from "@/lib/haptics";
import type { MemberState } from "@/lib/scheduler";
import { cn } from "@/lib/utils";

const STATES: MemberState[] = ["required", "optional", "out"];

/** Each state's button: its mark, and its colour when picked. */
const LOOK: Record<MemberState, { on: string; text: string }> = {
  required: { on: "bg-emerald-600 text-white", text: "text-emerald-700" },
  optional: { on: "bg-amber-500 text-white", text: "text-amber-700" },
  out: { on: "bg-muted-foreground text-white", text: "text-muted-foreground" },
};

/**
 * Who is coming, in the Planlæg sheet's Deltagere (#173): a row per member,
 * their state written under the name and picked with three round buttons at
 * the row's end (Med, Valgfri, Ikke med; you are always invited). Under the
 * list, whether everyone must be able to come, or at least so many of those
 * who are Med (meetings only). The computer keeps its chips
 * (ParticipantSettings); both edit the same choice.
 */
export default function PeopleRows({
  members,
  choice,
  onChange,
  meeting,
  example,
}: ParticipantProps) {
  const t = useT();
  const words = t.settingsPanel.people;
  if (example || members.length === 0) {
    return (
      <ListGroup className="mt-0">
        <ListRow icon={Users} label={words.example} />
      </ListGroup>
    );
  }

  const state = (id: string): MemberState => choice.states[id] ?? "required";
  const required = members.filter((m) => state(m.profileId) === "required").length;
  // Below 2 there is nothing to be choosy about.
  const canChoose = meeting && required >= 2;
  const atLeast = canChoose && choice.atLeast !== null ? Math.min(choice.atLeast, required) : null;
  const setAtLeast = (n: number | null) => onChange({ ...choice, atLeast: n });

  return (
    <>
      <ListGroup className="mt-0" footnote={words.introRows}>
        {members.map((m, i) => {
          const s = state(m.profileId);
          const name = m.isYou ? t.events.you : m.name;
          return (
            <ListRow
              key={m.profileId}
              leading={<Avatar name={m.name} index={i} size="md" />}
              label={name}
              detail={<span className={LOOK[s].text}>{words.states[s]}</span>}
              trailing={
                <div role="radiogroup" aria-label={name} className="flex shrink-0 gap-1.5">
                  {STATES.map((option) => (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={s === option}
                      aria-label={words.states[option]}
                      // You are always invited.
                      disabled={m.isYou && option === "out"}
                      onClick={() => {
                        haptic("select");
                        onChange({
                          ...choice,
                          states: { ...choice.states, [m.profileId]: option },
                        });
                      }}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-[15px] font-bold transition-colors disabled:opacity-30",
                        s === option ? LOOK[option].on : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {option === "required" ? (
                        <Check className="h-4 w-4" strokeWidth={3} />
                      ) : option === "optional" ? (
                        "?"
                      ) : (
                        <X className="h-4 w-4" strokeWidth={3} />
                      )}
                    </button>
                  ))}
                </div>
              }
            />
          );
        })}
      </ListGroup>

      <ListGroup footnote={meeting ? undefined : words.meetingsOnly}>
        <ListSwitchRow
          label={words.allMust}
          checked={atLeast === null}
          disabled={!canChoose}
          onChange={(on) => setAtLeast(on ? null : Math.max(1, required - 1))}
        />
        {atLeast !== null && (
          <ListRow
            label={words.atLeast}
            trailing={
              <Stepper
                inRow
                value={atLeast}
                values={Array.from({ length: required - 1 }, (_, k) => k + 1)}
                format={(n) => words.ofRequired(n, required)}
                onChange={setAtLeast}
                lessLabel={words.fewer}
                moreLabel={words.more}
              />
            }
          />
        )}
      </ListGroup>
    </>
  );
}
