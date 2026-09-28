/**
 * Connecting an iCloud account, backed by the `calendar-add-apple` Edge
 * Function.
 *
 * Two places connect one: the quick form on the profile page's Apple card,
 * and the step-by-step setup at /help/connect-icloud. Both go through here,
 * so they can't drift apart in what they send or in what they refresh once
 * the account is in.
 */
import type { QueryClient } from "@tanstack/react-query";

import { currentMessages } from "@/i18n/current";
import { callFunction } from "@/lib/supabaseFunctions";

/** What the function found in the account. */
export interface AppleConnectResult {
  connectionId: string;
  /** The Apple Account email, which is what the profile page lists the account as. */
  label: string;
  calendars: number;
  busyBlocks: number;
  /** Events Apple sent that couldn't be read, and were left out. */
  skippedEvents: number;
}

/**
 * Sign in to iCloud with an app-specific password and copy the account's busy
 * times, then refresh everything that shows them. The calendar list is
 * refetched before this returns, so the profile page lists the new account
 * the moment its form closes; busy times catch up in the background.
 */
export async function connectApple(
  queryClient: QueryClient,
  userId: string,
  username: string,
  password: string,
): Promise<AppleConnectResult> {
  const result = await callFunction<AppleConnectResult>("calendar-add-apple", {
    body: { username, password },
    errorMessage: currentMessages().profile.couldntIcloud,
  });
  void queryClient.invalidateQueries({ queryKey: ["calendar-busy"] });
  void queryClient.invalidateQueries({ queryKey: ["group-busy"] });
  await queryClient.invalidateQueries({ queryKey: ["calendar-status", userId] });
  return result;
}
