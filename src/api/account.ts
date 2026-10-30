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
 * Right after a Sign in with Apple (#138): its one-time code, which the
 * server trades for what it needs to revoke the sign-in when the account is
 * deleted (supabase/functions/_shared/appleSignIn.ts).
 */
export async function saveAppleSignIn(code: string): Promise<void> {
  await callFunction("account", {
    body: { action: "apple-token", code },
    errorMessage: currentMessages().signIn.appleFailed,
  });
}

/** This phone's APNs token (#139), after a yes to notifications, and the language to write them in. */
export async function registerPushToken(token: string, lang: "da" | "en"): Promise<void> {
  await callFunction("account", {
    body: { action: "push-register", token, lang },
    errorMessage: currentMessages().push.failed,
  });
}

/** This phone's token taken back from the account (signing out). */
export async function unregisterPushToken(token: string): Promise<void> {
  await callFunction("account", {
    body: { action: "push-unregister", token },
    errorMessage: currentMessages().push.failed,
  });
}

/** Which notification kinds are switched off, and how many phones they go to (#139). */
export const pushSettingsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["push-settings", userId],
    queryFn: () =>
      callFunction<{ off: string[]; devices: number }>("account", {
        body: { action: "push-settings" },
        errorMessage: currentMessages().push.failed,
      }),
  });

/** One notification kind switched on or off; answers the kinds now off. */
export async function setPushKind(kind: string, on: boolean): Promise<{ off: string[] }> {
  return await callFunction("account", {
    body: { action: "push-set", kind, on },
    errorMessage: currentMessages().push.failed,
  });
}

/**
 * Say yes (or take the yes back) to Casy's AI using content from your calendar
 * (#120): the names of your calendars and the titles of your events. The
 * server refuses the AI features that read them without it.
 */
export async function setAiConsent(on: boolean): Promise<void> {
  await callFunction("account", {
    body: { action: "ai-consent", on },
    errorMessage: currentMessages().aiConsent.failed,
  });
}

/**
 * Switch the sending of your corrections of the AI to Casy for review (#122)
 * on or off, without taking back your yes to the AI using your calendar.
 */
export async function setAiShare(on: boolean): Promise<void> {
  await callFunction("account", {
    body: { action: "ai-share", on },
    errorMessage: currentMessages().aiConsent.failed,
  });
}

/** Delete every correction you sent to Casy (#122). */
export async function deleteMyCorrections(): Promise<void> {
  await callFunction("account", {
    body: { action: "corrections-delete" },
    errorMessage: currentMessages().aiConsent.failed,
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
    /** Notifications (#139): the phones they go to, and the kinds switched off. */
    push: { devices: number; off: string[] };
    /** A Sign in with Apple token is kept, only to revoke it when the account is deleted (#138). */
    appleToken: boolean;
    /** The language Casy's emails are written in, if one is saved. */
    language: string | null;
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
      /** Casy's AI guessed the category (#118). */
      purposeGuessed: boolean;
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
  groups: {
    name: string;
    description: string | null;
    members: number;
    createdByYou: boolean;
    joinedAt: string;
  }[];
  inviteLinks: { made: number; active: number };
  invitations: { pending: number; declined: number; sent: number };
  emailLookups: number;
  events: { invitedTo: number; suggested: number; answers: number; declined: number };
  calendarEntries: { added: number; deletedByYou: number };
  /** Time you told Casy that is in no calendar (#116): how many entries are kept. */
  toldCasy: { count: number };
  /** Genveje (#175): how many plans you saved to run again. */
  shortcuts: { count: number };
  /** Report and block (#142): how many people you blocked, and your reports Casy keeps. */
  safety: { blocked: number; reportsSent: number };
  /**
   * Whether the AI features are on for you (#111), your AI calls recorded (30
   * days), and your yes to the AI using content from your calendar (#120):
   * when you gave it, and whether it is under today's wording.
   */
  ai: {
    allowed: boolean;
    calls: number;
    consent: { givenAt: string; current: boolean } | null;
    /** Corrections of the AI you sent to Casy for review (#122): how many are kept, and whether they are sent. */
    corrections: { kept: number; sharing: boolean };
  };
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
