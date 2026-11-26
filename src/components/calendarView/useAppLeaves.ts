import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { eventsQueryKey } from "@/api/events";
import { useAuth, useSignedInUser } from "@/context/auth";
import { onAppLeave, type NativeClosed } from "@/lib/nativeBridge";
import { sheetAddress } from "@/lib/profileScreens";
import { askForPush } from "@/lib/pushAsk";
import { supabaseAuth } from "@/lib/supabase";

/**
 * What a sheet the app opened itself leaves to the page (#202): the app's home
 * page opens its sheets without asking the page, and handles their closing
 * where it can; the rest arrives here, done as the page's own sheets do it
 * (NativeProfile, NativePlan, NativeEvents). Only while the app's home is shown.
 */
export function useAppLeaves(on: boolean) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { signOut } = useAuth();
  const userId = useSignedInUser().id;

  const leave = useRef<(closed: NativeClosed) => void>(() => {});
  useEffect(() => {
    leave.current = ({ next, signOut: out, joined, accountDeleted, sent, group }) => {
      if (accountDeleted) {
        void supabaseAuth
          .signOut({ scope: "local" })
          .catch(() => undefined)
          .then(() => navigate("/sign-in?deleted=1", { replace: true }));
      } else if (out) {
        signOut()
          .then(() => navigate("/"))
          .catch(() => undefined);
      } else if (joined) {
        askForPush("joined");
      } else if (sent) {
        void queryClient.invalidateQueries({ queryKey: eventsQueryKey(userId) });
        askForPush("sent");
      } else if (group) {
        // An invite's page, already a member: into that group, as JoinGroup does.
        navigate(sheetAddress(`groups/${group}`));
      } else if (next) {
        navigate(next);
      }
    };
  });

  useEffect(() => {
    if (!on) return;
    let handle: { remove: () => Promise<void> } | undefined;
    let gone = false;
    onAppLeave((closed) => leave.current(closed))
      .then((h) => {
        if (gone) void h.remove();
        else handle = h;
      })
      .catch((err) => console.warn("listening to the app's sheets failed", err));
    return () => {
      gone = true;
      void handle?.remove();
    };
  }, [on]);
}
