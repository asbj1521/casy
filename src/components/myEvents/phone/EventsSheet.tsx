import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { eventsQuery } from "@/api/events";
import EventRowsPage from "@/components/myEvents/phone/EventRowsPage";
import DanishTimeNote from "@/components/time/DanishTimeNote";
import BottomSheet from "@/components/ui/BottomSheet";
import Notice from "@/components/ui/Notice";
import { useSignedInUser } from "@/context/auth";
import { useT } from "@/i18n/lang";

/**
 * A phone's My events (#169), a sheet over the home page opened by its
 * Aftaler button (?events): the same rows as the page had (#103), newest
 * first, each opening in place, the calendar still behind them.
 */
export default function EventsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const userId = useSignedInUser().id;
  const { data: events, isPending, isError } = useQuery(eventsQuery(userId));
  return (
    <BottomSheet open={open} onClose={onClose} title={t.events.title} doneLabel={t.swipe.done}>
      <DanishTimeNote className="-mt-2 mb-1" />
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
        <EventRowsPage events={events} />
      )}
    </BottomSheet>
  );
}
