/**
 * Everything Casy holds about one person, for the profile's "Your data"
 * screen and its download (the account function's `data` and `export`).
 * It follows the privacy policy's "What Casy stores" list, one part each,
 * so the screen can be checked against the promise.
 *
 * Only ever the caller's own rows. Credentials are never read: which kind is
 * stored comes from the provider and whether a calendar_secrets row exists,
 * selecting nothing but its key.
 */
import type { Caller } from "./auth.ts";
import type { Db } from "./supabaseAdmin.ts";

export type Provider = "google" | "outlook" | "apple" | "ics";

/** What is kept so an account stays in sync, by kind; never the value. */
export type CredentialKind = "oauth" | "password" | "link";

export interface MyData {
  account: {
    email: string | null;
    /** The name group members see; null until the groups function saved one. */
    name: string | null;
    nameIsCustom: boolean;
    /** How you sign in: "email", "google". */
    signIn: string[];
    /** The language Casy's emails to you are written in, if one is saved ("da", "en"). */
    language: string | null;
    createdAt: string | null;
  };
  calendars: {
    provider: Provider;
    /** The account's own label: an email, or a link's name. */
    label: string | null;
    status: string;
    connectedAt: string;
    lastSyncedAt: string | null;
    credential: CredentialKind | null;
    calendars: {
      /** The provider's own name for it. */
      name: string | null;
      /** The name you gave it, if you did. */
      customName: string | null;
      purpose: string | null;
      priority: string;
      included: boolean;
      busyCount: number;
    }[];
  }[];
  primary: { calendar: string | null; autoAdd: boolean; lang: string } | null;
  busy: {
    count: number;
    first: string | null;
    last: string | null;
    /** The next few, exactly as stored: a start and an end, nothing else. */
    next: { start: string; end: string }[];
  };
  groups: { name: string; members: number; createdByYou: boolean; joinedAt: string }[];
  inviteLinks: { made: number; active: number };
  invitations: { pending: number; declined: number; sent: number };
  emailLookups: number;
  events: { invitedTo: number; suggested: number; answers: number; declined: number };
  calendarEntries: { added: number; deletedByYou: number };
}

/** The full copy: everything above, and every stored busy time. */
export interface MyDataExport extends MyData {
  exportedAt: string;
  busyTimes: { calendar: string | null; start: string; end: string }[];
}

export function credentialKind(provider: Provider, hasSecret: boolean): CredentialKind | null {
  if (!hasSecret) return null;
  if (provider === "apple") return "password";
  if (provider === "ics") return "link";
  return "oauth";
}

/** How the person signs in, from their login: every provider named once, email last. */
export function signInMethods(caller: Caller): string[] {
  const listed = caller.app_metadata?.providers;
  const providers = Array.isArray(listed)
    ? listed.filter((p): p is string => typeof p === "string")
    : typeof caller.app_metadata?.provider === "string"
      ? [caller.app_metadata.provider]
      : [];
  const unique = [...new Set(providers)];
  return [...unique.filter((p) => p !== "email"), ...unique.filter((p) => p === "email")];
}

interface SourceRow {
  id: string;
  display_name: string | null;
  custom_name: string | null;
  purpose: string | null;
  priority: string;
  included: boolean;
  calendar_busy_cache: { count: number }[];
}

export interface ConnectionRow {
  provider: Provider;
  account_label: string | null;
  status: string;
  created_at: string;
  last_synced_at: string | null;
  calendar_secrets: { connection_id: string } | { connection_id: string }[] | null;
  calendar_sources: SourceRow[];
}

/** The accounts and their calendars, each calendar with its own count of busy times. */
export function shapeCalendars(rows: ConnectionRow[]): MyData["calendars"] {
  return rows.map((row) => {
    const secrets = row.calendar_secrets;
    const hasSecret = Array.isArray(secrets) ? secrets.length > 0 : secrets !== null;
    return {
      provider: row.provider,
      label: row.account_label,
      status: row.status,
      connectedAt: row.created_at,
      lastSyncedAt: row.last_synced_at,
      credential: credentialKind(row.provider, hasSecret),
      calendars: row.calendar_sources.map((s) => ({
        name: s.display_name,
        customName: s.custom_name,
        purpose: s.purpose,
        priority: s.priority,
        included: s.included,
        busyCount: s.calendar_busy_cache[0]?.count ?? 0,
      })),
    };
  });
}

