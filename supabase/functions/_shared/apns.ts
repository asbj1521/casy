/**
 * Sending a push notification to an iPhone (#139): Apple Push Notification
 * service, over HTTP/2, authorised by a JWT signed with the APNs key from the
 * developer account (appleJwt.ts). Apple wants that token reused for 20 to
 * 60 minutes, not made per push, so it is kept for 40.
 *
 * A token belongs to one of APNs' two servers: an app run from Xcode gets a
 * sandbox token, TestFlight and the App Store a production one, and the page
 * can't tell which it has. So a token is tried on the server it last worked
 * on (production first when there is none), and on the other when Apple says
 * it doesn't know it (BadDeviceToken), or the key is made for the other
 * server only (BadEnvironmentKeyInToken); `deliver` answers which one took it.
 */
import { signAppleJwt } from "./appleJwt.ts";
import { APPLE_CLIENT_ID } from "./appleSignIn.ts";
import { requireEnv } from "./env.ts";

export type ApnsEnvironment = "production" | "sandbox";

const HOSTS: Record<ApnsEnvironment, string> = {
  production: "https://api.push.apple.com",
  sandbox: "https://api.sandbox.push.apple.com",
};

/** How long one provider token is used before a new one is made. */
const TOKEN_REUSE_MS = 40 * 60_000;
/** A notification Apple couldn't deliver at once is dropped after this. */
const KEEP_TRYING_S = 24 * 3600;

/** The APNs key, from the developer account. */
export interface ApnsKey {
  teamId: string;
  keyId: string;
  /** The .p8 file's contents (PEM), as downloaded. */
  privateKey: string;
}

export function apnsKeyFromEnv(): ApnsKey {
  return {
    teamId: requireEnv("APPLE_TEAM_ID"),
    keyId: requireEnv("APNS_KEY_ID"),
    privateKey: requireEnv("APNS_KEY"),
  };
}

let cached: { keyId: string; token: string; until: number } | null = null;

/** The token APNs takes as authorisation, made again every 40 minutes. */
export async function providerToken(key: ApnsKey, now = Date.now()): Promise<string> {
  if (cached && cached.keyId === key.keyId && cached.until > now) return cached.token;
  const token = await signAppleJwt(key.privateKey, "APNS_KEY", key.keyId, {
    iss: key.teamId,
    iat: Math.floor(now / 1000),
  });
  cached = { keyId: key.keyId, token, until: now + TOKEN_REUSE_MS };
  return token;
}

/** Forget the provider token kept (tests, and after Apple refused it). */
export function forgetProviderToken(): void {
  cached = null;
}

/** What a notification says, and where a tap on it leads in the app. */
export interface PushMessage {
  title: string;
  body: string;
  /** A path in the app ("/events/…/dates"), opened on a tap. */
  url?: string;
  /** Notifications about the same thing are grouped under it on the lock screen. */
  thread?: string;
}

/** What Apple made of one push. */
type Outcome =
  | { result: "sent" }
  | { result: "gone" }
  | { result: "wrong-server" }
  | { result: "failed"; reason: string };

async function sendTo(
  environment: ApnsEnvironment,
  deviceToken: string,
  message: PushMessage,
  key: ApnsKey,
): Promise<Outcome> {
  const res = await fetch(`${HOSTS[environment]}/3/device/${deviceToken}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${await providerToken(key)}`,
      "apns-topic": APPLE_CLIENT_ID,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-expiration": String(Math.floor(Date.now() / 1000) + KEEP_TRYING_S),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      aps: {
        alert: { title: message.title, body: message.body },
        sound: "default",
        ...(message.thread ? { "thread-id": message.thread } : {}),
      },
      ...(message.url ? { url: message.url } : {}),
    }),
  });
  if (res.ok) return { result: "sent" };
  let reason = `HTTP ${res.status}`;
  try {
    const body = await res.json();
    if (typeof body?.reason === "string") reason = body.reason;
  } catch {
    // No JSON: the status says enough.
  }
  // The app is gone from the phone, or the token was replaced.
  if (res.status === 410 || reason === "Unregistered") return { result: "gone" };
  // The token, or the key (made for one server only), belongs to the other server.
  if (reason === "BadDeviceToken" || reason === "BadEnvironmentKeyInToken") {
    return { result: "wrong-server" };
  }
  if (reason === "ExpiredProviderToken" || reason === "InvalidProviderToken") {
    forgetProviderToken();
  }
  return { result: "failed", reason };
}

/**
 * Send one notification to one phone. `environment` is where its token last
 * worked, if known. Answers what happened, and which server took the token.
 */
export async function deliver(
  deviceToken: string,
  environment: ApnsEnvironment | null,
  message: PushMessage,
  key: ApnsKey,
): Promise<
  | { result: "sent"; environment: ApnsEnvironment }
  | { result: "gone" }
  | { result: "failed"; reason: string }
> {
  const first = environment ?? "production";
  const order: ApnsEnvironment[] = [first, first === "production" ? "sandbox" : "production"];
  for (const server of order) {
    const outcome = await sendTo(server, deviceToken, message, key);
    if (outcome.result === "sent") return { result: "sent", environment: server };
    if (outcome.result === "wrong-server") continue;
    return outcome;
  }
  // Neither server knows it: as good as gone.
  return { result: "gone" };
}
