/**
 * Inviting friends from the phone's contacts (#149), through the app's own
 * Invite plugin (InvitePlugin.swift): iOS's contact picker, which needs no
 * permission and hands back only the people picked, then Messages with the
 * invite filled in. What the picker returns stays on the phone; it is never
 * sent to Casy. The app's only: the website never calls it (isNativeApp).
 *
 * As in phoneCalendar.ts, @capacitor/core loads on first use and only the
 * module goes through promises, never the plugin itself.
 */

/** One person picked: their name and every number and email they have. */
export interface PickedContact {
  name: string;
  phones: string[];
  emails: string[];
}

export type TextResult = "sent" | "cancelled" | "failed";

interface InvitePlugin {
  pickContacts(): Promise<{ contacts: PickedContact[] }>;
  canText(): Promise<{ able: boolean }>;
  text(options: { recipients: string[]; body: string }): Promise<{ result: TextResult }>;
}

let plugin: InvitePlugin | null = null;

async function invitePlugin(): Promise<{ plugin: InvitePlugin }> {
  if (!plugin) {
    const { registerPlugin } = await import("@capacitor/core");
    plugin = registerPlugin<InvitePlugin>("Invite");
  }
  // Wrapped: resolving a promise with the plugin itself would never settle.
  return { plugin };
}

/** The people picked; none when the picker was closed. */
export async function pickContacts(): Promise<PickedContact[]> {
  const { plugin } = await invitePlugin();
  return (await plugin.pickContacts()).contacts;
}

/** Whether this phone can send a message (not the simulator, nor a phone without Messages). */
export async function canText(): Promise<boolean> {
  const { plugin } = await invitePlugin();
  return (await plugin.canText()).able;
}

/** Messages with the recipients and text filled in; the person still presses send. */
export async function textInvite(recipients: string[], body: string): Promise<TextResult> {
  const { plugin } = await invitePlugin();
  return (await plugin.text({ recipients, body })).result;
}

/**
 * Who to send the message to: each person's first number (a text reaches
 * anyone), or their first email (iMessage) when they have no number. Each
 * address once, people with neither left out.
 */
export function recipientsOf(contacts: PickedContact[]): string[] {
  const all = contacts
    .map((c) => c.phones.find((p) => p.trim()) ?? c.emails.find((e) => e.trim()))
    .filter((a): a is string => !!a)
    .map((a) => a.trim());
  return [...new Set(all)];
}
