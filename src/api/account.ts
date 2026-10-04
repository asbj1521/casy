/**
 * The signed-in person's own account, backed by the `account` Edge Function.
 * The function learns whose account from the login token, never from here.
 */
import { queryOptions } from "@tanstack/react-query";

import { currentMessages } from "@/i18n/current";
import { callFunction } from "@/lib/supabaseFunctions";
import type { CalendarPriority, CalendarProvider, CalendarPurpose } from "@/types";

/**
 * Delete your account and everything it owns (see supabase/functions/
 * _shared/accounts.ts). The page asks for a typed confirmation first;
 * `confirm: true` is the server's own guard against a stray call.
 */
export async function deleteMyAccount(): Promise<void> {
  await callFunction("account", {
    body: { action: "delete", confirm: true },
    errorMessage: currentMessages().api.deleteAccount,
  });
}

/**
 * Everything Casy holds about you, as the account function's `data` answers
 * it (supabase/functions/_shared/myData.ts, which this mirrors). Credentials
 * appear only by kind; their values never leave the server.
 */
export interface MyData {
  account: {
    email: string | null;
    name: string | null;
    nameIsCustom: boolean;
    signIn: string[];
    createdAt: string | null;
  };
  calendars: {
    provider: CalendarProvider;
    label: string | null;
    status: string;
    connectedAt: string;
    lastSyncedAt: string | null;
    credential: "oauth" | "password" | "link" | null;
    calendars: {
      name: string | null;
      customName: string | null;
      purpose: CalendarPurpose | null;
      priority: CalendarPriority;
      included: boolean;
      busyCount: number;
    }[];
  }[];
  primary: { calendar: string | null; autoAdd: boolean; lang: string } | null;
  busy: {
    count: number;
    first: string | null;
    last: string | null;
    next: { start: string; end: string }[];
  };
  groups: { name: string; members: number; createdByYou: boolean; joinedAt: string }[];
  inviteLinks: { made: number; active: number };
  invitations: { pending: number; declined: number; sent: number };
  emailLookups: number;
  events: { invitedTo: number; suggested: number; answers: number; declined: number };
  calendarEntries: { added: number; deletedByYou: number };
}

/**
 * Your data, fresh every time the screen opens: never kept on the device
 * (it is not among queryPersistence.ts's queries) and never served stale.
 */
export function myDataQuery(userId: string) {
  return queryOptions({
    queryKey: ["my-data", userId],
    queryFn: async (): Promise<MyData> =>
      await callFunction<MyData>("account", {
        body: { action: "data" },
        errorMessage: currentMessages().api.loadMyData,
      }),
    staleTime: 0,
    gcTime: 0,
  });
}

/**
 * The same with every stored busy time, saved as a JSON file. Built in the
 * browser from the answer, so nothing extra is stored anywhere.
 */
export async function downloadMyData(): Promise<void> {
  const data = await callFunction<unknown>("account", {
    body: { action: "export" },
    errorMessage: currentMessages().api.loadMyData,
  });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `casy-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  // After the click has had its turn: revoking at once can cancel the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
