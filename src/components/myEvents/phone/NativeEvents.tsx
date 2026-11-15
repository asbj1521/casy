import { useLocation, useNavigate } from "react-router-dom";

import { useNativeSheet } from "@/hooks/useNativeSheet";

/**
 * Aftaler when the app draws it (#199): nothing on the page, only the native
 * sheet opened while the address says `?events`. When it closes, the address
 * steps back, or goes on to what the page still draws: answering a vote
 * (`?vote=<id>`), an event's screen (`?events=<id>`), or Planlæg. The way
 * back from there is still where the sheet was opened from.
 */
export default function NativeEvents({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  useNativeSheet(
    "events",
    open,
    ({ next }) => {
      if (next) navigate(next, { replace: true, state: location.state });
      else onClose();
    },
    onClose,
  );
  return null;
}
