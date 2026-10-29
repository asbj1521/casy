import { useState, type ReactNode, type RefObject } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { eventsQuery } from "@/api/events";
import DatedScreen from "@/components/myEvents/phone/DatedScreen";
import EventRowsPage from "@/components/myEvents/phone/EventRowsPage";
import VoteScreen from "@/components/myEvents/phone/VoteScreen";
import DanishTimeNote from "@/components/time/DanishTimeNote";
import BottomSheet from "@/components/ui/BottomSheet";
import Notice from "@/components/ui/Notice";
import { PUSH, pushTransition } from "@/components/ui/push";
import { useSignedInUser } from "@/context/auth";
import { eventTitle } from "@/i18n/eventTitle";
import { useT } from "@/i18n/lang";
import { dayParam } from "@/lib/dayView";
import { phoneEventGroups } from "@/lib/myEvents";

/** What the home page's address says of the sheet, kept with each step. */
interface SheetState {
  fromMonth?: boolean;
  /** How many screens were pushed inside the sheet: the steps back to the list. */
  sheetDepth?: number;
}

/**
 * A phone's My events (#169), a sheet over the home page opened by its
 * Aftaler button (?events): the rows in their three groups (#177), and an
 * event's screen pushed inside the sheet as iOS pushes one, as the Profil
 * sheet does (#174): "‹ Aftaler" back, the event's name as the title, in
 * the address as `?events=<id>`, so the phone's back steps out of it. An
 * agreed event's screen is DatedScreen, a vote's VoteScreen; a vote to
 * answer goes straight to answering it, over the day view.
 */
export default function EventsSheet({
  open,
  onClose,
  origin,
  arrived,
}: {
  open: boolean;
  onClose: () => void;
  /** The button it grows out of (#169). */
  origin?: RefObject<HTMLElement | null>;
  /** Open already as the home page appears: shown in place (BottomSheet). */
  arrived?: boolean;
}) {
  const t = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const userId = useSignedInUser().id;
  const { data: events, isPending, isError } = useQuery(eventsQuery(userId));
  const key = new URLSearchParams(location.search).get("events") ?? "";
  const state = (location.state as SheetState | null) ?? {};
  const depth = state.sheetDepth ?? 0;

  // Deeper slides in from the right, back out to it.
  const [shown, setShown] = useState({ key, dir: 1 });
  if (key !== shown.key) setShown({ key, dir: key ? 1 : -1 });

  const openEvent = (id: string) =>
    navigate(`/?events=${id}`, { state: { ...state, sheetDepth: depth + 1 } });
  const back = () => {
    if (depth > 0) navigate(-1);
    else navigate("/?events", { replace: true, state });
  };
  // Out of the sheet onto the home page: the way back from there is still
  // where the sheet was opened from (closeOverlay steps back over the
  // screens pushed here, or, opened by a link, puts the bare month in place).
  const leaveFor = (search: string) =>
    navigate(
      { search },
      { replace: true, state: { fromMonth: state.fromMonth, sheetDepth: depth } },
    );
  const answer = (id: string) => leaveFor(`?vote=${id}`);
  const openDay = (day: number) => leaveFor(`?day=${dayParam(day)}`);

  const groups = events ? phoneEventGroups(events) : null;
  const staged = key
    ? [...(groups?.answer ?? []), ...(groups?.coming ?? [])].find((s) => s.event.id === key)
    : undefined;

  let screen: { title: string; body: ReactNode };
  if (staged?.stage === "scheduled") {
    screen = {
      title: eventTitle(staged.event.title, t),
      body: <DatedScreen event={staged.event} onOpenDay={openDay} />,
    };
  } else if (staged?.stage === "voting" || staged?.stage === "toSwipe") {
    screen = {
      title: eventTitle(staged.event.title, t),
      body: <VoteScreen event={staged.event} />,
    };
  } else {
    screen = {
      title: t.events.title,
      body: (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <DanishTimeNote className="mb-1" />
          {isPending ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t.events.loading}
            </p>
          ) : isError ? (
            <Notice tone="error" bare className="mt-4">
              {t.events.loadFailed}
            </Notice>
          ) : (
            <EventRowsPage events={events} onAnswer={answer} onOpen={openEvent} />
          )}
        </div>
      ),
    };
  }
  const inEvent = staged !== undefined;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={screen.title}
      doneLabel={t.swipe.done}
      origin={origin}
      arrived={arrived}
      stacked
      back={inEvent ? { label: t.nav.eventsShort, onBack: back } : undefined}
    >
      <AnimatePresence initial={false} mode="popLayout" custom={shown.dir}>
        <motion.div
          key={inEvent ? key : ""}
          custom={shown.dir}
          variants={PUSH}
          initial="enter"
          animate="center"
          exit="exit"
          transition={pushTransition(reduce)}
          className="flex min-h-0 w-full flex-auto flex-col"
        >
          {screen.body}
        </motion.div>
      </AnimatePresence>
    </BottomSheet>
  );
}
