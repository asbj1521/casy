import { useRef } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { primaryCalendarQuery, updatePrimaryCalendar } from "@/api/calendars";
import type { SuggestedEvent } from "@/api/events";
import AddToCalendar from "@/components/AddToCalendar";
import Avatar from "@/components/ui/Avatar";
import FlowButton from "@/components/ui/FlowButton";
import { ListGroup, ListSwitchRow } from "@/components/ui/ListGroup";
import { useSignedInUser } from "@/context/auth";
import { eventTitle } from "@/i18n/eventTitle";
import { useLang, useT } from "@/i18n/lang";
import { formatHeadline } from "@/lib/format";

/**
 * A date the group has agreed on, said before it flies into its day on the
 * home page (#172): the month blurred behind a card in the middle of the
 * screen with the event and its date, who is coming, Add to my calendar
 * (AddToCalendar: into your primary calendar, choosing one the first time,
 * or a calendar file) and, once there is a primary calendar, Tilføj
 * automatisk for the next ones. "Se den i kalenderen" closes it, and the date
 * flies out of the card into its day (`onDone`, with where the date stood).
 *
 * A card in the middle on a phone, against the design language's sheets
 * (CLAUDE.md), on purpose: this is a moment of its own, not a choice.
 */
export default function AgreedCard({
  event,
  onDone,
}: {
  event: SuggestedEvent & { currentDate: NonNullable<SuggestedEvent["currentDate"]> };
  onDone: (from: DOMRect) => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const user = useSignedInUser();
  const queryClient = useQueryClient();
  const reduce = useReducedMotion();
  const { data: primary } = useQuery(primaryCalendarQuery(user.id));
  const autoAdd = useMutation({
    mutationFn: (on: boolean) => updatePrimaryCalendar(queryClient, user.id, { autoAdd: on }),
  });
  const date = useRef<HTMLParagraphElement>(null);
  const headline = formatHeadline(event.settings, event.currentDate, lang, t);
  const going = event.invitees.filter((i) => i.response !== "declined");
  const words = t.primaryCalendar;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduce ? 0 : 0.25 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/25 px-5 backdrop-blur-md"
    >
      <motion.div
        role="dialog"
        aria-modal
        aria-label={eventTitle(event.title, t)}
        initial={reduce ? false : { scale: 0.85, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 26 }}
        className="glass w-full max-w-sm rounded-[28px] p-5"
      >
        <p className="text-xs font-bold uppercase tracking-wide text-primary">
          {t.homeVote.everyone}
        </p>
        <p className="mt-1 text-[17px] font-semibold text-foreground">
          {eventTitle(event.title, t)}
        </p>
        <p
          ref={date}
          className="mt-1 text-[28px] font-extrabold leading-[1.1] tracking-tight text-foreground"
        >
          {headline.lines.join(" ")}
        </p>
        <p className="mt-1 text-[17px] text-foreground">{headline.time}</p>
        <ul className="mt-3 flex -space-x-2">
          {going.map((p, i) => (
            <li key={p.profileId}>
              <Avatar name={p.name} index={i} className="ring-2 ring-card" src={p.avatarUrl} />
            </li>
          ))}
        </ul>

        <div className="mt-4">
          <AddToCalendar event={event} wide />
        </div>
        {primary && (
          <ListGroup className="mt-3">
            <ListSwitchRow
              label={words.autoAdd}
              detail={words.autoAddHelp}
              checked={primary.autoAdd}
              disabled={autoAdd.isPending}
              onChange={(on) => autoAdd.mutate(on)}
            />
          </ListGroup>
        )}

        <div className="mt-4">
          <FlowButton
            onClick={() => {
              const box = date.current;
              onDone(box ? box.getBoundingClientRect() : new DOMRect());
            }}
          >
            {t.homeVote.show}
          </FlowButton>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
