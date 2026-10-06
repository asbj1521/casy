/**
 * Being told when your pulse may have moved, instead of asking over and over:
 * a Supabase Realtime subscription to the private broadcast topic
 * `pulse:<your user id>` (the live_push migration's triggers send to it, and
 * its policy lets only you listen to yours).
 *
 * A message carries no data, only "ask again": the page then asks the pulse
 * through the groups function as it always has, so nothing here reads a table
 * and nothing changes about what the browser may see.
 *
 * The Realtime client is loaded only once someone is signed in, so the
 * landing page never downloads it. If the subscription fails or drops, this
 * says so (`onLive(false)`) and tries again after a while; until it is back,
 * the page asks the pulse on its own (lib/livePace.ts).
 */
import type { RealtimeChannel, RealtimeClient } from "@supabase/realtime-js";

import { supabaseAuth } from "@/lib/supabase";

/** How long to wait before subscribing again after the 1st, 2nd, ... failure. */
const RETRY_DELAYS_MS = [5_000, 15_000, 60_000, 5 * 60_000];

export interface PushHandlers {
  /** Something you can see may have changed: ask the pulse. */
  onSignal: () => void;
  /** Whether messages are arriving now (subscribed) or not (connecting, failed). */
  onLive: (live: boolean) => void;
}

/** Start listening for `userId`'s pulse messages; returns the function that stops it. */
export function watchPulsePush(userId: string, handlers: PushHandlers): () => void {
  let stopped = false;
  let client: RealtimeClient | null = null;
  let channel: RealtimeChannel | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;

  const retryLater = () => {
    handlers.onLive(false);
    const delay = RETRY_DELAYS_MS[Math.min(failures, RETRY_DELAYS_MS.length - 1)];
    failures += 1;
    retryTimer = setTimeout(() => void subscribe(), delay);
  };

  // Drop the channel without its own "closed" report counting as a failure.
  const dropChannel = () => {
    const old = channel;
    channel = null;
    if (old) void client?.removeChannel(old);
  };

  const subscribe = async () => {
    try {
      if (!client) {
        const { RealtimeClient } = await import("@supabase/realtime-js");
        if (stopped) return;
        client = new RealtimeClient(`${import.meta.env.VITE_SUPABASE_URL}/realtime/v1`, {
          params: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
          // Asked on connecting and on every heartbeat, so a refreshed login
          // reaches Realtime before the old one expires.
          accessToken: async () =>
            (await supabaseAuth.getSession()).data.session?.access_token ?? null,
        });
      }
      // A private channel's join carries the login; have it before joining.
      await client.setAuth();
      if (stopped) return;
    } catch {
      // The chunk didn't load (offline, or a deploy replaced it) or no login.
      if (!stopped) retryLater();
      return;
    }

    const mine = client.channel(`pulse:${userId}`, { config: { private: true } });
    channel = mine;
    mine
      .on("broadcast", { event: "pulse" }, () => {
        if (!stopped) handlers.onSignal();
      })
      .subscribe((status) => {
        if (stopped || channel !== mine) return;
        if (status === "SUBSCRIBED") {
          failures = 0;
          handlers.onLive(true);
          return;
        }
        // CHANNEL_ERROR (refused, or the login ran out), TIMED_OUT or CLOSED:
        // start over from a fresh channel rather than trust it to recover.
        dropChannel();
        retryLater();
      });
  };

  void subscribe();

  return () => {
    stopped = true;
    clearTimeout(retryTimer);
    dropChannel();
    client?.disconnect();
  };
}
