/**
 * The Microsoft side of a connected account: the consent screen, tokens, the
 * calendar list (names only) and busy intervals. The same shape as google.ts
 * (OAuthAdapter in oauth.ts), so connecting and syncing treat both alike.
 *
 * Uses the `common` tenant, so both work/school (Entra ID) and personal
 * (Outlook.com / Hotmail) accounts can sign in.
 *
 * Why calendarView and not getSchedule (the obvious "free/busy" endpoint):
 * delegated getSchedule is documented as unsupported for personal Microsoft
 * accounts (Outlook.com / Hotmail), and it is keyed by SMTP address rather
 * than calendar, so it can't give per-calendar busy data for the purpose
 * labels in calendar_sources. calendarView works for both account types and
 * per calendar.
 *
 * Privacy: unlike Google's calendar.freebusy scope, no Microsoft scope is
 * free/busy-only, and Calendars.Read can read event subjects and bodies. So
 * "we never read titles" is enforced here, by always sending an explicit
 * $select of start/end/showAs/isCancelled/isAllDay. Never widen that $select
 * beyond timing and status.
 *
 * Why Calendars.Read rather than the narrower Calendars.ReadBasic: tested
 * against a real personal (Outlook.com) account, ReadBasic authenticates but
 * every calendar call returns 403 ErrorAccessDenied, despite the docs listing
 * it as supported for personal accounts. It may work for work/school accounts,
 * but the account type isn't known until after sign-in, so one scope set has
 * to serve both.
 */
import { requireEnv } from "./env.ts";
import type { Lang } from "./i18n.ts";
import { mergeIntervals, type RawBusyInterval } from "./intervals.ts";
import type { AccountCalendars, OAuthTokens } from "./oauth.ts";
import { isInvalidGrant, ReauthRequired } from "./reauth.ts";
import { DEFAULT_ZONE, wallClockToUtc } from "./timezones.ts";

const AUTHORIZE_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH_URL = "https://graph.microsoft.com/v1.0";

/**
 * offline_access is what makes Microsoft issue a refresh token at all (Google
 * uses access_type=offline instead). Without it the connection dies after the
 * first access token expires, about an hour.
 *
 * User.Read looks unused (we take the account email from the default
 * calendar's owner) but is needed for personal accounts: a token with only a
 * calendar scope got 401 UnknownError from Graph on every endpoint, including
 * /me, until User.Read was also consented.
 */
const SCOPES = [
  "offline_access",
  "https://graph.microsoft.com/Calendars.Read",
  "https://graph.microsoft.com/User.Read",
].join(" ");

/** The app's OAuth client at Microsoft, from the function's secrets. */
function client() {
  return {
    client_id: requireEnv("MICROSOFT_OAUTH_CLIENT_ID"),
    client_secret: requireEnv("MICROSOFT_OAUTH_CLIENT_SECRET"),
  };
}

/** Microsoft's sign-in and consent, coming back to `redirectUri` with `state`. */
export function consentUrl(redirectUri: string, state: string, lang: Lang): string {
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: client().client_id,
    redirect_uri: redirectUri,
    response_type: "code",
    response_mode: "query",
    scope: SCOPES, // includes offline_access, which is what yields a refresh token
    prompt: "select_account", // someone with several Microsoft accounts picks one, also on reconnect
    state,
    ui_locales: lang, // the sign-in in the site's language
  }).toString();
  return url.toString();
}

