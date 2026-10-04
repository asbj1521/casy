import { useEffect, useId } from "react";
import { CalendarPlus, ShieldCheck } from "lucide-react";

import { PROVIDER_BRANDS } from "@/components/calendarProviders";
import { ModalPanel } from "@/components/ui/Modal";
import { useT } from "@/i18n/lang";
import { cn } from "@/lib/utils";
import { loadPage } from "@/pages/lazyPages";
import type { CalendarProvider } from "@/types";

/** The choices, in the order people are most likely to need them; the link last. */
const CHOICES: CalendarProvider[] = ["apple", "google", "outlook", "ics"];

/**
 * The connect pop-up's box (ConnectCalendarPrompt decides when it opens):
 * why a calendar matters, where it might live, and "Not now". Loaded on its
 * own, since only someone with no calendar ever sees it.
 */
export default function ConnectCalendarChoices({
  onChoose,
  onClose,
}: {
  onChoose: (provider: CalendarProvider) => void;
  onClose: () => void;
}) {
  const t = useT();
  const titleId = useId();
  // Every choice leads to the calendars page: have it ready.
  useEffect(() => void loadPage.calendarAccounts(), []);

  return (
    <ModalPanel labelledBy={titleId} className="max-w-lg sm:p-6">
      <h2 id={titleId} className="flex items-center gap-2 text-xl font-bold text-foreground">
        <CalendarPlus className="h-5 w-5 text-primary" />
        {t.connectPrompt.title}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{t.connectPrompt.body}</p>

      <ul className="mt-5 grid gap-2 sm:grid-cols-2">
        {CHOICES.map((id) => {
          const brand = PROVIDER_BRANDS[id];
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onChoose(id)}
                className="flex h-full w-full items-center gap-3 rounded-xl border bg-background p-3 text-left transition hover:border-primary/50 hover:bg-secondary"
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    brand.badgeClass,
                  )}
                >
                  {brand.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-tight text-foreground">
                    {t.providers[id].label}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {t.connectPrompt.hints[id]}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 flex items-center justify-between gap-4">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          {t.connectPrompt.privacy}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary"
        >
          {t.connectPrompt.later}
        </button>
      </div>
    </ModalPanel>
  );
}
