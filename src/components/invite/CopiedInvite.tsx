import { lazy, Suspense, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { groupsQuery } from "@/api/groups";
import { useSignedInUser } from "@/context/auth";
import { copiedLink } from "@/lib/contactInvite";
import { isNativeApp } from "@/lib/nativeApp";

const InvitePasteSheet = lazy(() => import("@/components/invite/InvitePasteSheet"));

/** The clipboard's last copy already asked about: one ask per copy. */
const ASKED_KEY = "casy.copiedInviteAsked";

function askedChange(): number | null {
  try {
    const v = window.localStorage.getItem(ASKED_KEY);
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}

function markAsked(change: number) {
  try {
    window.localStorage.setItem(ASKED_KEY, String(change));
  } catch {
    // Without storage it may ask again next time: harmless.
  }
}

/**
 * The invite that came through the App Store (#277). The invite page on an
 * iPhone has one way on, the App Store, and copies the invite on the way;
 * iOS carries nothing else through an install. So once someone is signed in
 * to the app and in no group yet, and something copied looks like a link
 * (iOS says so without asking, and without the app seeing it), the paste
 * sheet opens by itself: one tap, iOS's own question, and the invite's page,
 * joining at once. Once per copy, and first of all: the calendar step waits
 * (`onAsking`). Nothing on the website, or in an app built before it could tell.
 */
export default function CopiedInvite({ onAsking }: { onAsking: (asking: boolean) => void }) {
  const userId = useSignedInUser().id;
  const { data: groups, isError } = useQuery({ ...groupsQuery(userId), enabled: isNativeApp });
  // "checking" holds the calendar step until the clipboard has answered.
  const [state, setState] = useState<"checking" | "open" | "done">(
    isNativeApp ? "checking" : "done",
  );

  // Someone already in a group came another way: nothing to ask.
  const inGroup = !!groups && groups.length > 0;
  // Nor when the groups can't be listed: the calendar step must never wait for ever.
  const now = (inGroup || isError) && state === "checking" ? "done" : state;

  useEffect(() => {
    if (now !== "checking" || !groups) return;
    let stale = false;
    void copiedLink().then((copied) => {
      if (stale) return;
      if (copied?.link && copied.change !== askedChange()) {
        markAsked(copied.change);
        setState("open");
      } else setState("done");
    });
    return () => {
      stale = true;
    };
  }, [now, groups]);

  useEffect(() => {
    onAsking(now !== "done");
  }, [now, onAsking]);

  if (now !== "open") return null;
  return (
    <Suspense fallback={null}>
      <InvitePasteSheet open onClose={() => setState("done")} found />
    </Suspense>
  );
}
