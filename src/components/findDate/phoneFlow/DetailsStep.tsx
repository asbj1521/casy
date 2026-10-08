import type { ReactNode } from "react";

import { PlaceNoteSettings, VoteSettings } from "@/components/findDate/EventExtraSettings";
import ParticipantSettings, {
  type ParticipantProps,
} from "@/components/findDate/ParticipantSettings";
import { useT } from "@/i18n/lang";
import type { EventExtras } from "@/lib/scheduler";

/**
 * The flow's optional step (#101): who the event is for, where and what to
 * know, and how the vote runs, each in a box of its own. The computer has
 * the same settings in its box's tabs; the ones coming soon stay off the
 * phone, where they would only be in the way.
 */
export default function DetailsStep({
  extras,
  onExtras,
  participants,
}: {
  extras: EventExtras;
  onExtras: (patch: Partial<EventExtras>) => void;
  participants: ParticipantProps;
}) {
  const t = useT();
  const words = t.settingsPanel;
  return (
    <div className="flex flex-col gap-4">
      <Section title={words.tabs.people}>
        <ParticipantSettings {...participants} />
      </Section>
      <Section title={words.tabs.place}>
        <PlaceNoteSettings extras={extras} onChange={onExtras} />
      </Section>
      <Section title={words.tabs.vote}>
        <VoteSettings extras={extras} onChange={onExtras} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <h3 className="mb-2 text-[17px] font-bold text-foreground">{title}</h3>
      {children}
    </section>
  );
}
