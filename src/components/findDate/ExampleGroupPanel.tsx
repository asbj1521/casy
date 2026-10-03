import { Link } from "react-router-dom";
import { Check, Copy, UserPlus } from "lucide-react";

import Avatar from "@/components/ui/Avatar";
import { useAuth } from "@/context/auth";
import { useCalendarsHome } from "@/hooks/useCalendarsHome";
import { useCopy } from "@/hooks/useCopy";
import { useT } from "@/i18n/lang";
import { cn } from "@/lib/utils";
import type { Participant } from "@/types";

/**
 * Under the answer while an example group is showing: who is in it, and that
 * it is made up (the only place generated calendars are still used, and it
 * says so). Signed out, the way to a profile of your own sits beside it.
 */
export default function ExampleGroupPanel({
  participants,
  myCalendarsFailed,
}: {
  participants: Participant[];
  /** Your own calendars, swapped into the example, could not be loaded. */
  myCalendarsFailed: boolean;
}) {
  const t = useT();
  const calendarsHome = useCalendarsHome();
  const { user } = useAuth();
  const [copied, copy] = useCopy();
  const link = "font-medium text-foreground underline underline-offset-2";

  return (
    <div className={cn("grid gap-5 lg:items-start", !user && "lg:grid-cols-[minmax(0,1fr)_22rem]")}>
      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">{t.scheduler.groupMembers}</h2>
          <button
            type="button"
            onClick={() => copy(window.location.href)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary"
          >
            {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
            {copied ? t.scheduler.copiedLink : t.scheduler.copyLink}
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {!user
            ? t.scheduler.exampleSignedOut(
                <Link to="/sign-in?next=/" className={link}>
                  {t.scheduler.exampleSignedOutLink}
                </Link>,
              )
            : myCalendarsFailed
              ? t.scheduler.exampleCalendarsFailed
              : t.scheduler.exampleSignedIn(
                  <Link to={calendarsHome.to} className={link}>
                    {t.scheduler.exampleSignedInLink}
                  </Link>,
                )}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {participants.map((p, i) => (
            <span
              key={p.profileId}
              className="flex items-center gap-2 rounded-full border bg-card py-1 pl-1 pr-3"
            >
              <Avatar name={p.name} index={i} />
              <span className="text-sm text-foreground">{p.name}</span>
            </span>
          ))}
        </div>
      </section>

      {!user && (
        <div className="rounded-2xl border bg-card p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <UserPlus className="h-4 w-4 text-primary" />
            {t.groupPanel.noProfileTitle}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{t.groupPanel.noProfileBody}</p>
          <Link
            to="/sign-in?next=/&signup=1"
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            {t.groupPanel.signUp}
          </Link>
        </div>
      )}
    </div>
  );
}
