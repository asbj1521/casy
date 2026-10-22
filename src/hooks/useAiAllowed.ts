import { useQuery } from "@tanstack/react-query";

import { whoAmIQuery } from "@/api/groups";
import { useAuth } from "@/context/auth";

/**
 * Whether the AI features are on for the signed-in person (#111): admins
 * always, anyone else once an admin switched them on. While they are tested,
 * the page hides them otherwise; the server refuses them either way
 * (_shared/aiAccess.ts), so this only spares people a button that can't work.
 */
export function useAiAllowed(): boolean {
  const { user } = useAuth();
  const { data } = useQuery({ ...whoAmIQuery(user?.id ?? ""), enabled: !!user });
  return !!user && data?.aiAllowed === true;
}

/** Whether this person has said yes to Casy's AI using content from their calendar (#120). */
export function useAiConsent(): boolean {
  const { user } = useAuth();
  const { data } = useQuery({ ...whoAmIQuery(user?.id ?? ""), enabled: !!user });
  return !!user && data?.aiConsent === true;
}

/** Whether this person's corrections of the AI are sent to Casy for review (#122). */
export function useAiShare(): boolean {
  const { user } = useAuth();
  const { data } = useQuery({ ...whoAmIQuery(user?.id ?? ""), enabled: !!user });
  return !!user && data?.aiConsent === true && data?.aiShare === true;
}

/**
 * Whether Casy's AI may read content from this person's calendar (calendar
 * names, event titles): the AI is on for them, and they said yes or are an
 * admin or AI tester while it is tested (#120). The server asks the same
 * (aiContentAllowed), so this only spares people work that would be refused.
 */
export function useAiContent(): boolean {
  const { user } = useAuth();
  const { data } = useQuery({ ...whoAmIQuery(user?.id ?? ""), enabled: !!user });
  const tester = (data?.aiTester ?? data?.eventLabels) === true;
  return !!user && data?.aiAllowed === true && (tester || data?.aiConsent === true);
}

/**
 * Whether this person gets the AI features that are admin-only while they
 * are tested: admins, and people an admin marked as AI testers, on top of
 * AI. Every such feature checks this, never admin status alone, so a
 * tester's account gets each of them; the server checks again
 * (aiTesterAllowed).
 */
export function useAiTester(): boolean {
  const { user } = useAuth();
  const { data } = useQuery({ ...whoAmIQuery(user?.id ?? ""), enabled: !!user });
  return !!user && data?.aiAllowed === true && (data?.aiTester ?? data?.eventLabels) === true;
}
