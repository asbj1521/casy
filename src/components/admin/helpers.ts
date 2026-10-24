/** What the admin panel's rows share (#160, split out of AdminPanel.tsx). */

import { LOCALE } from "@/i18n/lang";
import type { Lang } from "@/i18n/locale";

export type Tab = "groups" | "users" | "calendars";

/** What a confirm panel is open for: a whole group, or one member of one. */
export type Confirm =
  { kind: "group"; groupId: string } | { kind: "member"; groupId: string; profileId: string };

/** The error text of whichever mutation failed, for the row it failed on. */
export function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/** Case-insensitive "does any of these contain the query". */
export function matches(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  return !q || fields.some((f) => f?.toLowerCase().includes(q));
}

/** What deleting one account takes with it, as the confirm step spells it out. */
export interface UserImpact {
  /** Calendar accounts of any status: all of them go. */
  calendarAccounts: number;
  groups: number;
  /** Groups they are the only member of, which are deleted with them. */
  soleGroups: number;
}

/** "0,03 US$", or "< 0,01 US$" for less: an estimate, so two decimals is plenty. */
export function dollars(amount: number, lang: Lang): string {
  const format = new Intl.NumberFormat(LOCALE[lang], { style: "currency", currency: "USD" });
  return amount > 0 && amount < 0.01 ? `< ${format.format(0.01)}` : format.format(amount);
}