export interface MembershipRow {
  joined_at: string;
  friend_groups: {
    name: string;
    created_by: string | null;
    group_members: { count: number }[];
  } | null;
}

export function shapeGroups(rows: MembershipRow[], youId: string): MyData["groups"] {
  return rows
    .filter((row) => row.friend_groups !== null)
    .map(({ joined_at, friend_groups: group }) => ({
      name: group!.name,
      members: group!.group_members[0]?.count ?? 0,
      createdByYou: group!.created_by === youId,
      joinedAt: joined_at,
    }));
}

/** A count, from a query asked for one with `head: true`. */
async function count(query: PromiseLike<{ count: number | null; error: unknown }>) {
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

/** Everything for the screen: one read each, all at once. */
/** The language saved on the account for its emails (auth-email), if it is one Casy writes in. */
export function savedLanguage(caller: Caller): string | null {
  const lang = caller.user_metadata?.lang;
  return lang === "da" || lang === "en" ? lang : null;
}

export async function readMyData(db: Db, caller: Caller, now = new Date()): Promise<MyData> {
  const me = caller.id;
  const head = { count: "exact" as const, head: true };
  const nowIso = now.toISOString();

  const [profile, connections, primary, memberships] = await Promise.all([
    db.from("profiles").select("display_name, name_is_custom").eq("id", me).maybeSingle(),
    db
      .from("calendar_connections")
      .select(
        "id, provider, account_label, status, created_at, last_synced_at, " +
          "calendar_secrets(connection_id), " +
          "calendar_sources(id, display_name, custom_name, purpose, priority, included, calendar_busy_cache(count))",
      )
      .eq("profile_id", me)
      .order("created_at", { ascending: true }),
    db
      .from("primary_calendars")
      .select("auto_add, lang, calendar_sources(display_name, custom_name)")
      .eq("profile_id", me)
      .maybeSingle(),
    db
      .from("group_members")
      .select("joined_at, friend_groups(name, created_by, group_members(count))")
      .eq("profile_id", me)
      .order("joined_at", { ascending: true }),
  ]);
  for (const r of [profile, connections, primary, memberships]) if (r.error) throw r.error;

  const connectionRows = connections.data as unknown as (ConnectionRow & { id: string })[];
  const sourceIds = connectionRows.flatMap((c) => c.calendar_sources.map((s) => s.id));
  // No calendars: an empty `in` list would be a malformed filter, so skip the reads.
  const busyRange = (ascending: boolean, column: "start_at" | "end_at") =>
    db
      .from("calendar_busy_cache")
      .select("start_at, end_at")
      .in("source_id", sourceIds)
      .order(column, { ascending })
      .limit(1)
      .maybeSingle();

  const [
    busyCount,
    first,
    last,
    next,
    linksMade,
    linksActive,
    pending,
    declined,
    sent,
    lookups,
    invitedTo,
    suggested,
    answers,
    declinedDates,
    added,
    deleted,
  ] = await Promise.all([
    sourceIds.length
      ? count(db.from("calendar_busy_cache").select("id", head).in("source_id", sourceIds))
      : 0,
    sourceIds.length ? busyRange(true, "start_at") : null,
    sourceIds.length ? busyRange(false, "end_at") : null,
    sourceIds.length
      ? db
          .from("calendar_busy_cache")
          .select("start_at, end_at")
          .in("source_id", sourceIds)
          .gte("end_at", nowIso)
          .order("start_at", { ascending: true })
          .limit(3)
      : null,
    count(db.from("group_invites").select("id", head).eq("created_by", me)),
    count(
      db.from("group_invites").select("id", head).eq("created_by", me).gt("expires_at", nowIso),
    ),
    count(
      db
        .from("group_invitations")
        .select("group_id", head)
        .eq("profile_id", me)
        .eq("status", "pending"),
    ),
    count(
      db
        .from("group_invitations")
        .select("group_id", head)
        .eq("profile_id", me)
        .eq("status", "declined"),
    ),
    count(db.from("group_invitations").select("group_id", head).eq("invited_by", me)),
    count(db.from("group_email_lookups").select("id", head).eq("profile_id", me)),
    count(db.from("event_invitees").select("proposal_id", head).eq("profile_id", me)),
    count(db.from("event_proposals").select("id", head).eq("created_by", me)),
    count(db.from("event_responses").select("date_id", head).eq("profile_id", me)),
    count(db.from("event_proposal_dates").select("id", head).eq("declined_by", me)),
    count(
      db
        .from("calendar_event_writes")
        .select("proposal_id", head)
        .eq("profile_id", me)
        .eq("added", true),
    ),
    count(
      db
        .from("calendar_event_writes")
        .select("proposal_id", head)
        .eq("profile_id", me)
        .not("gone_at", "is", null),
    ),
  ]);
  for (const r of [first, last, next]) if (r?.error) throw r.error;

  const primaryRow = primary.data as unknown as {
    auto_add: boolean;
    lang: string;
    calendar_sources: { display_name: string | null; custom_name: string | null } | null;
  } | null;
  const profileRow = profile.data as {
    display_name: string | null;
    name_is_custom: boolean;
  } | null;
  const blocks = (next?.data ?? []) as { start_at: string; end_at: string }[];

  return {
    account: {
      email: caller.email ?? null,
      name: profileRow?.display_name ?? null,
      nameIsCustom: profileRow?.name_is_custom ?? false,
      signIn: signInMethods(caller),
      language: savedLanguage(caller),
      createdAt: caller.created_at ?? null,
    },
    calendars: shapeCalendars(connectionRows),
    primary: primaryRow
      ? {
          calendar:
            primaryRow.calendar_sources?.custom_name ??
            primaryRow.calendar_sources?.display_name ??
            null,
          autoAdd: primaryRow.auto_add,
          lang: primaryRow.lang,
        }
      : null,
    busy: {
      count: busyCount,
      first: (first?.data as { start_at: string } | null)?.start_at ?? null,
      last: (last?.data as { end_at: string } | null)?.end_at ?? null,
      next: blocks.map((b) => ({ start: b.start_at, end: b.end_at })),
    },
    groups: shapeGroups(memberships.data as unknown as MembershipRow[], me),
    inviteLinks: { made: linksMade, active: linksActive },
    invitations: { pending, declined, sent },
    emailLookups: lookups,
    events: { invitedTo, suggested, answers, declined: declinedDates },
    calendarEntries: { added, deletedByYou: deleted },
  };
}

/** The most rows the database hands back at once. */
const PAGE = 1000;

/** The download: the screen's data and every stored busy time, page by page. */
export async function exportMyData(
  db: Db,
  caller: Caller,
  now = new Date(),
): Promise<MyDataExport> {
  const data = await readMyData(db, caller, now);
  const { data: sources, error } = await db
    .from("calendar_sources")
    .select("id, display_name, custom_name, calendar_connections!inner(profile_id)")
    .eq("calendar_connections.profile_id", caller.id);
  if (error) throw error;
  const names = new Map(
    (sources as { id: string; display_name: string | null; custom_name: string | null }[]).map(
      (s) => [s.id, s.custom_name ?? s.display_name],
    ),
  );

  const busyTimes: MyDataExport["busyTimes"] = [];
  if (names.size > 0) {
    for (let from = 0; ; from += PAGE) {
      const { data: page, error: pageError } = await db
        .from("calendar_busy_cache")
        .select("source_id, start_at, end_at")
        .in("source_id", [...names.keys()])
        .order("start_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (pageError) throw pageError;
      const rows = page as { source_id: string; start_at: string; end_at: string }[];
      for (const r of rows) {
        busyTimes.push({
          calendar: names.get(r.source_id) ?? null,
          start: r.start_at,
          end: r.end_at,
        });
      }
      if (rows.length < PAGE) break;
    }
  }
  return { ...data, exportedAt: now.toISOString(), busyTimes };
}
