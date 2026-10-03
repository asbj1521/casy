import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The iPhone app: the same Vite build as the website, packaged by Capacitor
 * into the Xcode project under ios/. `npm run ios` builds the site and copies
 * it in (`cap sync`).
 *
 * The app id is the bundle identifier Apple knows the app by. It can never
 * change once the app is on the App Store, so it follows the domain (casy.app)
 * rather than the internal "autodate" name.
 */
const config: CapacitorConfig = {
  appId: "app.casy",
  appName: "Casy",
  webDir: "dist",
};

export default config;
