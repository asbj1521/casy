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
