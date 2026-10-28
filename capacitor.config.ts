import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The iPhone app: the same Vite build as the website, packaged by Capacitor
 * into the Xcode project under ios/. `npm run ios` builds the site and copies
 * it in (`cap sync`).
 *
 * The app id is the bundle identifier Apple knows the app by. It can never
 * change once the app is on the App Store, so it follows the domain (casy.app)
 * rather than the internal "autodate" name.
 *
 * `npm run ios:live` syncs with CAP_LIVE_URL set, which points the app at the
 * Vite dev server instead of the copied build. The result lands only in
 * ios/App/App/capacitor.config.json (git-ignored), and the next plain
 * `npm run ios` writes it back without a server address.
 */
const liveUrl = process.env.CAP_LIVE_URL;

const config: CapacitorConfig = {
  appId: "app.casy",
  appName: "Casy",
  webDir: "dist",
  // A notification arriving while Casy is open still shows as a banner (#139).
  plugins: { PushNotifications: { presentationOptions: ["banner", "sound", "list"] } },
  ...(liveUrl ? { server: { url: liveUrl, cleartext: true } } : {}),
};

export default config;
