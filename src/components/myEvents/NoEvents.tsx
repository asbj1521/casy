import { Link } from "react-router-dom";
import { CalendarCheck, CalendarSearch, Sparkles } from "lucide-react";

import GlassButton from "@/components/ui/GlassButton";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";

/** Nothing to show: cancelled events are in no section, so this can follow a non-empty answer. */
export default function NoEvents() {
  const t = useT();
  // A phone plans from My calendar (#127): straight into its Planlæg sheet.
  const phone = usePhoneLayout();
  if (phone) {
    // No card (#153): what it is, one line, and the way to plan, in glass.
    return (
      <div className="mt-16 flex flex-col items-center text-center">
        <CalendarCheck className="h-10 w-10 text-primary" />
        <p className="mt-3 text-[17px] font-semibold text-foreground">{t.events.emptyTitle}</p>
        <p className="mt-1 max-w-xs text-[15px] text-muted-foreground">{t.events.emptyBodyPhone}</p>
        <GlassButton icon={CalendarSearch} to="/?plan" className="mt-5">
          {t.planFromCalendar.button}
        </GlassButton>
      </div>
    );
  }
  return (
    <div className="mt-6 flex flex-col items-start rounded-2xl border bg-card p-5 sm:mt-8 sm:p-6">
      <CalendarCheck className="h-8 w-8 text-primary" />
      <p className="mt-3 font-semibold text-foreground">{t.events.emptyTitle}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t.events.emptyBody}</p>
      <Link
        to="/"
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
      >
        <Sparkles className="h-4 w-4" />
        {t.events.findDate}
      </Link>
    </div>
  );
}
