/**
 * Connecting a Google or Microsoft account. Each provider has two functions,
 * oauth-<provider>-start and oauth-<provider>-callback, and each is this file
 * with the provider's name filled in. What differs between the providers
 * lives in their adapters (google.ts, outlook.ts), which share one shape.
 *
 * Start is called with fetch() by the signed-in person, not by opening a
 * link: a plain navigation can't carry their login, and the login is what
 * says whose calendar this becomes. So instead of redirecting, it answers
 * with the consent screen's address and the page sends the browser there.
 * The caller's id travels to the callback inside the signed `state`
 * (state.ts), which is why the callback can trust it without a login of its
 * own, together with the site to go back to (checked against frontend.ts).
 *
 * The callback is the provider sending the browser back with a one-time
 * code. It trades the code for tokens, lists the account's calendars (names
 * only), fetches their busy times once so the profile has real data straight
 * away, stores it all and sends the browser back to the profile with
 * `connected=<provider>` or `error=<provider>:<reason>` for the page to show.
 */
import { requireCaller } from "./auth.ts";
import { discardIfRepeatedCallback, pruneSupersededConnections } from "./connections.ts";
import { requireEnv } from "./env.ts";
import { allowedFrontends, pickFrontend } from "./frontend.ts";
import * as google from "./google.ts";
import { serve } from "./http.ts";
import { type Lang, langOf } from "./i18n.ts";
import type { RawBusyInterval } from "./intervals.ts";
import * as outlook from "./outlook.ts";
import { encryptionKeyFromEnv, encryptSecret } from "./secretBox.ts";
import { signState, verifyState } from "./state.ts";
import { createConnection, fillConnection } from "./storeCalendars.ts";
import { supabaseAdmin } from "./supabaseAdmin.ts";
import { syncWindow } from "./syncWindow.ts";

export type OAuthProvider = "google" | "outlook";

export interface OAuthTokens {
  access_token: string;
  /** How later syncs get new access tokens; always asked for, not always sent. */
  refresh_token?: string;
  /** Seconds the access token lasts. */
  expires_in: number;
}

/** An account's calendars, names only, and the address it belongs to. */
export interface AccountCalendars {
  calendars: { id: string; name: string }[];
  accountLabel: string | null;
}

/** What an adapter offers. The token refresh, used only by syncs, has the same shape in both. */
interface OAuthAdapter {
  consentUrl(redirectUri: string, state: string, lang: Lang): string;
  exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokens>;
  listCalendars(accessToken: string): Promise<AccountCalendars>;
  queryFreeBusy(
    accessToken: string,
    calendarIds: string[],
    timeMin: string,
    timeMax: string,
  ): Promise<Record<string, RawBusyInterval[]>>;
}

const ADAPTERS: Record<OAuthProvider, OAuthAdapter> = { google, outlook };

/** Where the provider sends the browser back to, registered with it as exactly this. */
function callbackUrl(provider: OAuthProvider): string {
  return `${requireEnv("FUNCTIONS_BASE_URL")}/oauth-${provider}-callback`;
}

export function serveOAuthStart(provider: OAuthProvider): void {
  serve(`oauth-${provider}-start`, async (req) => {
    const { id: profileId } = await requireCaller(req, supabaseAdmin());
    const state = await signState(
      {
        profileId,
        nonce: crypto.randomUUID(),
        ts: Date.now(),
        // The browser names the site the request came from; the callback
        // only honours it if it's on the allowlist.
        returnTo: req.headers.get("Origin") ?? undefined,
      },
      requireEnv("OAUTH_STATE_SECRET"),
    );
    return { url: ADAPTERS[provider].consentUrl(callbackUrl(provider), state, langOf(req)) };
  });
}

