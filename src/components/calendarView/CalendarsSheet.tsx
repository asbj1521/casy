import { lazy, Suspense, useState, type RefObject } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CalendarPlus } from "lucide-react";

import CalendarListPanel from "@/components/CalendarListPanel";
import BottomSheet from "@/components/ui/BottomSheet";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { PUSH, pushTransition } from "@/components/ui/push";
import { useT } from "@/i18n/lang";
import type { OverviewCalendar } from "@/lib/calendarOverview";

// Connecting calendars brings its forms along: fetched as it first opens.
const ConnectedCalendars = lazy(() => import("@/components/calendarView/ConnectedCalendars"));

/** The sheet's own screen in the address: `?calendars=accounts`. */
const ACCOUNTS = "accounts";

/**
 * The phone's Kalendere (#219), dropping out of its button at the top: your
 * calendars, and "Forbundne kalendere" sliding in inside the sheet as Profil's
 * screens do (#174), never a page of its own. In the address like them, so the
 * phone's back steps out of it, and CALENDAR_ACCOUNTS_PATH leads here on a phone.
 */
export default function CalendarsSheet({
  open,
  onClose,
  origin,
  arrived,
  calendars,
  colorOf,
  connectedCount,
  onSetVisible,
  visibilityError,
}: {
  open: boolean;
  onClose: () => void;
  origin: RefObject<HTMLElement | null>;
  arrived: boolean;
  calendars: OverviewCalendar[];
  colorOf: (calendarId: string) => string;
  /** How many accounts are connected; null while that isn't known. */
  connectedCount: number | null;
  onSetVisible: (calendarIds: string[], visible: boolean) => void;
  visibilityError: string | null;
}) {
  const t = useT();
  const words = t.calendarView;
  const location = useLocation();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const screen = new URLSearchParams(location.search).get("calendars");
  const accounts = screen === ACCOUNTS;
  const state = (location.state as { fromMonth?: boolean; sheetDepth?: number } | null) ?? {};
  const depth = state.sheetDepth ?? 0;

  // Which way it moves (React's pattern for state that follows a changed value).
  const [shown, setShown] = useState({ accounts, dir: 1 });
  if (accounts !== shown.accounts) setShown({ accounts, dir: accounts ? 1 : -1 });

  const back = () => {
    if (depth > 0) navigate(-1);
    else navigate({ search: "?calendars" }, { replace: true, state });
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={accounts ? t.profile.connectedCalendars : words.calendarsButton}
      doneLabel={t.swipe.done}
      origin={origin}
      edge="top"
      arrived={arrived}
      stacked
      back={accounts ? { label: words.calendarsButton, onBack: back, iconOnly: true } : undefined}
    >
      <AnimatePresence initial={false} mode="popLayout" custom={shown.dir}>
        <motion.div
          key={accounts ? "accounts" : "list"}
          custom={shown.dir}
          variants={PUSH}
          initial="enter"
          animate="center"
          exit="exit"
          transition={pushTransition(reduce)}
          // A plain block, not a flex column: a column would squash the forms'
          // collapsing boxes (overflow hidden) down to nothing.
          className="min-h-0 w-full flex-auto overflow-y-auto overscroll-contain px-4 pb-4"
        >
          {accounts ? (
            <Suspense fallback={null}>
              <ConnectedCalendars />
            </Suspense>
          ) : (
            <>
              <ListGroup className="mb-4 mt-0">
                <ListRow
                  icon={CalendarPlus}
                  label={t.calendarAccounts.row}
                  detail={t.calendarAccounts.rowDetail}
                  value={connectedCount}
                  onClick={() =>
                    navigate(
                      { search: `?calendars=${ACCOUNTS}` },
                      { state: { ...state, sheetDepth: depth + 1 } },
                    )
                  }
                />
              </ListGroup>
              <CalendarListPanel
                introInTip
                noPrimary
                calendars={calendars}
                colorOf={colorOf}
                onSetVisible={onSetVisible}
                visibilityError={visibilityError}
              />
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </BottomSheet>
  );
}
