import { type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, CalendarSearch, User, type LucideIcon } from "lucide-react";

import { invitationsQuery } from "@/api/groups";
import { useSignedInUser } from "@/context/auth";
import { useEventsBadge } from "@/hooks/useEventsBadge";
import { useT } from "@/i18n/lang";
import { cn } from "@/lib/utils";

/**
 * The home page's buttons (#169), floating in glass along the bottom of the
 * months: Aftaler on the left, Planlæg in the middle, the profile on the
 * right. They take the place of the tab bar. Each opens its sheet over the
 * calendar, grown out of the button pressed (the refs). Hidden while a day,
 * a sheet or the plan is open, but never unmounted: Planlæg's sent dates fly
 * into the Aftaler button (data-tab-icon), measured where it stands. Under
 * every sheet (z-20, as the Planlæg button was), and over the pile only while
 * the dates fly (`flight`).
 */
export default function HomeBar({
  hidden,
  flight,
  onEvents,
  onPlan,
  onProfile,
  eventsRef,
  planRef,
  profileRef,
}: {
  hidden: boolean;
  flight: boolean;
  onEvents: () => void;
  onPlan: () => void;
  onProfile: () => void;
  eventsRef?: RefObject<HTMLButtonElement | null>;
  planRef?: RefObject<HTMLButtonElement | null>;
  profileRef?: RefObject<HTMLButtonElement | null>;
}) {
  const t = useT();
  const userId = useSignedInUser().id;
  // Each badge sits on the button that leads to the answer: votes waiting on
  // you on Aftaler, group invitations on the profile (its Groups row says which).
  const eventsBadge = useEventsBadge();
  const { data: invitations } = useQuery(invitationsQuery(userId));

  return (
    <div
      aria-hidden={hidden}
      inert={hidden}
      className={cn(
        "fixed inset-x-4 bottom-[max(env(safe-area-inset-bottom),0.75rem)] flex items-center gap-3 transition-opacity duration-200",
        flight ? "z-[65]" : "z-20",
        hidden && "pointer-events-none opacity-0",
      )}
    >
      <RoundButton
        ref={eventsRef}
        icon={CalendarCheck}
        label={t.nav.eventsShort}
        badge={eventsBadge}
        onClick={onEvents}
        // Where Planlæg's sent dates fly to (#102).
        target="/events"
      />
      <button
        ref={planRef}
        type="button"
        onClick={onPlan}
        className="glass-pill flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-4 text-[17px] font-semibold text-primary transition active:scale-95"
      >
        <CalendarSearch className="h-5 w-5 shrink-0" />
        <span className="truncate">{t.planFromCalendar.button}</span>
      </button>
      <RoundButton
        ref={profileRef}
        icon={User}
        label={t.nav.profileShort}
        badge={invitations?.length}
        onClick={onProfile}
      />
    </div>
  );
}

function RoundButton({
  ref,
  icon: Icon,
  label,
  badge,
  onClick,
  target,
}: {
  ref?: RefObject<HTMLButtonElement | null>;
  icon: LucideIcon;
  label: string;
  badge?: number;
  onClick: () => void;
  target?: string;
}) {
  const t = useT();
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      data-tab-icon={target}
      className="glass-pill relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-primary transition active:scale-95"
    >
      <Icon className="h-6 w-6" strokeWidth={2} />
      {!!badge && (
        <span
          aria-label={t.nav.waitingForAnswer(badge)}
          className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-cta px-1 text-[11px] font-semibold leading-none text-white"
        >
          {badge}
        </span>
      )}
    </button>
  );
}
