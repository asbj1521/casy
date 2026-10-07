import PhoneSubHeader from "@/components/PhoneSubHeader";
import { useT } from "@/i18n/lang";

import ComingSoonSettings, { COMING_SOON } from "./ComingSoonSettings";

/**
 * Flere indstillinger (#98), opened from the sentence's "Mere" button on
 * narrower screens: the settings the computer's box has in tabs, one section
 * each. Laid over the scheduling page (opened with ?settings, closed by going
 * back) rather than a page of its own, so the page underneath keeps its
 * settings and scroll. Everything here is coming soon; the time is set in
 * the sentence itself.
 */
export default function MoreSettingsScreen({ back }: { back: string }) {
  const t = useT();
  const words = t.settingsPanel;
  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-background pb-[var(--tab-bar-height)] xl:hidden">
      <PhoneSubHeader title={words.more} back={back} backLabel={words.back} />
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pb-8 pt-2">
        <p className="text-sm text-muted-foreground">{words.moreIntro}</p>
        {COMING_SOON.map((section) => (
          <section key={section} className="rounded-2xl border bg-card p-4 shadow-sm">
            <h2 className="mb-2 text-[17px] font-bold text-foreground">{words.tabs[section]}</h2>
            <ComingSoonSettings section={section} />
          </section>
        ))}
      </main>
    </div>
  );
}
