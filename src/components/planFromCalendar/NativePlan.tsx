import { useQueryClient } from "@tanstack/react-query";

import { eventsQueryKey } from "@/api/events";
import { useSignedInUser } from "@/context/auth";
import { useNativeSheet } from "@/hooks/useNativeSheet";
import { askForPush } from "@/lib/pushAsk";

/**
 * Planlæg when the app draws it (#282): the sheet, the paper pile and the
 * sending are all native, so the page only opens it while the address says
 * `?plan`. Sent, the vote is in the events the app fetched again, and now the
 * others are asked: the moment to offer notifications, as the page's own does.
 */
export default function NativePlan({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const userId = useSignedInUser().id;
  useNativeSheet(
    "plan",
    open,
    ({ sent }) => {
      onClose();
      if (sent) {
        void queryClient.invalidateQueries({ queryKey: eventsQueryKey(userId) });
        askForPush("sent");
      }
    },
    onClose,
  );
  return null;
}
