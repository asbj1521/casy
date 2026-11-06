import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { calendarStatusQuery } from "@/api/calendars";
import { whoAmIQuery } from "@/api/groups";
import AiConsentSheet from "@/components/ai/AiConsentSheet";
import { useAuth } from "@/context/auth";
import { useAiAllowed, useAiConsent } from "@/hooks/useAiAllowed";
import { rememberAskedAboutAi, wasAskedAboutAi } from "@/lib/aiConsent";
import { hasConnectedCalendar } from "@/lib/calendarPrompt";

/**
 * When this page load began: an answer older than this is the copy remembered
 * from an earlier visit (queryPersistence.ts), which may predate a yes given
 * on another device. The box waits for a fresh one.
 */
const LOADED_AT = Date.now();

/**
 * Asks about Casy's AI (#120) on My calendar, for anyone with a calendar
 * connected who hasn't answered yet. Either answer is final here (the row in
 * Your data changes it any time; an AI button asks again, useAiConsentGate).
 * Admins and AI testers are asked too, so the flow is one they can try, though
 * they may use the AI without it.
 *
 * On a phone the home page asks one thing at a time (#205): it mounts this
 * itself, `held` while something comes first (the import card), and is told
 * through `onOpenChange` while the question is up, so its own cards wait.
 */
interface Props {
  /** Not yet: something else on the page is asked first. */
  held?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function AiConsentPrompt(props: Props) {
  const { user } = useAuth();
  if (!user) return null;
  return <Prompt key={user.id} userId={user.id} {...props} />;
}

function Prompt({ userId, held = false, onOpenChange }: Props & { userId: string }) {
  const aiOn = useAiAllowed();
  const consented = useAiConsent();
  const [asked, setAsked] = useState(() => wasAskedAboutAi(userId));

  const { dataUpdatedAt } = useQuery(whoAmIQuery(userId));
  const { data: connections } = useQuery({
    ...calendarStatusQuery(userId),
    enabled: aiOn && !consented && !asked,
  });
  const open =
    !held &&
    aiOn &&
    !consented &&
    !asked &&
    dataUpdatedAt >= LOADED_AT &&
    !!connections &&
    hasConnectedCalendar(connections);
  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  return (
    <AiConsentSheet
      open={open}
      onClose={() => {
        rememberAskedAboutAi(userId);
        setAsked(true);
      }}
    />
  );
}