export function serveOAuthCallback(provider: OAuthProvider): void {
  Deno.serve(async (req) => {
    const params = new URL(req.url).searchParams;

    // Without these there is no checking the state and nowhere safe to put
    // the tokens, so nothing is written.
    let config: { stateSecret: string; key: string; redirectUri: string } | null = null;
    try {
      config = {
        stateSecret: requireEnv("OAUTH_STATE_SECRET"),
        key: encryptionKeyFromEnv(),
        redirectUri: callbackUrl(provider),
      };
    } catch (err) {
      console.error(`oauth-${provider}-callback is not configured`, err);
    }

    // Read first, so even an early error lands back on the site the connect
    // started from; a missing or forged state just means the default site.
    const rawState = params.get("state");
    const state = config && rawState ? await verifyState(rawState, config.stateSecret) : null;
    const frontend = pickFrontend(state?.returnTo, allowedFrontends());
    // Back to the profile page, which reads the outcome from the address.
    const back = (outcome: { connected: OAuthProvider } | { error: string }) => {
      const url = new URL("/profile", frontend);
      for (const [name, value] of Object.entries(outcome)) url.searchParams.set(name, value);
      return Response.redirect(url.toString(), 302);
    };
    const fail = (reason: string) => back({ error: `${provider}:${reason}` });

    const denied = params.get("error");
    if (denied) {
      // The person declined, or the provider failed. Its description (with
      // Microsoft's AADSTS detail) goes to the logs, never into the redirect.
      console.error(`${provider} returned an OAuth error`, denied, params.get("error_description"));
      return fail(denied);
    }
    const code = params.get("code");
    if (!code || !rawState) return fail("missing_code_or_state");
    if (!config) return fail("server_misconfigured");
    if (!state) return fail("invalid_state");
    const { profileId } = state;

    // The attempt gets its row before anything can fail, so a failure has
    // somewhere to be shown and a repeated callback something to be measured
    // against (connections.ts).
    const db = supabaseAdmin();
    let connection: { id: string; created_at: string };
    try {
      connection = await createConnection(db, profileId, provider);
    } catch (err) {
      console.error(`oauth-${provider}-callback could not record the attempt`, err);
      return fail("db_error");
    }

    try {
      const adapter = ADAPTERS[provider];
      const tokens = await adapter.exchangeCodeForTokens(code, config.redirectUri);
      // Without it there is no refreshing access later: better to fail now
      // than to store a connection that dies within the hour.
      if (!tokens.refresh_token) throw new Error(`${provider} did not return a refresh token`);
      const { calendars, accountLabel } = await adapter.listCalendars(tokens.access_token);
      const range = syncWindow();
      const busy = await adapter.queryFreeBusy(
        tokens.access_token,
        calendars.map((c) => c.id),
        range.start.toISOString(),
        range.end.toISOString(),
      );

      await fillConnection(db, connection.id, {
        accountLabel,
        secrets: {
          access_token: await encryptSecret(tokens.access_token, config.key),
          refresh_token: await encryptSecret(tokens.refresh_token, config.key),
          expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        },
        calendars: calendars.map((c) => ({
          externalId: c.id,
          displayName: c.name,
          intervals: busy[c.id] ?? [],
        })),
      });
      // Several accounts per provider are fine: this replaces an older
      // connection of the same account and clears failed attempts, but
      // leaves other accounts alone.
      await pruneSupersededConnections(db, {
        profileId,
        provider,
        keepId: connection.id,
        accountLabel,
      });
      return back({ connected: provider });
    } catch (err) {
      console.error(`oauth-${provider}-callback failed`, err);
      // The same redirect can reach us twice (a browser or network retry).
      // The provider hands its one-time code to the first request and refuses
      // the second with invalid_grant, which is no failure at all: the
      // account connected. Drop this duplicate instead of recording an error.
      if (await discardIfRepeatedCallback(db, { connection, profileId, provider, failure: err })) {
        return back({ connected: provider });
      }
      await db
        .from("calendar_connections")
        .update({ status: "error", error_message: String(err) })
        .eq("id", connection.id);
      return fail("connect_failed");
    }
  });
}
