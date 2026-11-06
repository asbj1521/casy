import { useQuery } from "@tanstack/react-query";

import { whoAmIQuery } from "@/api/groups";
import { useAuth } from "@/context/auth";

/**
 * Whether to offer the AI's buttons: to anyone signed in, once whoami has
 * answered (#147). Using one still takes a yes (useAiConsentGate), which the
 * server checks before every call.
 */
export function useAiAllowed(): boolean {
  const { user } = useAuth();
  const { data } = useQuery({ ...whoAmIQuery(user?.id ?? ""), enabled: !!user });
  return !!user && data?.aiAllowed === true;
}

/** Whether this person has said yes to Casy's AI (#120). */
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
 * Whether Casy's AI may work for this person: they said yes, or are an admin
 * or AI tester (#120, #147). The server asks the same (aiContentAllowed), so
 * this only spares people work that would be refused.
 */
export function useAiContent(): boolean {
  const { user } = useAuth();
  const { data } = useQuery({ ...whoAmIQuery(user?.id ?? ""), enabled: !!user });
  const tester = (data?.aiTester ?? data?.eventLabels) === true;
  return !!user && (tester || data?.aiConsent === true);
}

/**
 * Whether this person is an admin or AI tester, for what is only for testing.
 * Everything of that kind checks this, never admin status alone, so a tester's
 * account gets each of them; the server checks again (aiTesterAllowed).
 */
export function useAiTester(): boolean {
  const { user } = useAuth();
  const { data } = useQuery({ ...whoAmIQuery(user?.id ?? ""), enabled: !!user });
  return !!user && (data?.aiTester ?? data?.eventLabels) === true;
}
