/**
 * Step 1 of connecting a Google account: the address of Google's consent
 * screen, for the signed-in person's browser to go to (see _shared/oauth.ts).
 */
import { serveOAuthStart } from "../_shared/oauth.ts";

serveOAuthStart("google");