function tokenRequest(params: Record<string, string>): Promise<Response> {
  return fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...client(), scope: SCOPES, ...params }),
  });
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<OAuthTokens> {
  const res = await tokenRequest({
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  if (!res.ok) {
    throw new Error(`Microsoft token exchange failed: ${res.status} ${await res.text()}`);
  }
  return await res.json();
}

/**
 * Trade the stored refresh token for a fresh access token. Microsoft usually
 * returns a *new* refresh token as well and the old one eventually stops
 * working, so the caller must store the replacement. Throws ReauthRequired
 * when Microsoft refuses the refresh token itself.
 */
export async function refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
  const res = await tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" });
  if (!res.ok) {
    const body = await res.text();
    if (isInvalidGrant(res.status, body)) {
      throw new ReauthRequired("Microsoft no longer accepts this connection's access.");
    }
    throw new Error(`Microsoft token refresh failed: ${res.status} ${body}`);
  }
  return await res.json();
}

/** The shape of a paged Graph collection response. */
interface GraphList<T> {
  value?: T[];
  "@odata.nextLink"?: string;
}

/** The only event fields we ever request (see the $select in queryCalendarChunk). */
export interface GraphEvent {
  start: { dateTime: string };
  end: { dateTime: string };
  showAs?: string;
  isCancelled?: boolean;
  isAllDay?: boolean;
}

/** GET a Graph URL as JSON, backing off on throttling (429) a couple of times. */
async function graphGet<T>(accessToken: string, url: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        // Without this, times come back in UTC anyway; stating it keeps the
        // "append Z" normalisation below honest if a default ever changes.
        Prefer: 'outlook.timezone="UTC"',
      },
    });
    if (res.status === 429 && attempt < 2) {
      const waitSec = Math.min(Number(res.headers.get("Retry-After")) || 2, 20);
      await new Promise((r) => setTimeout(r, waitSec * 1000));
      continue;
    }
    if (!res.ok) {
      // Graph often answers 401 with an empty body; the reason then lives in
      // WWW-Authenticate, so include it (never the token) in the error.
      const wwwAuth = res.headers.get("WWW-Authenticate");
      throw new Error(
        `Microsoft Graph ${res.status} for ${new URL(url).pathname}: ${await res.text()}` +
          (wwwAuth ? ` [WWW-Authenticate: ${wwwAuth}]` : "") +
          ` [request-id: ${res.headers.get("request-id") ?? "n/a"}]`,
      );
    }
    return res.json();
  }
}

interface CalendarListEntry {
  id: string;
  name: string;
  isDefaultCalendar?: boolean;
  owner?: { name?: string; address?: string } | null;
}

/** The account's calendars: names and ids only, never events. */
export async function listCalendars(accessToken: string): Promise<AccountCalendars> {
  const items: CalendarListEntry[] = [];
  let next: string | undefined =
    `${GRAPH_URL}/me/calendars?$select=id,name,isDefaultCalendar,owner&$top=100`;
  while (next) {
    const body: GraphList<CalendarListEntry> = await graphGet(accessToken, next);
    items.push(...(body.value ?? []));
    next = body["@odata.nextLink"];
  }
  // The default calendar's owner is the account itself, which gives its
  // address without a separate /me call.
  const primary = items.find((c) => c.isDefaultCalendar) ?? items[0];
  return {
    calendars: items.map((c) => ({ id: c.id, name: c.name })),
    accountLabel: primary?.owner?.address ?? primary?.name ?? null,
  };
}

// Only these count as "busy". free and workingElsewhere leave you available;
// unknown is what Outlook uses for things like birthdays and holidays.
const BUSY_STATUSES = new Set(["busy", "tentative", "oof"]);
// All-day events also block when free: Outlook makes new all-day events free,
// so a vacation would otherwise not count (the same rule as ics.ts).
const ALL_DAY_BUSY_STATUSES = new Set([...BUSY_STATUSES, "free"]);

/** Whether an event (from the $select below) makes its time busy. */
export function outlookEventBlocks(ev: GraphEvent): boolean {
  if (ev.isCancelled) return false;
  // No status at all is treated like an unknown one: not busy.
  return (ev.isAllDay ? ALL_DAY_BUSY_STATUSES : BUSY_STATUSES).has(ev.showAs ?? "");
}

/**
 * An all-day event's start or end: the date it names, from midnight in Danish
 * time. Graph gives all-day dates as a midnight in the requested zone (UTC),
 * which would place the event an hour or two early; rounding to the nearest
 * midnight first also copes with a midnight converted from another zone.
 */
