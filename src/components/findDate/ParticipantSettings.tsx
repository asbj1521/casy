import { Minus, Plus } from "lucide-react";

import type { GroupMember } from "@/api/groups";
import Avatar from "@/components/ui/Avatar";
import { useT } from "@/i18n/lang";
import type { MemberState, PeopleChoice } from "@/lib/scheduler";
import { cn } from "@/lib/utils";

/**
 * Who an event is for (#89), in the settings box's Deltagere tab and a
 * phone's Flere indstillinger: each member a chip that a tap moves on from
 * Med to Valgfri to Ikke med (you are always invited, so yours only goes
 * between the first two), and how many must be able to come. The chips
 * scroll inside a fixed height, so a big group never makes the box taller.
 */
export interface ParticipantProps {
  members: GroupMember[];
  choice: PeopleChoice;
  onChange: (choice: PeopleChoice) => void;
  /** "At least N" is for meetings only. */
  meeting: boolean;
  /** An example group: nothing to choose from yet. */
  example: boolean;
}

const NEXT: Record<MemberState, MemberState> = {
  required: "optional",
  optional: "out",
  out: "required",
};

export default function ParticipantSettings({
  members,
  choice,
  onChange,
  meeting,
  example,
}: ParticipantProps) {
  const t = useT();
  const words = t.settingsPanel.people;
  if (example || members.length === 0) {
    return <p className="text-sm text-muted-foreground">{words.example}</p>;
  }

  const state = (m: GroupMember): MemberState => choice.states[m.profileId] ?? "required";
  const required = members.filter((m) => state(m) === "required").length;
  // Below 2 there is nothing to be choosy about.
  const canChoose = meeting && required >= 2;
  const atLeast = canChoose && choice.atLeast !== null ? Math.min(choice.atLeast, required) : null;

  function cycle(m: GroupMember) {
    let next = NEXT[state(m)];
    // You are always invited: yours goes between Med and Valgfri.
    if (m.isYou && next === "out") next = "required";
    onChange({ ...choice, states: { ...choice.states, [m.profileId]: next } });
  }
  const setAtLeast = (n: number | null) => onChange({ ...choice, atLeast: n });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{words.intro}</p>
      <ul className="flex max-h-[4.75rem] flex-wrap gap-1.5 overflow-y-auto">
        {members.map((m, i) => {
          const s = state(m);
          const name = m.isYou ? t.events.you : m.name;
          return (
            <li key={m.profileId}>
              <button
                type="button"
                onClick={() => cycle(m)}
                aria-label={words.stateLabel(name, words.states[s])}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-sm font-medium transition",
                  s === "required" && "border-emerald-200 bg-emerald-50 text-emerald-900",
                  s === "optional" && "border-dashed border-amber-300 bg-amber-50 text-amber-900",
                  s === "out" && "bg-background text-muted-foreground line-through",
                )}
              >
                <Avatar name={m.name} index={i} size="xs" />
                {name}
                <span className="text-xs font-normal no-underline opacity-75">
                  {words.states[s]}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {words.howMany}
        </span>
        <div
          role="radiogroup"
          aria-label={words.howMany}
          className={cn(
            "flex h-10 items-center gap-1 rounded-xl border bg-secondary/60 p-1",
            !canChoose && "opacity-50",
          )}
        >
          <button
            type="button"
            role="radio"
            aria-checked={atLeast === null}
            disabled={!canChoose}
            onClick={() => setAtLeast(null)}
            className={cn(
              "h-full rounded-lg px-3 text-sm font-bold transition-colors",
              atLeast === null ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {words.all}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={atLeast !== null}
            disabled={!canChoose}
            onClick={() => setAtLeast(Math.max(1, required - 1))}
            className={cn(
              "h-full rounded-lg px-3 text-sm font-bold transition-colors",
              atLeast !== null ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {words.atLeast}
          </button>
        </div>
        {atLeast !== null && (
          <div className="flex h-10 items-center rounded-xl border bg-card">
            <button
              type="button"
              onClick={() => setAtLeast(Math.max(1, atLeast - 1))}
              disabled={atLeast <= 1}
              aria-label={words.fewer}
              className="flex h-full w-9 items-center justify-center rounded-l-xl transition hover:bg-secondary disabled:opacity-30"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-[4.5rem] text-center text-sm font-bold text-foreground">
              {words.ofRequired(atLeast, required)}
            </span>
            <button
              type="button"
              onClick={() => setAtLeast(Math.min(required - 1, atLeast + 1))}
              disabled={atLeast >= required - 1}
              aria-label={words.more}
              className="flex h-full w-9 items-center justify-center rounded-r-xl transition hover:bg-secondary disabled:opacity-30"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}
        {!meeting && <span className="text-xs text-muted-foreground">{words.meetingsOnly}</span>}
      </div>
    </div>
  );
}
