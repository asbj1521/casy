import { queryOptions } from "@tanstack/react-query";

import { currentMessages } from "@/i18n/current";
import { callFunction } from "@/lib/supabaseFunctions";

// Apart from the rest of admin.ts, which only admin mode needs: the header
// and the profile ask this of everyone (#157).

/** Whether the signed-in person is an admin. `userId` only keys the cache. */
export function adminStatusQuery(userId: string) {
  return queryOptions({
    queryKey: ["admin-status", userId],
    queryFn: async () =>
      (
        await callFunction<{ isAdmin: boolean }>("admin", {
          body: { action: "status" },
          errorMessage: currentMessages().api.checkAdmin,
        })
      ).isAdmin,
    // Being an admin changes only when the secret does, so asking now and then
    // is plenty. Not never: the answer is remembered across reloads (see
    // queryPersistence.ts), and a remembered "yes" must still be re-checked.
    staleTime: 5 * 60_000,
    retry: false,
  });
}
