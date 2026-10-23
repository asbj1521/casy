/**
 * The oldest iPhone app release Casy still works with, and where to get a
 * newer one (#143): `{ minVersion, storeUrl }`, either null when not set. The
 * app asks on opening and coming back, and an older app shows "Update Casy".
 *
 * Public and without a login on purpose: an app too old to sign in must still
 * be told. It answers only the two function secrets (_shared/appVersion.ts).
 */
import { appVersionInfo } from "../_shared/appVersion.ts";
import { serve } from "../_shared/http.ts";

serve(
  "app-version",
  () =>
    Promise.resolve(appVersionInfo(Deno.env.get("MIN_APP_VERSION"), Deno.env.get("APP_STORE_URL"))),
  "GET",
);
