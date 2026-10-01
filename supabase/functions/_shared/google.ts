/**
 * The Google side of a connected account: the consent screen, tokens, the
 * calendar list (names only) and free/busy. The same shape as outlook.ts
 * (OAuthAdapter in oauth.ts), so connecting and syncing treat both alike.
 *
 * Scopes are deliberately minimal: freebusy (busy/free intervals, never
 * event titles) and calendarlist.readonly (calendar *names*, so each one can
 * be given a category on My calendar).
 */
import { requireEnv } from "./env.ts";
import type { Lang } from "./i18n.ts";
import type { RawBusyInterval } from "./intervals.ts";
import type { AccountCalendars, OAuthTokens } from "./oauth.ts";
import { isInvalidGrant, ReauthRequired } from "./reauth.ts";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_LIST_URL = "https://www.googleapis.com/calendar/v3/users/me/calendarList";
const FREEBUSY_URL = "https://www.googleapis.com/calendar/v3/freeBusy";
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
].join(" ");

/** The app's OAuth client at Google, from the function's secrets. */
function client() {
  return {
    client_id: requireEnv("GOOGLE_OAUTH_CLIENT_ID"),
    client_secret: requireEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
  };
}

/** Google's consent screen, coming back to `redirectUri` with `state`. */
export function consentUrl(redirectUri: string, state: string, lang: Lang): string {
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: client().client_id,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline", // needed to receive a refresh token
    // consent guarantees a refresh token even on re-connect; select_account
    // always shows Google's account chooser, so a second account can be added
    // instead of Google silently reusing the one already signed in.
    prompt: "select_account consent",
    state,
    hl: lang, // the consent screen in the site's language
  }).toString();
  return url.toString();
}

function tokenRequest(params: Record<string, string>): Promise<Response> {
  return fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...client(), ...params }),
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
    throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  }
  return await res.json();
}

/**
 * Trade the stored refresh token for a fresh access token (they last an
 * hour). Throws ReauthRequired when Google refuses the refresh token itself:
 * revoked by its owner, or expired.
 */
export async function refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
  const res = await tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" });
  if (!res.ok) {
    const body = await res.text();
    if (isInvalidGrant(res.status, body)) {
      throw new ReauthRequired("Google no longer accepts this connection's access.");
    }
    throw new Error(`Google token refresh failed: ${res.status} ${body}`);
  }
  return await res.json();
}

interface CalendarListEntry {
  id: string;
  summary: string;
  primary?: boolean;
}

/**
 * Google's built-in calendars for holidays ("en.danish#holiday@group.v.calendar.google.com")
 * and week numbers ("e_2_en#weeknum@group.v.calendar.google.com"). They aren't
 * part of the user's account data, and free/busy answers "notFound" for them.
 * Casy provides both itself, a built-in Danish holiday calendar and a
 * week-number column, so importing them would only add empty per-account
 * calendars to the list.
 */
function isGoogleBuiltInCalendar(id: string): boolean {
  return (
    id.endsWith("#holiday@group.v.calendar.google.com") ||
    id.endsWith("#weeknum@group.v.calendar.google.com")
  );
}

/** The account's calendars: names and ids only, never events. */
export async function listCalendars(accessToken: string): Promise<AccountCalendars> {
  const items: CalendarListEntry[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(CALENDAR_LIST_URL);
    url.searchParams.set("minAccessRole", "freeBusyReader");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Google calendarList failed: ${res.status} ${await res.text()}`);
    }
    const body = await res.json();
    items.push(
      ...(body.items ?? []).filter((c: CalendarListEntry) => !isGoogleBuiltInCalendar(c.id)),
    );
    pageToken = body.nextPageToken;
  } while (pageToken);

  // The primary calendar's id is the account's own address.
  const primary = items.find((c) => c.primary) ?? items[0];
  return {
    calendars: items.map((c) => ({ id: c.id, name: c.summary })),
    accountLabel: primary?.id ?? null,
  };
}

/**
 * Free/busy for a set of calendars over one range, keyed by calendar id.
 *
 * Google rejects a single freeBusy.query whose range is too long (observed
 * as a "timeRangeTooLong" 400 past roughly three months), so a request
 * spanning a year (which an initial full sync does) is chunked into
 * smaller windows run sequentially, with each calendar's results merged
 * across chunks. Callers never see the chunking; they get back the same
 * shape as a single query over the whole range.
 */
const MAX_CHUNK_DAYS = 90;

async function queryFreeBusyChunk(
  accessToken: string,
  calendarIds: string[],
  timeMin: string,
  timeMax: string,
): Promise<Record<string, RawBusyInterval[]>> {
  const res = await fetch(FREEBUSY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: calendarIds.map((id) => ({ id })),
    }),
  });
  if (!res.ok) {
    throw new Error(`Google freeBusy failed: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  const out: Record<string, RawBusyInterval[]> = {};
  for (const [calendarId, entry] of Object.entries<{ busy?: RawBusyInterval[] }>(
    body.calendars ?? {},
  )) {
    out[calendarId] = entry.busy ?? [];
  }
  return out;
}

export async function queryFreeBusy(
  accessToken: string,
  calendarIds: string[],
  timeMin: string,
  timeMax: string,
): Promise<Record<string, RawBusyInterval[]>> {
  const merged: Record<string, RawBusyInterval[]> = {};
  for (const id of calendarIds) merged[id] = [];

  let chunkStart = new Date(timeMin);
  const end = new Date(timeMax);
  while (chunkStart < end) {
    const chunkEnd = new Date(
      Math.min(chunkStart.getTime() + MAX_CHUNK_DAYS * 24 * 60 * 60 * 1000, end.getTime()),
    );
    const chunkResult = await queryFreeBusyChunk(
      accessToken,
      calendarIds,
      chunkStart.toISOString(),
      chunkEnd.toISOString(),
    );
    for (const [calendarId, intervals] of Object.entries(chunkResult)) {
      (merged[calendarId] ??= []).push(...intervals);
    }
    chunkStart = chunkEnd;
  }
  return merged;
}