export function allDayInstant(iso: string): string {
  const nearestMidnight = new Date(Math.round(new Date(iso).getTime() / MS_PER_DAY) * MS_PER_DAY);
  return wallClockToUtc(
    DEFAULT_ZONE,
    nearestMidnight.getUTCFullYear(),
    nearestMidnight.getUTCMonth() + 1,
    nearestMidnight.getUTCDate(),
  ).toISOString();
}

const MS_PER_DAY = 86_400_000;

// calendarView's docs state no maximum date range (unlike Google's
// freeBusy.query, which rejected long ranges). Chunking anyway to keep each
// response bounded and match the Google adapter's behavior. calendarView
// returns every event *overlapping* the window, so an event spanning a chunk
// boundary appears in both chunks: intervals are clipped to their chunk and
// merged afterwards.
const MAX_CHUNK_DAYS = 90;
const PAGE_SIZE = 1000; // calendarView's documented $top maximum

/** Graph returns "2026-09-20T10:00:00.0000000" (UTC, no zone suffix, 7 fractional digits). */
function graphDateTimeToIso(dateTime: string): string {
  const trimmed = dateTime.replace(/(\.\d{3})\d*$/, "$1");
  return new Date(trimmed.endsWith("Z") ? trimmed : `${trimmed}Z`).toISOString();
}

async function queryCalendarChunk(
  accessToken: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<RawBusyInterval[]> {
  const out: RawBusyInterval[] = [];
  const params = new URLSearchParams({
    startDateTime: timeMin.toISOString(),
    endDateTime: timeMax.toISOString(),
    // The privacy line: never select subject, location, organizer, etc.
    $select: "start,end,showAs,isCancelled,isAllDay",
    $top: String(PAGE_SIZE),
  });
  let next: string | undefined =
    `${GRAPH_URL}/me/calendars/${encodeURIComponent(calendarId)}/calendarView?${params}`;
  while (next) {
    const body: GraphList<GraphEvent> = await graphGet(accessToken, next);
    for (const ev of body.value ?? []) {
      if (!outlookEventBlocks(ev)) continue;
      const read = (dateTime: string) => {
        const iso = graphDateTimeToIso(dateTime);
        return new Date(ev.isAllDay ? allDayInstant(iso) : iso).getTime();
      };
      const start = new Date(Math.max(read(ev.start.dateTime), timeMin.getTime()));
      const end = new Date(Math.min(read(ev.end.dateTime), timeMax.getTime()));
      if (end > start) out.push({ start: start.toISOString(), end: end.toISOString() });
    }
    next = body["@odata.nextLink"];
  }
  return out;
}

/**
 * Busy intervals for a set of calendars over one range, keyed by calendar id.
 * The same signature and return shape as Google's queryFreeBusy.
 *
 * Calendars are queried sequentially rather than in parallel: Outlook limits
 * concurrent requests per mailbox (documented as 4), and throttling costs
 * more than it saves.
 */
export async function queryFreeBusy(
  accessToken: string,
  calendarIds: string[],
  timeMin: string,
  timeMax: string,
): Promise<Record<string, RawBusyInterval[]>> {
  const result: Record<string, RawBusyInterval[]> = {};
  const rangeEnd = new Date(timeMax);

  for (const calendarId of calendarIds) {
    const collected: RawBusyInterval[] = [];
    let chunkStart = new Date(timeMin);
    while (chunkStart < rangeEnd) {
      const chunkEnd = new Date(
        Math.min(chunkStart.getTime() + MAX_CHUNK_DAYS * 24 * 60 * 60 * 1000, rangeEnd.getTime()),
      );
      collected.push(...(await queryCalendarChunk(accessToken, calendarId, chunkStart, chunkEnd)));
      chunkStart = chunkEnd;
    }
    result[calendarId] = mergeIntervals(collected);
  }
  return result;
}
