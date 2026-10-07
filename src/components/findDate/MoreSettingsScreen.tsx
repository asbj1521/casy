import type { ReactNode } from "react";

import PhoneSubHeader from "@/components/PhoneSubHeader";
import { useT } from "@/i18n/lang";
import type { EventExtras } from "@/lib/scheduler";

import { COMING_SOON } from "./comingSoon";
import ComingSoonSettings from "./ComingSoonSettings";
import { PlaceNoteSettings, VoteSettings } from "./EventExtraSettings";

/**
 * Flere indstillinger (#98), opened from the sentence's "Mere" button on
 * narrower screens: the settings the computer's box has in tabs, one section
 * each. Laid over the scheduling page (opened with ?settings, closed by going
 * back) rather than a page of its own, so the page underneath keeps its
 * settings and scroll. Sted og note and Afstemning first, then what is
 * coming; the time is set in the sentence itself.
 */
export default function MoreSettingsScreen({
  back,
  extras,
  onExtras,
}: {
  back: string;
  extras: EventExtras;
  onExtras: (patch: Partial<EventExtras>) => void;
}) {
  const t = useT();
  const words = t.settingsPanel;
  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-background pb-[var(--tab-bar-height)] xl:hidden">
      <PhoneSubHeader title={words.more} back={back} backLabel={words.back} />
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pb-8 pt-2">
        <p className="text-sm text-muted-foreground">{words.moreIntro}</p>
        <Section title={words.tabs.place}>
          <PlaceNoteSettings extras={extras} onChange={onExtras} />
        </Section>
        <Section title={words.tabs.vote}>
          <VoteSettings extras={extras} onChange={onExtras} />
        </Section>
        {COMING_SOON.map((section) => (
          <Section key={section} title={words.tabs[section]}>
            <ComingSoonSettings section={section} />
          </Section>
        ))}
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <h2 className="mb-2 text-[17px] font-bold text-foreground">{title}</h2>
      {children}
    </section>
  );
}
