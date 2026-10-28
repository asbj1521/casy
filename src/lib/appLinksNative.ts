/**
 * The iPhone app's side of links that open it (#140; which links, and where
 * they lead, is appLinks.ts): Capacitor's app plugin hands over the URL the
 * app was opened from, both while it is running (`appUrlOpen`) and when the
 * link launched it (`getLaunchUrl`). The website never loads it (isNativeApp).
 *
 * As in push.ts, the plugin's module loads on first use and only the module
 * goes through promises.
 */
import { appLinkPath } from "@/lib/appLinks";

/** One link can arrive twice, as the launch URL and as the event: it opens once. */
const SAME_LINK_MS = 3_000;

/** Each link the app is opened from: where in the app it leads (a path), through `open`. */
export async function onAppLink(open: (path: string) => void): Promise<() => void> {
  const { App } = await import("@capacitor/app");
  let last = { url: "", at: 0 };
  const handle = (url: string) => {
    const path = appLinkPath(url);
    // In Xcode's console, so a tap that goes nowhere can be told from one that never arrived.
    console.log("app link", path ?? `ignored (${url})`);
    if (!path) return;
    const now = Date.now();
    if (url === last.url && now - last.at < SAME_LINK_MS) return;
    last = { url, at: now };
    open(path);
  };
  // The listener first, so a link arriving while the launch URL is asked for isn't missed.
  const listener = await App.addListener("appUrlOpen", (event) => handle(event.url));
  void App.getLaunchUrl().then((launch) => {
    if (launch?.url) handle(launch.url);
  });
  return () => void listener.remove();
}
